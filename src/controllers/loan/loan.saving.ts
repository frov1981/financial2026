import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Account } from '../../entities/Account.entity'
import { Loan } from '../../entities/Loan.entity'
import { LoanGroup } from '../../entities/LoanGroup.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { loanFormMatrix, LoanFormMode } from '../../policies/loan-form.policy'
import { getActiveAccountsByUser, getActiveParentLoansByUser } from '../../services/populate-items.service'
import { AuthRequest } from '../../types/auth-request'
import { parseLocalDateToUTC } from '../../utils/date.util'
import { logger } from '../../utils/logger.util'
import { validateDeleteLoan, validateLoan } from './loan.validator'
import { KpiCacheService } from '../../services/kpi-cache.service'

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
    if (policy[field] === 'edit' && body[field] !== undefined) {
      clean[field] = body[field]
    }
  }

  return clean
}

/* ============================
   Construir objeto para la vista
============================ */
const buildLoanView = (body: any, loan_group: LoanGroup[], disbursement_account: Account[]) => {
  const loan_group_id = body.loan_group_id ? Number(body.loan_group_id) : null
  const group = loan_group_id ? loan_group.find(p => p.id === loan_group_id) || null : null
  const disbursement_id = body.disbursement_account_id ? Number(body.disbursement_account_id) : null
  const disbursement = disbursement_id ? disbursement_account.find(a => a.id === disbursement_id) || null : null

  return {
    ...body,
    loan_group: group ? { id: group.id, name: group.name } : null,
    disbursement_account: disbursement ? { id: disbursement.id, name: disbursement.name } : null
  }
}

/* ============================
    Obtener grupo de préstamo desde el body y la lista de grupos del usuario  
============================ */
const findLoanGroupByBody = (body: any, loan_group: LoanGroup[]): LoanGroup | null => {
  const loan_group_id = body.loan_group_id ? Number(body.loan_group_id) : null

  if (!loan_group_id) return null

  return loan_group.find(p => p.id === loan_group_id) || null
}

/* ============================
   Obtener cuenta de desembolso desde el body y la lista de cuentas del usuario  
============================ */
const findDisbursementAccountByBody = (body: any, disbursement_account: Account[]): Account | null => {
  const disbursement_account_id = body.disbursement_account_id ? Number(body.disbursement_account_id) : null

  if (!disbursement_account_id) return null

  return disbursement_account.find(a => a.id === disbursement_account_id) || null
}

/* ============================
    Obtener cuentas activas del usuario para mostrar en el formulario 
============================ */
export const saveLoan: RequestHandler = async (req: Request, res: Response) => {
  logger.debug(`${saveLoan.name}-Start`)
  logger.info('saveLoan called', { body: req.body, param: req.params })

  const auth_req = req as AuthRequest
  const loan_id = req.body.id ? Number(req.body.id) : undefined
  const mode: LoanFormMode = req.body.mode || 'insert'
  const timezone = auth_req.timezone || 'UTC'
  logger.debug(`${saveLoan.name}-Timezone for saving loan: [${timezone}]`)

  const loan_group = await getActiveParentLoansByUser(auth_req)
  const disbursement_account = await getActiveAccountsByUser(auth_req)
  const loan_view = buildLoanView(req.body, loan_group, disbursement_account)

  const form_state = {
    loan: loan_view,
    loan_group,
    disbursement_account: disbursement_account,
    loan_form_policy: loanFormMatrix[mode],
    mode
  }

  const queryRunner = AppDataSource.createQueryRunner()
  const loanRepo = queryRunner.manager.getRepository(Loan)

  await queryRunner.connect()
  await queryRunner.startTransaction()

  try {
    let existing: Loan | null = null

    if (loan_id) {
      existing = await loanRepo.findOne({
        where: { id: loan_id, user: { id: auth_req.user.id } },
        relations: { disbursement_account: true, transaction: true, loan_group: true }
      })
      if (!existing) throw new Error('Préstamo no encontrado')
    }

    /* =========================
       DELETE
    ============================ */
    if (mode === 'delete') {
      if (!existing) throw new Error('Préstamo no encontrado')

      const errors = await validateDeleteLoan(existing, auth_req)
      if (errors) throw { validationErrors: errors }

      if (existing.disbursement_account) {
        const account = await queryRunner.manager.findOneByOrFail(Account, {
          id: existing.disbursement_account.id,
          user: { id: auth_req.user.id }
        })

        account.balance -= existing.total_amount
        await queryRunner.manager.save(account)
      }

      const transaction_id = existing.transaction?.id || null

      await queryRunner.manager.delete(Loan, existing.id)
      if (transaction_id) {
        await queryRunner.manager.delete(Transaction, transaction_id)
      }

      await queryRunner.commitTransaction()
      KpiCacheService.recalcMonthlyKPIs(existing.transaction, timezone).catch(err => logger.error(`${saveLoan.name}-Error. `, { err }))
      return res.redirect('/loans')
    }

    /* =========================
       INSERT / UPDATE
    ============================ */
    let loan: Loan

    if (mode === 'insert') {
      const selected_group = findLoanGroupByBody(req.body, loan_group)
      const selected_disbursement_account = findDisbursementAccountByBody(req.body, disbursement_account)
      loan = queryRunner.manager.create(Loan, {
        user: { id: auth_req.user.id } as any,
        name: req.body.name,
        total_amount: 0,
        interest_paid: 0,
        balance: 0,
        start_date: parseLocalDateToUTC(req.body.start_date, timezone),
        loan_group: selected_group,
        disbursement_account: selected_disbursement_account,
        is_active: true
      })
    } else {
      if (!existing) throw new Error('Préstamo no encontrado')
      loan = existing
    }

    const clean = sanitizeByPolicy(mode, req.body)

    if (clean.name !== undefined) loan.name = clean.name
    if (clean.start_date !== undefined) loan.start_date = parseLocalDateToUTC(clean.start_date, timezone)
    if (clean.is_active !== undefined) loan.is_active = clean.is_active === 'true' || clean.is_active === '1'
    if (clean.note !== undefined) loan.note = clean.note
    if (clean.loan_group_id !== undefined) { loan.loan_group = findLoanGroupByBody(req.body, loan_group) }
    if (clean.disbursement_account_id !== undefined) { loan.disbursement_account = findDisbursementAccountByBody(req.body, disbursement_account) }

    let new_account: Account | null = loan.disbursement_account || null
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

    if (mode === 'insert') {
      if (!new_account) throw { code: 'DISBURSEMENT_REQUIRED' }
      new_account.balance += loan.total_amount
      await queryRunner.manager.save(new_account)

      loan.disbursement_account = new_account

      const transaction = queryRunner.manager.create(Transaction, {
        user: { id: auth_req.user.id } as any,
        type: 'income',
        amount: loan.total_amount,
        account: new_account,
        date: loan.start_date,
        description: loan.name
      })

      await queryRunner.manager.save(transaction)
      loan.transaction = transaction

    } else {
      if (!loan.disbursement_account) { throw { code: 'DISBURSEMENT_NOT_FOUND' } }
      if (!new_account) throw { code: 'DISBURSEMENT_REQUIRED' }

      const old_account = await queryRunner.manager.findOneByOrFail(Account, {
        id: loan.disbursement_account.id,
        user: { id: auth_req.user.id }
      })

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
        loan.transaction.description = loan.name
        loan.transaction.account = new_account
        await queryRunner.manager.save(loan.transaction)
      }
    }

    const errors = await validateLoan(loan, auth_req)
    if (errors) throw { validationErrors: errors }

    await queryRunner.manager.save(loan)
    await queryRunner.commitTransaction()
    KpiCacheService.recalcMonthlyKPIs(loan.transaction, timezone).catch(err => logger.error(`${saveLoan.name}-Error. `, { err }))
    return res.redirect('/loans')

  } catch (err: any) {
    await queryRunner.rollbackTransaction()

    logger.error(`${saveLoan.name}-Error. `, {
      user_id: auth_req.user.id,
      loan_id,
      mode,
      error: err,
      stack: err?.stack
    })

    let validationErrors: Record<string, string> | null = null

    switch (err?.code) {
      case 'DISBURSEMENT_REQUIRED':
        validationErrors = { disbursement_account: 'Cuenta de desembolso requerida' }
        break
      case 'DISBURSEMENT_NOT_FOUND':
        validationErrors = { disbursement_account: 'Cuenta de desembolso actual no encontrada' }
        break
      default:
        // errores que vengan de validateLoan
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
