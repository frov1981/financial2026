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
import { LoanGroup } from '../../entities/LoanGroup.entity'

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
const buildLoanView = (body: any, loan_group: LoanGroup[], disbursement_accounts: Account[]) => {
  const group_id = body.loan_group_id ? Number(body.loan_group_id) : null
  const group = group_id ? loan_group.find(p => p.id === group_id) || null : null
  const disbursement_id = body.disbursement_account_id ? Number(body.disbursement_account_id) : null
  const disbursement = disbursement_id ? disbursement_accounts.find(a => a.id === disbursement_id) || null : null

  return {
    ...body,
    loan_group: group ? { id: group.id, name: group.name } : null,
    disbursement_account: disbursement ? { id: disbursement.id, name: disbursement.name } : null
  }
}

export const saveLoan: RequestHandler = async (req: Request, res: Response) => {
  logger.info('saveLoan called', { body: req.body, param: req.params })

  const auth_req = req as AuthRequest
  const loan_id = req.body.id ? Number(req.body.id) : undefined
  const mode: LoanFormMode = req.body.mode || 'insert'
  const timezone = auth_req.timezone || 'UTC'

  const loan_group = await getActiveParentLoansByUser(auth_req)
  const disbursement_accounts = await getActiveAccountsByUser(auth_req)

  const loan_view = buildLoanView(req.body, loan_group, disbursement_accounts)

  const form_state = {
    loan: loan_view,
    loan_group,
    disbursement_accounts: disbursement_accounts,
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

      const transactionId = existing.transaction?.id || null

      await queryRunner.manager.delete(Loan, existing.id)
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
      const selectedGroup = loan_group.find(
        g => g.id === Number(req.body.loan_group_id)
      ) || null
      if (!selectedGroup) throw new Error('Grupo de préstamo requerido')

      const selectedDisbursementAccount = disbursement_accounts.find(
        c => c.id === Number(req.body.disbursement_account_id)
      ) || null
      if (!selectedDisbursementAccount) throw new Error('Cuenta de desembolso requerida')

      loan = queryRunner.manager.create(Loan, {
        user: { id: auth_req.user.id } as any,
        loan_group: selectedGroup,
        name: req.body.name,
        total_amount: 0,
        interest_amount: 0,
        balance: 0,
        start_date: parseLocalDateToUTC(req.body.start_date, timezone),
        disbursement_account: selectedDisbursementAccount,
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

    let newAccount: Account | null = loan.disbursement_account || null

    if (clean.disbursement_account_id !== undefined) {
      newAccount = clean.disbursement_account_id
        ? disbursement_accounts.find(c => c.id === Number(clean.disbursement_account_id)) || null
        : null
    }

    if (clean.loan_group_id !== undefined) {
      const selectedGroup = loan_group.find(g => g.id === Number(clean.loan_group_id)) || null
      if (!selectedGroup) throw new Error('Grupo de préstamo requerido')
      loan.loan_group = selectedGroup
    }

    let previousAmount = loan.total_amount
    let previousBalance = loan.balance

    if (clean.total_amount !== undefined) {
      const newAmount = Number(clean.total_amount)

      if (mode === 'insert') {
        loan.total_amount = newAmount
        loan.balance = newAmount
      } else {
												
											
        const paidAmount = previousAmount - previousBalance

        loan.total_amount = newAmount
        loan.balance = newAmount - paidAmount
      }
    }

    if (mode === 'insert') {
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
      if (!loan.disbursement_account) { throw new Error('Cuenta de desembolso actual no encontrada') }
      if (!newAccount) throw new Error('Cuenta de desembolso requerida')

      const oldAccount = await queryRunner.manager.findOneByOrFail(Account, {
        id: loan.disbursement_account.id,
        user: { id: auth_req.user.id }
      })

      if (oldAccount.id === newAccount.id) {
        const delta = loan.total_amount - previousAmount
        oldAccount.balance += delta
        await queryRunner.manager.save(oldAccount)
      } else {
        oldAccount.balance -= previousAmount
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
