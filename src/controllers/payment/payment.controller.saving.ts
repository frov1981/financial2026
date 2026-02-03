import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/datasource'
import { Account } from '../../entities/Account.entity'
import { Loan } from '../../entities/Loan.entity'
import { LoanPayment } from '../../entities/LoanPayment.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/AuthRequest'
import { logger } from '../../utils/logger.util'
import { getActiveAccountsByUser } from '../transaction/transaction.controller.auxiliar'
import { validateDeletePayment, validateSavePayment } from './payment.controller.validator'
import { parseLocalDateToUTC } from '../../utils/date.util'

/* ============================
   Helpers de cálculo
============================ */

const getTotal = (p: LoanPayment) => p.principal_amount + p.interest_amount

const applyLoanDelta = (loan: Loan, oldPrincipal: number, newPrincipal: number) => {
    const delta = newPrincipal - oldPrincipal
    loan.balance -= delta
}

const applyAccountDelta = (account: Account, oldTotal: number, newTotal: number) => {
    const delta = newTotal - oldTotal
    account.balance -= delta
}

/* ============================
   Controller
============================ */

export const savePayment: RequestHandler = async (req: Request, res: Response) => {
    logger.debug('savePayment called', { body: req.body, param: req.params })

    const authReq = req as AuthRequest
    const paymentId = req.params.id ? Number(req.params.id) : req.body.id ? Number(req.body.id) : undefined
    const loanId = req.body.loan_id ? Number(req.body.loan_id) : undefined
    const action = req.body.action || 'save'
    const timezone = String(req.body.timezone || 'UTC')

    const accounts = await getActiveAccountsByUser(authReq)
    const formState = {
        payment: { ...req.body },
        loan_id: loanId,
        accounts,
        mode: action === 'delete' ? 'delete' : paymentId ? 'update' : 'insert'
    }

    const queryRunner = AppDataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
        if (!loanId) throw new Error('Préstamo es requerido')

        const loanRepo = queryRunner.manager.getRepository(Loan)
        const paymentRepo = queryRunner.manager.getRepository(LoanPayment)
        const transactionRepo = queryRunner.manager.getRepository(Transaction)
        const accountRepo = queryRunner.manager.getRepository(Account)

        const loan = await loanRepo.findOneByOrFail({ id: loanId })

        /* ============================
           DELETE
        ============================ */

        if (action === 'delete') {
            if (!paymentId) throw new Error('Pago es requerido para eliminar')

            const payment = await paymentRepo.findOne({
                where: { id: paymentId },
                relations: { transaction: true, account: true, loan: true }
            })

            if (!payment) throw new Error('Pago no encontrado')

            const errors = await validateDeletePayment(authReq, payment)
            if (errors) throw { validationErrors: errors }

            const total = getTotal(payment)

            loan.balance += payment.principal_amount
            await loanRepo.save(loan)

            payment.account.balance += total
            await accountRepo.save(payment.account)

            await paymentRepo.delete(payment.id)

            if (payment.transaction) {
                await transactionRepo.delete(payment.transaction.id)
            }

            await queryRunner.commitTransaction()
            return res.redirect(`/payments/${loanId}/loan`)
        }

        /* ============================
           INSERT / UPDATE
        ============================ */

        const accountId = Number(req.body.account_id)
        if (!accountId) throw new Error('Cuenta es requerida')

        const account = await accountRepo.findOneByOrFail({
            id: accountId,
            user: { id: authReq.user.id }
        })

        const note = String(req.body.note || '')
        const principal_amount = Number(req.body.principal_amount || 0)
        const interest_amount = Number(req.body.interest_amount || 0)

        const payment_date = req.body.payment_date
            ? parseLocalDateToUTC(req.body.payment_date, timezone)
            : new Date()

        let payment: LoanPayment
        let oldPayment: LoanPayment | null = null

        let oldPrincipal = 0
        let oldTotal = 0

        if (paymentId) {
            oldPayment = await paymentRepo.findOne({
                where: { id: paymentId },
                relations: { transaction: true, account: true }
            })

            if (!oldPayment) throw new Error('Pago no encontrado')

            oldPrincipal = oldPayment.principal_amount
            oldTotal = getTotal(oldPayment)

            payment = oldPayment
            payment.note = note
            payment.principal_amount = principal_amount
            payment.interest_amount = interest_amount
            payment.payment_date = payment_date
            payment.account = account
            payment.loan = loan
        } else {
            payment = paymentRepo.create({
                loan,
                note,
                principal_amount,
                interest_amount,
                payment_date,
                account
            })
        }

        const errors = await validateSavePayment(authReq, payment, oldPayment)
        if (errors) throw { validationErrors: errors }

        /* ============================
           UPDATE LOAN
        ============================ */

        if (!oldPayment) {
            loan.balance -= payment.principal_amount
        } else {
            applyLoanDelta(loan, oldPrincipal, payment.principal_amount)
        }

        await loanRepo.save(loan)

        /* ============================
           UPDATE ACCOUNT
        ============================ */

        const newTotal = getTotal(payment)

        if (!oldPayment) {
            account.balance -= newTotal
        } else {
            applyAccountDelta(account, oldTotal, newTotal)
        }

        await accountRepo.save(account)

        /* ============================
           TRANSACTION
        ============================ */

        let trx: Transaction

        if (oldPayment && oldPayment.transaction) {
            trx = oldPayment.transaction
            trx.amount = newTotal
            trx.account = account
            trx.date = payment.payment_date
            trx.description = payment.note
        } else {
            trx = transactionRepo.create({
                user: { id: authReq.user.id } as any,
                type: 'expense',
                amount: newTotal,
                account,
                date: payment.payment_date,
                description: payment.note
            })
        }

        await transactionRepo.save(trx)

        payment.transaction = trx
        await paymentRepo.save(payment)

        await queryRunner.commitTransaction()
        return res.redirect(`/payments/${loanId}/loan`)
    } catch (err: any) {
        await queryRunner.rollbackTransaction()
        logger.error('Error saving payment', { userId: authReq.user.id, paymentId: paymentId, loanId: loanId, error: err, stack: err?.stack })

        const validationErrors = err?.validationErrors || null

        return res.render('layouts/main', {
            title: formState.mode === 'delete' ? 'Eliminar Pago' : formState.mode === 'insert' ? 'Insertar Pago' : 'Editar Pago',
            view: 'pages/payments/form',
            ...formState,
            errors: validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
        })

    } finally {
        await queryRunner.release()
    }
}
