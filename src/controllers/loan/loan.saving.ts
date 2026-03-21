import { Request, RequestHandler, Response } from 'express'
import { DateTime } from 'luxon'
import { getAccountById, getActiveAccountsForDisbursement } from '../../cache/cache-accounts.service'
import { getActiveIncomeCategories, getCategoryById } from '../../cache/cache-categories.service'
import { deleteAll } from '../../cache/cache-key.service'
import { getActiveLoanGroup, getLoanGroupById } from '../../cache/cache-loan-group.service'
import { getLoanById } from '../../cache/cache-loans.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Account } from '../../entities/Account.entity'
import { Category } from '../../entities/Category.entity'
import { Loan } from '../../entities/Loan.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { loanFormMatrix } from '../../policies/loan-form.policy'
import { KpiCacheService } from '../../services/kpi-cache.service'
import { AuthRequest } from '../../types/auth-request'
import { LoanFormMode } from '../../types/form-view-params'
import { parseBoolean } from '../../utils/bool.util'
import { parseLocalDateToUTC } from '../../utils/date.util'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'
import { validateDeleteLoan, validateLoan } from './loan.validator'

/* ============================
   Obtener título según el modo del formulario
============================ */
const getTitle = (mode: string) => {
  switch (mode) {
    case 'insert': return 'Insertar Préstamo'
    case 'update': return 'Editar Préstamo'
    case 'delete': return 'Eliminar Préstamo'
    default: return 'Indefinido'
  }
}

/* ============================
   Sanitizar payload según policy
============================ */
const sanitizeByPolicy = (mode: LoanFormMode, body: any) => {
  const policy = loanFormMatrix[mode]
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
const buildLoanView = async (auth_req: AuthRequest, body: any) => {
  const loan_group_id = Number(body.loan_group_id)
  const disbursement_id = Number(body.disbursement_account_id)
  const category_id = Number(body.category_id)
  const loan_group = await getLoanGroupById(auth_req, loan_group_id)
  const disbursement = await getAccountById(auth_req, disbursement_id)
  const category = await getCategoryById(auth_req, category_id)
  return {
    ...body,
    is_active: parseBoolean(body.is_active),
    loan_group,
    disbursement,
    category
  }
}

/* ============================
    Obtener cuentas activas del usuario para mostrar en el formulario 
============================ */
export const saveLoan: RequestHandler = async (req: Request, res: Response) => {
  logger.debug(`${saveLoan.name}-Start`)
  logger.info('saveLoan called', { body: req.body, param: req.params })
  const auth_req = req as AuthRequest
  const mode: LoanFormMode = req.body.mode || 'insert'
  const timezone = auth_req.timezone || 'UTC'
  const loan_id = Number(req.body.id)
  const loan_group_id = Number(req.body.loan_group_id)
  const disbursement_id = Number(req.body.disbursement_account_id)
  const category_id = Number(req.body.category_id)
  const return_from = req.body.return_from
  const return_category_id = Number(req.body.return_category_id) || null

  const form_state = {
    loan: await buildLoanView(auth_req, req.body),
    loan_group_list: await getActiveLoanGroup(auth_req),
    disbursement_account_list: await getActiveAccountsForDisbursement(auth_req),
    active_income_category_list: await getActiveIncomeCategories(auth_req),
    loan_form_policy: loanFormMatrix[mode],
    mode,
    context: { from: return_from, category_id: return_category_id }
  }

  const queryRunner = AppDataSource.createQueryRunner()
  await queryRunner.connect()
  await queryRunner.startTransaction()
  try {
    let existing: Loan | null = null
    if (loan_id) {
      existing = await getLoanById(auth_req, loan_id)
      if (!existing) throw new Error('Préstamo no encontrado')
    }
    /* =========================
       DELETE
    ============================ */
    if (mode === 'delete') {
      if (!existing) throw new Error('Préstamo no encontrado')
      const errors = await validateDeleteLoan(auth_req, existing)
      if (errors) throw { validationErrors: errors }
      const local_date = DateTime.fromJSDate(existing.transaction.date, { zone: 'utc' }).setZone(timezone)
      const period_year = local_date.year
      const period_month = local_date.month
      if (existing.disbursement_account) {
        const account = await getAccountById(auth_req, disbursement_id)
        if (!account) throw new Error('Cuenta de desembolso no encontrado')
        account.balance -= existing.total_amount
        await queryRunner.manager.save(account)
      }
      const transaction_id = existing.transaction?.id || null
      await queryRunner.manager.delete(Loan, existing.id)
      if (transaction_id) {
        await queryRunner.manager.delete(Transaction, transaction_id)
      }
      await queryRunner.commitTransaction()

      deleteAll(auth_req, 'loan')
      KpiCacheService.recalcMonthlyKPIs(auth_req, period_year, period_month).catch(err => logger.error(`${saveLoan.name}-Error recalculando KPI`, parseError(err)))

      if (return_from === 'categories' && return_category_id) {
        return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
      }
      return res.redirect('/loans')
    }
    /* =========================
       INSERT / UPDATE
    ============================ */
    let loan: Loan
    if (mode === 'insert') {
      const loan_group = await getLoanGroupById(auth_req, loan_group_id)
      const disbursement = await getAccountById(auth_req, disbursement_id)
      const category = await getCategoryById(auth_req, category_id)
      loan = queryRunner.manager.create(Loan, {
        user: { id: auth_req.user.id } as any,
        name: req.body.name,
        note: req.body.note,
        total_amount: 0,
        interest_paid: 0,
        balance: 0,
        start_date: parseLocalDateToUTC(req.body.start_date, timezone),
        loan_group: loan_group,
        disbursement_account: disbursement,
        category: category,
        is_active: true
      })
    } else {
      if (!existing) throw new Error('Préstamo no encontrado')
      loan = existing
    }
    /*=================================
      Aplicar sanitización por policy
    =================================*/
    const clean = sanitizeByPolicy(mode, req.body)
    if (clean.name !== undefined) loan.name = clean.name
    if (clean.start_date !== undefined) loan.start_date = parseLocalDateToUTC(clean.start_date, timezone)
    if (clean.is_active !== undefined) loan.is_active = parseBoolean(clean.is_active)
    if (clean.note !== undefined) loan.note = clean.note
    if (clean.loan_group_id !== undefined) { loan.loan_group = await getLoanGroupById(auth_req, loan_group_id) }
    if (clean.disbursement_account_id !== undefined) { loan.disbursement_account = await getAccountById(auth_req, disbursement_id) }
    if (clean.category_id !== undefined) { loan.category = await getCategoryById(auth_req, category_id) }
    let new_account: Account | null = loan.disbursement_account || null
    let new_category: Category | null = loan.category || null
    let previous_amount = loan.total_amount
    let previous_balance = loan.balance
    if (clean.total_amount !== undefined) {
      const new_amount = Number(clean.total_amount)
      if (mode === 'insert') {
        loan.total_amount = new_amount
        loan.balance = new_amount
      } else {
        const paidAmount = previous_amount - previous_balance
        loan.total_amount = new_amount
        loan.balance = new_amount - paidAmount
      }
    }
    if (loan.balance === 0) {
      loan.is_active = false
    } else {
      loan.is_active = true
    }
    if (mode === 'insert') {
      if (!new_account) throw { code: 'DISBURSEMENT_REQUIRED' }
      if (!new_category) { throw { code: 'CATEGORY_NOT_FOUND' } }
      new_account.balance += loan.total_amount
      await queryRunner.manager.save(new_account)
      loan.disbursement_account = new_account
      loan.category = new_category
      const transaction = queryRunner.manager.create(Transaction, {
        user: { id: auth_req.user.id } as any,
        type: 'income',
        flow_type: 'loans',
        amount: loan.total_amount,
        account: new_account,
        category: new_category,
        date: loan.start_date,
        description: loan.note || loan.name
      })
      await queryRunner.manager.save(transaction)
      loan.transaction = transaction
    } else {
      if (!loan.disbursement_account) { throw { code: 'DISBURSEMENT_NOT_FOUND' } }
      if (!new_account) throw { code: 'DISBURSEMENT_REQUIRED' }
      if (!new_category) { throw { code: 'CATEGORY_NOT_FOUND' } }
      const old_account = await getAccountById(auth_req, loan.disbursement_account.id)
      if (!old_account) throw { code: 'DISBURSEMENT_REQUIRED' }
      if (old_account.id === new_account.id) {
        const delta = loan.total_amount - previous_amount
        old_account.balance += delta
        await queryRunner.manager.save(old_account)
      } else {
        old_account.balance -= previous_amount
        new_account.balance += loan.total_amount
        await queryRunner.manager.save([old_account, new_account])
      }
      loan.disbursement_account = new_account
      if (loan.transaction?.id) {
        loan.transaction.amount = loan.total_amount
        loan.transaction.date = loan.start_date
        loan.transaction.description = loan.note || loan.name
        loan.transaction.account = new_account
        loan.transaction.category = new_category
        await queryRunner.manager.save(loan.transaction)
      }
    }
    const errors = await validateLoan(auth_req, loan)
    if (errors) throw { validationErrors: errors }
    /*=================================
      Guardar en base de datos y limpiar cache
    =================================*/
    await queryRunner.manager.save(loan)
    await queryRunner.commitTransaction()

    deleteAll(auth_req, 'loan')
    if (loan.transaction) {
      const local_date = DateTime.fromJSDate(loan.transaction.date, { zone: 'utc' }).setZone(timezone)
      const period_year = local_date.year
      const period_month = local_date.month
      KpiCacheService.recalcMonthlyKPIs(auth_req, period_year, period_month).catch(err => logger.error(`${saveLoan.name}-Error recalculando KPI`, parseError(err)))
    }

    if (return_from === 'categories' && return_category_id) {
      return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
    }
    return res.redirect('/loans')
  } catch (err: any) {
    /* ============================
       Manejo de errores
    ============================ */
    await queryRunner.rollbackTransaction()
    logger.error(`${saveLoan.name}-Error. `, {
      user_id: auth_req.user.id,
      loan_id,
      mode,
      error: parseError(err),
    })
    let validationErrors: Record<string, string> | null = null
    switch (err?.code) {
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
        validationErrors = err?.validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
    }
    return res.render('layouts/main', {
      title: getTitle(mode),
      view: 'pages/loans/form',
      ...form_state,
      errors: validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
    })
  } finally {
    await queryRunner.release()
    logger.debug(`${saveLoan.name}-End`)
  }
}
