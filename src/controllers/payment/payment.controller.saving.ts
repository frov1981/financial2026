import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/datasource'
import { AuthRequest } from '../../types/AuthRequest'
import { logger } from '../../utils/logger.util'
import { LoanPayment } from '../../entities/LoanPayment.entity'
import { Loan } from '../../entities/Loan.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { validateDeletePayment, validateSavePayment } from './payment.controller.validator'
import { getActiveAccountsByUser } from '../transaction/transaction.controller.auxiliar'

export const savePayment: RequestHandler = async (req: Request, res: Response) => {
    const authReq = req as AuthRequest
    const loanId = Number(req.body.loan_id)
    const txId = req.body.id ? Number(req.body.id) : undefined
    const action = req.body.action || 'save'
    const accounts = await getActiveAccountsByUser(authReq)

    const queryRunner = AppDataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
        const paymentRepo = queryRunner.manager.getRepository(LoanPayment)
        const loanRepo = queryRunner.manager.getRepository(Loan)
        const transactionRepo = queryRunner.manager.getRepository(Transaction)

        const loan = await loanRepo.findOneByOrFail({ id: loanId })

        let payment: LoanPayment
        let oldPayment: LoanPayment | null = null
        let mode

        if (action === 'save') {
            if (txId) {
                oldPayment = await paymentRepo.findOne({
                    where: { id: txId },
                    relations: { transaction: true }
                })

                if (!oldPayment) {
                    throw new Error('Pago no encontrado')
                }

                mode = 'update'

                payment = oldPayment
                payment.note = req.body.note
                payment.principal_amount = Number(req.body.principal_amount)
                payment.interest_amount = Number(req.body.interest_amount)
                payment.payment_date = new Date(req.body.payment_date)
                payment.account = { id: Number(req.body.account_id) } as any
            } else {
                mode = 'insert'

                payment = paymentRepo.create({
                    loan,
                    note: req.body.note,
                    principal_amount: Number(req.body.principal_amount),
                    interest_amount: Number(req.body.interest_amount),
                    payment_date: new Date(req.body.payment_date),
                    account: { id: Number(req.body.account_id) } as any
                })
            }

            const errors = await validateSavePayment(payment, authReq, oldPayment)

            if (errors) {
                await queryRunner.rollbackTransaction()
                return res.render('layouts/main', {
                    title: mode === 'insert' ? 'Insertar Pago' : 'Editar Pago',
                    view: 'pages/payments/form',
                    payment: { ...req.body, loan_id: loanId },
                    accounts,
                    errors,
                    mode
                })
            }

            // =========================
            // Ajuste de balance del loan
            // =========================

            if (mode === 'insert') {
                loan.balance -= payment.principal_amount
            } else {
                const delta = payment.principal_amount - oldPayment!.principal_amount
                loan.balance -= delta
            }

            await loanRepo.save(loan)

            // =========================
            // Transaction financiera
            // =========================

            const totalAmount =
                payment.principal_amount + payment.interest_amount

            let trx: Transaction

            if (mode === 'update' && oldPayment!.transaction) {
                trx = oldPayment!.transaction
                trx.amount = totalAmount
                trx.account = payment.account
                trx.date = payment.payment_date
                trx.description = payment.note
            } else {
                trx = transactionRepo.create({
                    user: { id: authReq.user.id } as any,
                    type: 'expense',
                    amount: totalAmount,
                    account: payment.account,
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
                where: { id: txId },
                relations: { transaction: true }
            })

            if (!payment) {
                throw new Error('Pago no encontrado')
            }

            const errors = await validateDeletePayment(payment, authReq)

            if (errors) {
                await queryRunner.rollbackTransaction()
                return res.render('layouts/main', {
                    title: 'Eliminar Pago',
                    view: 'pages/payments/form',
                    payment: req.body,
                    accounts,
                    errors,
                    mode: 'delete'
                })
            }

            loan.balance += payment.principal_amount
            await loanRepo.save(loan)

            if (payment.transaction) {
                await transactionRepo.delete(payment.transaction.id)
            }

            await paymentRepo.delete(payment.id)

            await queryRunner.commitTransaction()
            return res.redirect(`/payments/${loanId}`)
        }

    } catch (err) {
        await queryRunner.rollbackTransaction()
        logger.error('Error saving payment', err)
        res.status(500).send('Error interno')
    } finally {
        await queryRunner.release()
    }
}
