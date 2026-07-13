import { Request, RequestHandler, Response } from 'express';
import { performance } from 'perf_hooks';
import { getAccountById, getActiveAccountsForDisbursement } from '../../cache/cache-accounts.service';
import { getActiveIncomeCategories, getCategoryById } from '../../cache/cache-categories.service';
import { deleteAll } from '../../cache/cache-key.service';
import { getActiveReceivableGroup, getReceivableGroupById } from '../../cache/cache-receivable-groups.service';
import { getReceivableById } from '../../cache/cache-receivables.service';
import { AppDataSource } from '../../config/typeorm.datasource';
import { Account } from '../../entities/Account.entity';
import { Category } from '../../entities/Category.entity';
import { Receivable } from '../../entities/Receivable.entity';
import { Transaction } from '../../entities/Transaction.entity';
import { receivableFormMatrix } from '../../policies/receivable-form.policy';
import { KpiCacheService } from '../../services/kpi-cache.service';
import { AuthRequest } from '../../types/auth-request';
import { parseBoolean } from '../../utils/bool.util';
import { parseLocalDateToUTC } from '../../utils/date.util';
import { parseError } from '../../utils/error.util';
import { logger } from '../../utils/logger.util';
import { validateDeleteReceivable, validateReceivable } from './receivable.validator';
import { ReceivableFormMode } from '../../types/form-view-params';

/* ============================
   Obtener título según el modo del formulario
============================ */
const getTitle = (mode: string) => {
  switch (mode) {
    case 'insert': return 'Insertar Cuenta por Cobrar'
    case 'update': return 'Editar Cuenta por Cobrar'
    case 'delete': return 'Eliminar Cuenta por Cobrar'
    default: return 'Indefinido'
  }
}

/* ============================
   Sanitizar payload según policy
============================ */
const sanitizeByPolicy = (mode: ReceivableFormMode, body: any) => {
  const policy = receivableFormMatrix[mode]
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
const buildReceivableView = async (auth_req: AuthRequest, body: any) => {
  const receivable_group_id = Number(body.receivable_group_id)
  const disbursement_id = Number(body.disbursement_account_id)
  const category_id = Number(body.category_id)
  const receivable_group = await getReceivableGroupById(auth_req, receivable_group_id)
  const disbursement = await getAccountById(auth_req, disbursement_id)
  const category = await getCategoryById(auth_req, category_id)

  return {
    ...body,
    is_active: parseBoolean(body.is_active),
    receivable_group,
    disbursement,
    category
  }
}

/* ============================
    Obtener cuentas activas del usuario para mostrar en el formulario 
============================ */
export const saveReceivable: RequestHandler = async (req: Request, res: Response) => {
  const start = performance.now()
  logger.info(`${saveReceivable.name} called`, { body: req.body, param: req.params })
  const auth_req = req as AuthRequest
  const user_id = auth_req.user.id
  const mode: ReceivableFormMode = req.body.mode || 'insert'
  const timezone = auth_req.timezone || 'UTC'
  const receivable_id = Number(req.body.id)
  const receivable_group_id = Number(req.body.receivable_group_id)
  const disbursement_id = Number(req.body.disbursement_account_id)
  const category_id = Number(req.body.category_id)
  const return_from = req.body.return_from
  const return_category_id = Number(req.body.return_category_id) || null

  const form_state = {
    receivable: await buildReceivableView(auth_req, req.body),
    receivable_group_list: await getActiveReceivableGroup(auth_req),
    disbursement_account_list: await getActiveAccountsForDisbursement(auth_req),
    active_income_category_list: await getActiveIncomeCategories(auth_req),
    receivable_form_policy: receivableFormMatrix[mode],
    mode,
    context: { from: return_from, category_id: return_category_id }
  }

  const queryRunner = AppDataSource.createQueryRunner()
  await queryRunner.connect()
  await queryRunner.startTransaction()

  try {
    let existing: Receivable | null = null
    if (receivable_id) {
      existing = await getReceivableById(auth_req, receivable_id)
      if (!existing) throw new Error('Cuenta por Cobrar no encontrada')
    }
    /* =========================
       DELETE
    ============================ */
    if (mode === 'delete') {
      if (!existing) throw new Error('Cuenta por Cobrar no encontrada')
      const errors = await validateDeleteReceivable(auth_req, existing)
      if (errors) throw { validationErrors: errors }
      if (existing.disbursement_account) {
        const account = await getAccountById(auth_req, disbursement_id)
        if (!account) throw new Error('Cuenta de desembolso no encontrado')
        account.balance += existing.total_amount
        await queryRunner.manager.save(account)
      }
      const transaction_id = existing.transaction?.id || null
      await queryRunner.manager.delete(Receivable, existing.id)
      if (transaction_id) {
        await queryRunner.manager.delete(Transaction, transaction_id)
      }
      await queryRunner.commitTransaction()
      deleteAll(auth_req, 'receivable')

      KpiCacheService
        .recalculateBalanceKPIByTransaction(auth_req, existing)
        .catch(error => logger.error(`${saveReceivable.name}-Error recalculando KPI Balances`, parseError(error)))

      KpiCacheService
        .recalculateCategoryKPIByTransaction(auth_req, existing)
        .catch(error => logger.error(`${saveReceivable.name}-Error recalculando KPI Categorías`, parseError(error)))

      if (return_from === 'categories' && return_category_id) {
        return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
      }
      return res.redirect('/receivables')
    }
    /* =========================
       INSERT / UPDATE
    ============================ */
    let receivable: Receivable
    if (mode === 'insert') {
      const receivable_group = await getReceivableGroupById(auth_req, receivable_group_id)
      const disbursement = await getAccountById(auth_req, disbursement_id)
      const category = await getCategoryById(auth_req, category_id)
      receivable = queryRunner.manager.create(Receivable, {
        user: { id: auth_req.user.id } as any,
        name: req.body.name,
        note: req.body.note,
        total_amount: 0,
        interest_paid: 0,
        balance: 0,
        start_date: parseLocalDateToUTC(req.body.start_date, timezone),
        receivable_group: receivable_group,
        disbursement_account: disbursement,
        category: category,
        is_active: true
      })
    } else {
      if (!existing) throw new Error('Cuenta por Cobrar no encontrada')
      receivable = existing
    }
    /*=================================
      Aplicar sanitización por policy
    =================================*/
    const clean = sanitizeByPolicy(mode, req.body)
    if (clean.name !== undefined) receivable.name = clean.name
    if (clean.start_date !== undefined) receivable.start_date = parseLocalDateToUTC(clean.start_date, timezone)
    if (clean.is_active !== undefined) receivable.is_active = parseBoolean(clean.is_active)
    if (clean.note !== undefined) receivable.note = clean.note
    if (clean.receivable_group_id !== undefined) { receivable.receivable_group = await getReceivableGroupById(auth_req, receivable_group_id) }
    if (clean.disbursement_account_id !== undefined) { receivable.disbursement_account = await getAccountById(auth_req, disbursement_id) }
    if (clean.category_id !== undefined) { receivable.category = await getCategoryById(auth_req, category_id) }
    let new_account: Account | null = receivable.disbursement_account || null
    let new_category: Category | null = receivable.category || null
    let previous_amount = receivable.total_amount
    let previous_balance = receivable.balance
    if (clean.total_amount !== undefined) {
      const new_amount = Number(clean.total_amount)
      if (mode === 'insert') {
        receivable.total_amount = new_amount
        receivable.balance = new_amount
      } else {
        const paidAmount = previous_amount - previous_balance
        receivable.total_amount = new_amount
        receivable.balance = new_amount - paidAmount
      }
    }
    if (receivable.balance === 0) {
      receivable.is_active = false
    } else {
      receivable.is_active = true
    }
    if (mode === 'insert') {
      if (!new_account) throw { code: 'DISBURSEMENT_REQUIRED' }
      if (!new_category) { throw { code: 'CATEGORY_NOT_FOUND' } }
      new_account.balance += receivable.total_amount
      await queryRunner.manager.save(new_account)
      receivable.disbursement_account = new_account
      receivable.category = new_category
      const transaction = queryRunner.manager.create(Transaction, {
        user: { id: auth_req.user.id } as any,
        type: 'income',
        detailed_type: 'expense_for_receivable',
        amount: receivable.total_amount,
        account: new_account,
        category: new_category,
        date: receivable.start_date,
        description: receivable.note || receivable.name
      })
      await queryRunner.manager.save(transaction)
      receivable.transaction = transaction
    } else {
      if (!receivable.disbursement_account) { throw { code: 'DISBURSEMENT_NOT_FOUND' } }
      if (!new_account) throw { code: 'DISBURSEMENT_REQUIRED' }
      if (!new_category) { throw { code: 'CATEGORY_NOT_FOUND' } }
      const old_account = await getAccountById(auth_req, receivable.disbursement_account.id)
      if (!old_account) throw { code: 'DISBURSEMENT_REQUIRED' }
      if (old_account.id === new_account.id) {
        const delta = receivable.total_amount - previous_amount
        old_account.balance += delta
        await queryRunner.manager.save(old_account)
      } else {
        old_account.balance -= previous_amount
        new_account.balance += receivable.total_amount
        await queryRunner.manager.save([old_account, new_account])
      }
      receivable.disbursement_account = new_account
      if (receivable.transaction?.id) {
        receivable.transaction.amount = receivable.total_amount
        receivable.transaction.date = receivable.start_date
        receivable.transaction.description = receivable.note || receivable.name
        receivable.transaction.account = new_account
        receivable.transaction.category = new_category
        await queryRunner.manager.save(receivable.transaction)
      }
    }
    const errors = await validateReceivable(auth_req, receivable)
    if (errors) throw { validationErrors: errors }
    /*=================================
      Guardar en base de datos y limpiar cache
    =================================*/
    await queryRunner.manager.save(receivable)
    await queryRunner.commitTransaction()

    deleteAll(auth_req, 'receivable')
    if (receivable.transaction) {
      KpiCacheService
        .recalculateBalanceKPIByTransaction(auth_req, receivable.transaction)        
        .catch(error => logger.error(`${saveReceivable.name}-Error recalculando KPI Balance`, parseError(error)))

      KpiCacheService
        .recalculateCategoryKPIByTransaction(auth_req, receivable.transaction)
        .catch(error => logger.error(`${saveReceivable.name}-Error recalculando KPI Categorías`, parseError(error)))
    }

    if (return_from === 'categories' && return_category_id) {
      return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
    }
    return res.redirect('/receivables')
  } catch (error: any) {
    /* ============================
       Manejo de errores
    ============================ */
    await queryRunner.rollbackTransaction()
    logger.error(`${saveReceivable.name}-Error. `, { user_id: auth_req.user.id, receivable_id, mode, error: parseError(error), })

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
      view: 'pages/receivables/form',
      ...form_state,
      errors: validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
    })
  } finally {
    await queryRunner.release()
    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`${saveReceivable.name}. user=[${user_id}], elapsedTime=[${duration_sec.toFixed(4)}]`)
  }
}
