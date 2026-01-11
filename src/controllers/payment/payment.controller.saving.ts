import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/datasource'
import { Account } from '../../entities/Account.entity'
import { Loan } from '../../entities/Loan.entity'
import { LoanPayment } from '../../entities/LoanPayment.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/AuthRequest'
import { logger } from '../../utils/logger.util'
import { getDateTimeFromBody, getNumberFromBody, getStringFromBody } from '../../utils/req.params.util'
import { getActiveAccountsByUser } from '../transaction/transaction.controller.auxiliar'
import { validateDeletePayment, validateSavePayment } from './payment.controller.validator'

export const savePayment: RequestHandler = async (req: Request, res: Response) => {
    const authReq = req as AuthRequest
    const loanId = getNumberFromBody(req, 'loan_id')
    const paymentId = getNumberFromBody(req, 'id')
    const action = getStringFromBody(req, 'action') || 'save'


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
        const loanRepo = queryRunner.manager.getRepository(Loan)
        const paymentRepo = queryRunner.manager.getRepository(LoanPayment)
        const transactionRepo = queryRunner.manager.getRepository(Transaction)
        const accountRepo = queryRunner.manager.getRepository(Account)

        const loan = await loanRepo.findOneByOrFail({ id: loanId })
        let payment: LoanPayment
        let oldPayment: LoanPayment | null = null
        let mode: 'insert' | 'update' | 'delete'

        // =========================
        // SAVE (INSERT / UPDATE)
        // =========================
        if (action === 'save') {
            const account = await accountRepo.findOneByOrFail({
                id: getNumberFromBody(req, 'account_id'),
                user: { id: authReq.user.id }
            })

            let oldTotal = 0
            let oldPrincipal = 0

            if (paymentId) {
                // -------- UPDATE --------
                oldPayment = await paymentRepo.findOne({
                    where: { id: paymentId },
                    relations: { transaction: true, account: true }
                })
                if (!oldPayment) throw new Error('Pago no encontrado')

                mode = 'update'
                oldPrincipal = oldPayment.principal_amount
                oldTotal = oldPayment.principal_amount + oldPayment.interest_amount

                payment = oldPayment
                payment.note = getStringFromBody(req, 'note') || ''
                payment.principal_amount = getNumberFromBody(req, 'principal_amount') || 0
                payment.interest_amount = getNumberFromBody(req, 'interest_amount') || 0
                payment.payment_date = getDateTimeFromBody(req, 'payment_date') || new Date()
                payment.account = account
                payment.loan = loan
            } else {
                // -------- INSERT --------
                mode = 'insert'
                payment = paymentRepo.create({
                    loan,
                    note: getStringFromBody(req, 'note') || '',
                    principal_amount: getNumberFromBody(req, 'principal_amount') || 0,
                    interest_amount: getNumberFromBody(req, 'interest_amount') || 0,
                    payment_date: getDateTimeFromBody(req, 'payment_date') || new Date(),
                    account
                })
            }

            logger.info('Before saving payment', { userId: authReq.user.id, mode, payment })
            const errors = await validateSavePayment(authReq, payment, oldPayment)
            if (errors) {
                await queryRunner.rollbackTransaction()
                return res.render('layouts/main', {
                    title: mode === 'insert' ? 'Insertar Pago' : 'Editar Pago',
                    view: 'pages/payments/form',
                    ...formState,
                    errors,
                })
            }

            // =========================
            // UPDATE LOAN BALANCE
            // =========================
            if (mode === 'insert') {
                loan.balance -= payment.principal_amount
            } else {
                const deltaPrincipal = payment.principal_amount - oldPrincipal
                loan.balance -= deltaPrincipal
            }
            await loanRepo.save(loan)

            // =========================
            // UPDATE ACCOUNT BALANCE
            // =========================
            const newTotal = payment.principal_amount + payment.interest_amount

            if (mode === 'insert') {
                account.balance -= newTotal
            } else {
                account.balance -= (newTotal - oldTotal)
            }
            await accountRepo.save(account)

            // =========================
            // TRANSACTION
            // =========================
            let trx: Transaction
            if (mode === 'update' && oldPayment!.transaction) {
                trx = oldPayment!.transaction
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
            return res.redirect(`/payments/${loanId}`)
        }

        // =========================
        // DELETE
        // =========================
        if (action === 'delete') {
            const payment = await paymentRepo.findOne({
                where: { id: paymentId },
                relations: { transaction: true, account: true, loan: true }
            })
            if (!payment) throw new Error('Pago no encontrado')

            mode = 'delete'
            logger.info('Before deleting payment', { userId: authReq.user.id, mode, payment })
            const errors = await validateDeletePayment(authReq, payment)
            if (errors) {
                await queryRunner.rollbackTransaction()
                return res.render('layouts/main', {
                    title: 'Eliminar Pago',
                    view: 'pages/payments/form',
                    ...formState,
                    errors,
                })
            }

            const total = payment.principal_amount + payment.interest_amount
            // Revert loan
            loan.balance += payment.principal_amount
            await loanRepo.save(loan)
            // Revert account
            payment.account.balance += total
            await accountRepo.save(payment.account)
            // Delete payment
            await paymentRepo.delete(payment.id)
            // Delete transaction
            if (payment.transaction) {
                await transactionRepo.delete(payment.transaction.id)
            }
            await queryRunner.commitTransaction()
            return res.redirect(`/payments/${loanId}`)
        }
    } catch (err) {
        await queryRunner.rollbackTransaction()
        logger.error('Error saving payment', err)

        return res.render('layouts/main', {
            title: 'Error',
            view: 'pages/payments/form',
            ...formState,
            errors: { general: 'Ocurrió un error inesperado. Intenta nuevamente. O usa la opción de "Recalcular"' }
        })
    } finally {
        await queryRunner.release()
    }
}
