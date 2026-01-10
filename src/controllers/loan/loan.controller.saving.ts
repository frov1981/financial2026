import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/datasource'
import { Account } from '../../entities/Account.entity'
import { Loan } from '../../entities/Loan.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/AuthRequest'
import { logger } from '../../utils/logger.util'
import { validateDeleteLoan, validateLoan } from './loan.controller.validator'

export const saveLoan: RequestHandler = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest
  const loanId = req.body.id ? Number(req.body.id) : undefined
  const action = req.body.action || 'save'

  const queryRunner = AppDataSource.createQueryRunner()
  await queryRunner.connect()
  await queryRunner.startTransaction()

  try {
    const loanRepo = queryRunner.manager.getRepository(Loan)
    const accountRepo = queryRunner.manager.getRepository(Account)
    const transactionRepo = queryRunner.manager.getRepository(Transaction)

    let loan: Loan
    let oldLoan: Loan | null = null
    let mode: 'insert' | 'update'

    // =========================
    // SAVE
    // =========================
    if (action === 'save') {
      if (loanId) {
        mode = 'update'

        oldLoan = await loanRepo.findOne({
          where: { id: loanId, user: { id: authReq.user.id } },
          relations: { disbursement_account: true }
        })

        if (!oldLoan) {
          await queryRunner.rollbackTransaction()
          return res.redirect('/loans')
        }

        loan = oldLoan
        loan.name = req.body.name
        loan.total_amount = Number(req.body.total_amount)
        loan.start_date = new Date(req.body.start_date)
        loan.status = req.body.status
        loan.disbursement_account = { id: Number(req.body.disbursement_account_id) } as any

        if (req.body.end_date) {
          loan.end_date = new Date(req.body.end_date)
        }
      } else {
        mode = 'insert'

        loan = loanRepo.create({
          user: { id: authReq.user.id } as any,
          name: req.body.name,
          total_amount: Number(req.body.total_amount),
          balance: Number(req.body.total_amount),
          start_date: new Date(req.body.start_date),
          status: 'active',
          disbursement_account: { id: Number(req.body.disbursement_account_id) } as any
        })
      }

      const errors = await validateLoan(loan, authReq)
      if (errors) {
        await queryRunner.rollbackTransaction()
        return res.render('layouts/main', {
          title: mode === 'insert' ? 'Insertar Préstamo' : 'Editar Préstamo',
          view: 'pages/loans/form',
          loan: { ...req.body },
          errors,
          mode
        })
      }

      // =========================
      // Ajuste de cuenta (delta)
      // =========================
      const account = await accountRepo.findOneByOrFail({
        id: loan.disbursement_account.id
      })

      let delta = loan.total_amount
      if (mode === 'update') {
        delta = loan.total_amount - oldLoan!.total_amount
      }

      account.balance += delta
      await accountRepo.save(account)

      // =========================
      // Transacción financiera
      // =========================
      const trx = transactionRepo.create({
        user: { id: authReq.user.id } as any,
        type: 'income',
        amount: loan.total_amount,
        account,
        date: loan.start_date,
        description: loan.name
      })

      await transactionRepo.save(trx)
      await loanRepo.save(loan)

      await queryRunner.commitTransaction()
      return res.redirect('/loans')
    }

    // =========================
    // DELETE
    // =========================
    if (action === 'delete') {
      const existing = await loanRepo.findOne({
        where: { id: loanId, user: { id: authReq.user.id } },
        relations: { disbursement_account: true }
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
          errors,
          mode: 'delete'
        })
      }

      // =========================
      // Reverso de cuenta
      // =========================
      const account = await accountRepo.findOneByOrFail({
        id: existing.disbursement_account.id
      })

      account.balance -= existing.total_amount
      await accountRepo.save(account)

      await loanRepo.delete(existing.id)

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
