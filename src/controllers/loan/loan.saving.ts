import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Account } from '../../entities/Account.entity'
import { Loan } from '../../entities/Loan.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { loanFormMatrix, LoanFormMode } from '../../policies/loan-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { parseLocalDateToUTC } from '../../utils/date.util'
import { logger } from '../../utils/logger.util'
import { getActiveAccountsByUser } from '../transaction/transaction.auxiliar'
import { getActiveParentLoansByUser } from './loan.auxiliar'
import { validateDeleteLoan, validateLoan } from './loan.validator'

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
const sanitizeByPolicy = (mode: LoanFormMode, role: 'parent' | 'child', body: any) => {
  const policy = loanFormMatrix[mode][role]
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
const buildLoanView = (body: any, parent_loans: Loan[], disbursement_accounts: Account[]) => {
  const parent_id = body.parent_id ? Number(body.parent_id) : null
  const disbursement_id = body.disbursement_account_id ? Number(body.disbursement_account_id) : null
  const parent = parent_id ? parent_loans.find(p => p.id === parent_id) || null : null
  const disbursement = disbursement_id ? disbursement_accounts.find(a => a.id === disbursement_id) || null : null

  return {
    ...body,
    parent: parent ? { id: parent.id, name: parent.name } : null,
    disbursement_account: disbursement ? { id: disbursement.id, name: disbursement.name } : null
  }
}


export const saveLoan: RequestHandler = async (req: Request, res: Response) => {
  logger.info('saveLoan called', { body: req.body, param: req.params })

  const auth_req = req as AuthRequest
  const loan_id = req.body.id ? Number(req.body.id) : undefined
  const mode: LoanFormMode = req.body.mode || 'insert'
  const timezone = auth_req.timezone || 'UTC'

  const parent_loans = await getActiveParentLoansByUser(auth_req)
  const disbursement_accounts = await getActiveAccountsByUser(auth_req)

  const is_parent_fallback = !req.body.parent_id || Number(req.body.parent_id) === 0
  const role_fallback: 'parent' | 'child' = is_parent_fallback ? 'parent' : 'child'
  const loan_form_policy = loanFormMatrix[mode][role_fallback]

  const loan_view = buildLoanView(req.body, parent_loans, disbursement_accounts)

  const form_state = {
    loan: loan_view,
    parent_loans: parent_loans,
    disbursement_accounts: disbursement_accounts,
    loan_form_policy: loan_form_policy,
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
        relations: { disbursement_account: true, transaction: true, parent: true }
      })
      if (!existing) throw new Error('Préstamo no encontrado')
    }

    const isParent = existing
      ? !existing.parent
      : !req.body.parent_id || Number(req.body.parent_id) === 0

    const role: 'parent' | 'child' = isParent ? 'parent' : 'child'

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

      const transactionId = existing.transaction?.id || null

      // 1) Primero borrar el loan (rompe la FK)
      await queryRunner.manager.delete(Loan, existing.id)

      // 2) Luego borrar la transaction si existe
      if (transactionId) {
        await queryRunner.manager.delete(Transaction, transactionId)
      }

      await queryRunner.commitTransaction()
      return res.redirect('/loans')
    }

    /* =========================
       INSERT / UPDATE
    ============================ */
    let loan: Loan

    if (mode === 'insert') {
      const selectedParent = req.body.parent_id
        ? parent_loans.find(c => c.id === Number(req.body.parent_id)) || null
        : null

      const selectedDisbursementAccount = disbursement_accounts.find(
        c => c.id === Number(req.body.disbursement_account_id)
      ) || null

      loan = queryRunner.manager.create(Loan, {
        user: { id: auth_req.user.id } as any,
        name: req.body.name,
        total_amount: 0,
        interest_amount: 0,
        balance: 0,
        start_date: parseLocalDateToUTC(req.body.start_date, timezone),
        disbursement_account: selectedDisbursementAccount,
        parent: selectedParent,
        is_active: true
      })
    } else {
      if (!existing) throw new Error('Préstamo no encontrado')
      loan = existing
    }

    const clean = sanitizeByPolicy(mode, role, req.body)

    if (clean.name !== undefined) loan.name = clean.name
    if (clean.start_date !== undefined) loan.start_date = parseLocalDateToUTC(clean.start_date, timezone)
    if (clean.is_active !== undefined) loan.is_active = clean.is_active === 'true' || clean.is_active === '1'

    if (clean.parent_id !== undefined) {
      const selectedParent = clean.parent_id
        ? parent_loans.find(c => c.id === Number(clean.parent_id)) || null
        : null

      loan.parent = selectedParent
    }

    let newAccount: Account | null = null

    if (clean.disbursement_account_id !== undefined) {
      newAccount = clean.disbursement_account_id
        ? disbursement_accounts.find(c => c.id === Number(clean.disbursement_account_id)) || null
        : null
    }

    if (clean.total_amount !== undefined) {
      const newAmount = Number(clean.total_amount)

      if (mode === 'insert') {
        loan.total_amount = newAmount
        loan.balance = newAmount
      } else {
        const previousAmount = loan.total_amount
        const previousBalance = loan.balance
        const paidAmount = previousAmount - previousBalance

        loan.total_amount = newAmount
        loan.balance = newAmount - paidAmount
      }
    }

    if (mode === 'insert') {
      if (role === 'child') {
        if (!newAccount) throw new Error('Cuenta de desembolso requerida')

        newAccount.balance += loan.total_amount
        await queryRunner.manager.save(newAccount)

        loan.disbursement_account = newAccount

        const trx = queryRunner.manager.create(Transaction, {
          user: { id: auth_req.user.id } as any,
          type: 'income',
          amount: loan.total_amount,
          account: newAccount,
          date: loan.start_date,
          description: loan.name
        })

        await queryRunner.manager.save(trx)
        loan.transaction = trx
      } else {
        loan.total_amount = 0
        loan.balance = 0
        loan.disbursement_account = null as any
        loan.transaction = null as any
      }
    } else {
      if (role === 'child' && newAccount) {
        if (!loan.disbursement_account) { throw new Error('Cuenta de desembolso actual no encontrada') }

        const oldAccount = await queryRunner.manager.findOneByOrFail(Account, {
          id: loan.disbursement_account.id,
          user: { id: auth_req.user.id }
        })

        if (oldAccount.id === newAccount.id) {
          const delta = loan.total_amount - existing!.total_amount
          oldAccount.balance += delta
          await queryRunner.manager.save(oldAccount)
        } else {
          oldAccount.balance -= existing!.total_amount
          newAccount.balance += loan.total_amount
          await queryRunner.manager.save([oldAccount, newAccount])
        }

        loan.disbursement_account = newAccount

        if (loan.transaction?.id) {
          loan.transaction.amount = loan.total_amount
          loan.transaction.date = loan.start_date
          loan.transaction.description = loan.name
          loan.transaction.account = newAccount
          await queryRunner.manager.save(loan.transaction)
        }
      }

      if (role === 'parent') {
        loan.total_amount = 0
        loan.balance = 0
        loan.disbursement_account = null as any
        loan.transaction = null as any
      }
    }

    const errors = await validateLoan(loan, auth_req)
    if (errors) throw { validationErrors: errors }

    await queryRunner.manager.save(loan)
    await queryRunner.commitTransaction()
    return res.redirect('/loans')

  } catch (err: any) {
    await queryRunner.rollbackTransaction()

    logger.error('Error saving loan', {
      userId: auth_req.user.id,
      loan_id,
      mode,
      error: err,
      stack: err?.stack
    })

    const validationErrors = err?.validationErrors || null

    return res.render('layouts/main', {
      title: getTitle(mode),
      view: 'pages/loans/form',
      ...form_state,
      errors: validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
    })
  } finally {
    await queryRunner.release()
  }
}
