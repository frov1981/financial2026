import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Account } from '../../entities/Account.entity'
import { Loan } from '../../entities/Loan.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/auth-request'
import { logger } from '../../utils/logger.util'
import { getActiveAccountsByUser } from '../transaction/transaction.auxiliar'
import { validateDeleteLoan, validateLoan } from './loan.validator'

export const saveLoan: RequestHandler = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest
  const loanId = req.body.id ? Number(req.body.id) : undefined
  const action = req.body.action || 'save'

  const disbursement_accounts = await getActiveAccountsByUser(authReq)
  const queryRunner = AppDataSource.createQueryRunner()

  await queryRunner.connect()
  await queryRunner.startTransaction()

  try {
    const loanRepo = queryRunner.manager.getRepository(Loan)

    let loan: Loan
    let mode: 'insert' | 'update'

    // =========================
    // SAVE (INSERT / UPDATE)
    // =========================
    if (action === 'save') {
      if (loanId) {
        // =========================
        // UPDATE
        // =========================
        mode = 'update'

        const oldLoan = await loanRepo.findOne({
          where: { id: loanId, user: { id: authReq.user.id } },
          relations: { disbursement_account: true, transaction: true }
        })

        if (!oldLoan) {
          await queryRunner.rollbackTransaction()
          return res.redirect('/loans')
        }

        // ===== Valores previos =====
        const previousAmount = oldLoan.total_amount
        const previousBalance = oldLoan.balance
        const previousAccountId = oldLoan.disbursement_account.id

        // ===== Cuentas =====
        const oldAccount = await queryRunner.manager.findOneByOrFail(Account, {
          id: previousAccountId,
          user: { id: authReq.user.id }
        })

        const newAccount = await queryRunner.manager.findOneByOrFail(Account, {
          id: Number(req.body.disbursement_account_id),
          user: { id: authReq.user.id }
        })

        // =========================
        // Actualizar préstamo
        // =========================
        loan = oldLoan
        loan.name = req.body.name
        loan.total_amount = Number(req.body.total_amount)
        loan.start_date = new Date(req.body.start_date)
        loan.is_active = req.body.is_active === 'true'
        if (req.body.end_date) loan.end_date = new Date(req.body.end_date)

        // =========================
        // Recalcular balance del préstamo
        // =========================
        const paidAmount = previousAmount - previousBalance
        loan.balance = loan.total_amount - paidAmount

        // =========================
        // Ajuste de balances de cuentas
        // =========================
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

        // =========================
        // Actualizar transacción
        // =========================
        if (loan.transaction?.id) {
          loan.transaction.amount = loan.total_amount
          loan.transaction.date = loan.start_date
          loan.transaction.description = loan.name
          loan.transaction.account = newAccount
          await queryRunner.manager.save(loan.transaction)
        }

      } else {
        // =========================
        // INSERT
        // =========================
        mode = 'insert'

        const account = await queryRunner.manager.findOneByOrFail(Account, {
          id: Number(req.body.disbursement_account_id),
          user: { id: authReq.user.id }
        })

        const amount = Number(req.body.total_amount)
        account.balance += amount
        await queryRunner.manager.save(account)

        loan = queryRunner.manager.create(Loan, {
          user: { id: authReq.user.id },
          name: req.body.name,
          total_amount: amount,
          balance: amount,
          start_date: new Date(req.body.start_date),
          is_active: true,
          disbursement_account: account
        })

        const trx = queryRunner.manager.create(Transaction, {
          user: { id: authReq.user.id },
          type: 'income',
          amount,
          account,
          date: loan.start_date,
          description: loan.name
        })

        await queryRunner.manager.save(trx)
        loan.transaction = trx
      }

      // =========================
      // Validación
      // =========================
      const errors = await validateLoan(loan, authReq)
      if (errors) {
        await queryRunner.rollbackTransaction()
        return res.render('layouts/main', {
          title: mode === 'insert' ? 'Insertar Préstamo' : 'Editar Préstamo',
          view: 'pages/loans/form',
          loan: { ...req.body },
          disbursement_accounts,
          errors,
          mode
        })
      }

      await queryRunner.manager.save(loan)
      await queryRunner.commitTransaction()
      return res.redirect('/loans')
    }

    // =========================
    // DELETE
    // =========================
    if (action === 'delete') {
      const existing = await loanRepo.findOne({
        where: { id: loanId, user: { id: authReq.user.id } },
        relations: { disbursement_account: true, transaction: true }
      })

      if (!existing) {
        await queryRunner.rollbackTransaction()
        return res.redirect('/loans')
      }

      const errors = await validateDeleteLoan(existing, authReq)
      if (errors) {
        await queryRunner.rollbackTransaction()
        return res.render('layouts/main', {
          title: 'Eliminar Préstamo',
          view: 'pages/loans/form',
          loan: { ...req.body },
          disbursement_accounts,
          errors,
          mode: 'delete'
        })
      }

      const account = await queryRunner.manager.findOneByOrFail(Account, {
        id: existing.disbursement_account.id,
        user: { id: authReq.user.id }
      })

      account.balance -= existing.total_amount
      await queryRunner.manager.save(account)

      await queryRunner.manager.delete(Loan, existing.id)

      if (existing.transaction?.id) {
        await queryRunner.manager.delete(Transaction, existing.transaction.id)
      }

      await queryRunner.commitTransaction()
      return res.redirect('/loans')
    }

  } catch (err) {
    await queryRunner.rollbackTransaction()
    logger.error('Error saving loan', err)
    res.status(500).send('Error interno')
  } finally {
    await queryRunner.release()
  }
}
