import { Request, RequestHandler, Response } from 'express';
import { performance } from 'perf_hooks';
import { getAccountById, getActiveAccountsForDisbursement } from '../../cache/cache-accounts.service';
import { getActiveIncomeCategories, getCategoryById } from '../../cache/cache-categories.service';
import { deleteAll } from '../../cache/cache-key.service';
import { getActivePayableGroup, getPayableGroupById } from '../../cache/cache-payable-groups.service';
import { getPayableById } from '../../cache/cache-payables.service';
import { AppDataSource } from '../../config/typeorm.datasource';
import { Account } from '../../entities/Account.entity';
import { Category } from '../../entities/Category.entity';
import { Payable } from '../../entities/Payable.entity';
import { Transaction } from '../../entities/Transaction.entity';
import { payableFormMatrix } from '../../policies/payable-form.policy';
import { KpiCacheService } from '../../services/kpi-cache.service';
import { AuthRequest } from '../../types/auth-request';
import { PayableFormMode } from '../../types/form-view-params';
import { parseBoolean } from '../../utils/bool.util';
import { parseLocalDateToUTC } from '../../utils/date.util';
import { parseError } from '../../utils/error.util';
import { logger } from '../../utils/logger.util';
import { validateDeletePayable, validatePayable } from './payable.validator';

/* ============================
   Obtener título según el modo del formulario
============================ */
const getTitle = (mode: string) => {
  switch (mode) {
    case 'insert': return 'Insertar Cuenta por Pagar'
    case 'update': return 'Editar Cuenta por Pagar'
    case 'delete': return 'Eliminar Cuenta por Pagar'
    default: return 'Indefinido'
  }
}

/* ============================
   Sanitizar payload según policy
============================ */
const sanitizeByPolicy = (mode: PayableFormMode, body: any) => {
  const policy = payableFormMatrix[mode]
  const clean: any = {}
  for (const field in policy) {
    if ((policy[field] === 'editable' || policy[field] === 'readonly') && body[field] !== undefined) {
      clean[field] = body[field]
    }
  }
  return clean
}

/* ============================
   Construir objeto para la vista
============================ */
const buildPayableView = async (auth_req: AuthRequest, body: any) => {
  const payable_group_id = Number(body.payable_group_id)
  const disbursement_id = Number(body.disbursement_account_id)
  const category_id = Number(body.category_id)
  const payable_group = await getPayableGroupById(auth_req, payable_group_id)
  const disbursement = await getAccountById(auth_req, disbursement_id)
  const category = await getCategoryById(auth_req, category_id)

  return {
    ...body,
    is_active: parseBoolean(body.is_active),
    payable_group,
    disbursement,
    category
  }
}

/* ============================
    Obtener cuentas activas del usuario para mostrar en el formulario 
============================ */
export const savePayable: RequestHandler = async (req: Request, res: Response) => {
  const start = performance.now()
  logger.info(`${savePayable.name} called`, { body: req.body, param: req.params })
  const auth_req = req as AuthRequest
  const user_id = auth_req.user.id
  const mode: PayableFormMode = req.body.mode || 'insert'
  const timezone = auth_req.timezone || 'UTC'
  const payable_id = Number(req.body.id)
  const payable_group_id = Number(req.body.payable_group_id)
  const disbursement_id = Number(req.body.disbursement_account_id)
  const category_id = Number(req.body.category_id)
  const return_from = req.body.return_from
  const return_category_id = Number(req.body.return_category_id) || null

  const form_state = {
    payable: await buildPayableView(auth_req, req.body),
    payable_group_list: await getActivePayableGroup(auth_req),
    disbursement_account_list: await getActiveAccountsForDisbursement(auth_req),
    active_income_category_list: await getActiveIncomeCategories(auth_req),
    payable_form_policy: payableFormMatrix[mode],
    mode,
    context: { from: return_from, category_id: return_category_id }
  }

  const queryRunner = AppDataSource.createQueryRunner()
  await queryRunner.connect()
  await queryRunner.startTransaction()

  try {
    let existing: Payable | null = null
    if (payable_id) {
      existing = await getPayableById(auth_req, payable_id)
      if (!existing) throw new Error('Cuenta por Pagar no encontrada')
    }
    /* =========================
       DELETE
    ============================ */
    if (mode === 'delete') {
      if (!existing) throw new Error('Cuenta por Pagar no encontrada')
      const errors = await validateDeletePayable(auth_req, existing)
      if (errors) throw { validationErrors: errors }
      if (existing.disbursement_account) {
        const account = await getAccountById(auth_req, disbursement_id)
        if (!account) throw new Error('Cuenta de desembolso no encontrado')
        account.balance -= existing.total_amount
        await queryRunner.manager.save(account)
      }
      const transaction_id = existing.transaction?.id || null
      await queryRunner.manager.delete(Payable, existing.id)
      if (transaction_id) {
        await queryRunner.manager.delete(Transaction, transaction_id)
      }
      await queryRunner.commitTransaction()
      deleteAll(auth_req, 'payable')

      KpiCacheService
        .recalculateBalanceKPIByTransaction(auth_req, existing)
        .catch(error => logger.error(`${savePayable.name}-Error recalculando KPI Balances`, parseError(error)))

      KpiCacheService
        .recalculateCategoryKPIByTransaction(auth_req, existing)
        .catch(error => logger.error(`${savePayable.name}-Error recalculando KPI Categorías`, parseError(error)))

      if (return_from === 'categories' && return_category_id) {
        return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
      }
      return res.redirect('/payables')
    }
    /* =========================
       INSERT / UPDATE
    ============================ */
    let payable: Payable
    if (mode === 'insert') {
      const payable_group = await getPayableGroupById(auth_req, payable_group_id)
      const disbursement = await getAccountById(auth_req, disbursement_id)
      const category = await getCategoryById(auth_req, category_id)
      payable = queryRunner.manager.create(Payable, {
        user: { id: auth_req.user.id } as any,
        name: req.body.name,
        note: req.body.note,
        total_amount: 0,
        interest_paid: 0,
        balance: 0,
        start_date: parseLocalDateToUTC(req.body.start_date, timezone),
        payable_group: payable_group,
        disbursement_account: disbursement,
        category: category,
        is_active: true
      })
    } else {
      if (!existing) throw new Error('Cuenta por Pagar no encontrada')
      payable = existing
    }
    /*=================================
      Aplicar sanitización por policy
    =================================*/
    const clean = sanitizeByPolicy(mode, req.body)
    if (clean.name !== undefined) payable.name = clean.name
    if (clean.start_date !== undefined) payable.start_date = parseLocalDateToUTC(clean.start_date, timezone)
    if (clean.is_active !== undefined) payable.is_active = parseBoolean(clean.is_active)
    if (clean.note !== undefined) payable.note = clean.note
    if (clean.payable_group_id !== undefined) { payable.payable_group = await getPayableGroupById(auth_req, payable_group_id) }
    if (clean.disbursement_account_id !== undefined) { payable.disbursement_account = await getAccountById(auth_req, disbursement_id) }
    if (clean.category_id !== undefined) { payable.category = await getCategoryById(auth_req, category_id) }
    let new_account: Account | null = payable.disbursement_account || null
    let new_category: Category | null = payable.category || null
    let previous_amount = payable.total_amount
    let previous_balance = payable.balance
    if (clean.total_amount !== undefined) {
      const new_amount = Number(clean.total_amount)
      if (mode === 'insert') {
        payable.total_amount = new_amount
        payable.balance = new_amount
      } else {
        const paidAmount = previous_amount - previous_balance
        payable.total_amount = new_amount
        payable.balance = new_amount - paidAmount
      }
    }
    if (payable.balance === 0) {
      payable.is_active = false
    } else {
      payable.is_active = true
    }
    if (mode === 'insert') {
      if (!new_account) throw { code: 'DISBURSEMENT_REQUIRED' }
      if (!new_category) { throw { code: 'CATEGORY_NOT_FOUND' } }
      new_account.balance += payable.total_amount
      await queryRunner.manager.save(new_account)
      payable.disbursement_account = new_account
      payable.category = new_category
      const transaction = queryRunner.manager.create(Transaction, {
        user: { id: auth_req.user.id } as any,
        type: 'income',
        detailed_type: 'income_for_payable',
        amount: payable.total_amount,
        account: new_account,
        category: new_category,
        date: payable.start_date,
        description: payable.note || payable.name
      })
      await queryRunner.manager.save(transaction)
      payable.transaction = transaction
    } else {
      if (!payable.disbursement_account) { throw { code: 'DISBURSEMENT_NOT_FOUND' } }
      if (!new_account) throw { code: 'DISBURSEMENT_REQUIRED' }
      if (!new_category) { throw { code: 'CATEGORY_NOT_FOUND' } }
      const old_account = await getAccountById(auth_req, payable.disbursement_account.id)
      if (!old_account) throw { code: 'DISBURSEMENT_REQUIRED' }
      if (old_account.id === new_account.id) {
        const delta = payable.total_amount - previous_amount
        old_account.balance += delta
        await queryRunner.manager.save(old_account)
      } else {
        old_account.balance -= previous_amount
        new_account.balance += payable.total_amount
        await queryRunner.manager.save([old_account, new_account])
      }
      payable.disbursement_account = new_account
      if (payable.transaction?.id) {
        payable.transaction.amount = payable.total_amount
        payable.transaction.date = payable.start_date
        payable.transaction.description = payable.note || payable.name
        payable.transaction.account = new_account
        payable.transaction.category = new_category
        await queryRunner.manager.save(payable.transaction)
      }
    }
    const errors = await validatePayable(auth_req, payable)
    if (errors) throw { validationErrors: errors }
    /*=================================
      Guardar en base de datos y limpiar cache
    =================================*/
    await queryRunner.manager.save(payable)
    await queryRunner.commitTransaction()

    deleteAll(auth_req, 'payable')
    if (payable.transaction) {
      KpiCacheService
        .recalculateBalanceKPIByTransaction(auth_req, payable.transaction)        
        .catch(error => logger.error(`${savePayable.name}-Error recalculando KPI Balance`, parseError(error)))

      KpiCacheService
        .recalculateCategoryKPIByTransaction(auth_req, payable.transaction)
        .catch(error => logger.error(`${savePayable.name}-Error recalculando KPI Categorías`, parseError(error)))
    }

    if (return_from === 'categories' && return_category_id) {
      return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
    }
    return res.redirect('/payables')
  } catch (error: any) {
    /* ============================
       Manejo de errores
    ============================ */
    await queryRunner.rollbackTransaction()
    logger.error(`${savePayable.name}-Error. `, { user_id: auth_req.user.id, payable_id, mode, error: parseError(error), })

    let validationErrors: Record<string, string> | null = null
    switch (error?.code) {
      case 'DISBURSEMENT_REQUIRED':
        validationErrors = { disbursement_account: 'Cuenta de desembolso requerida' }
        break
      case 'DISBURSEMENT_NOT_FOUND':
        validationErrors = { disbursement_account: 'Cuenta de desembolso actual no encontrada' }
        break
      case 'CATEGORY_NOT_FOUND':
        validationErrors = { category: 'Categoría seleccionada no encontrada' }
        break
      default:
        validationErrors = error?.validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
    }
    return res.render('layouts/main', {
      title: getTitle(mode),
      view: 'pages/payables/form',
      ...form_state,
      errors: validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
    })
  } finally {
    await queryRunner.release()
    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`${savePayable.name}. user=[${user_id}], elapsedTime=[${duration_sec.toFixed(4)}]`)
  }
}
