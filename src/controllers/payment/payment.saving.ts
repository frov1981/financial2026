import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Account } from '../../entities/Account.entity'
import { Loan } from '../../entities/Loan.entity'
import { LoanPayment } from '../../entities/LoanPayment.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/auth-request'
import { parseLocalDateToUTC } from '../../utils/date.util'
import { logger } from '../../utils/logger.util'
import { validateDeletePayment, validateSavePayment } from './payment.validator'
import { getActiveAccountsByUser } from '../../services/populate-items.service'
import { KpiCacheService } from '../../services/kpi-cache.service'

/* ============================
   Helpers de cálculo
============================ */

const getTotal = (p: LoanPayment) => p.principal_paid + p.interest_paid

const applyLoanDelta = (loan: Loan, old_principal: number, new_principal: number) => {
    const delta = new_principal - old_principal
    loan.balance -= delta
}

const applyPrincipalDelta = (loan: Loan, old_principal: number, new_principal: number) => {
    const delta = new_principal - old_principal
    loan.principal_paid += delta
}

const applyInterestDelta = (loan: Loan, old_interest: number, new_interest: number) => {
    const delta = new_interest - old_interest
    loan.interest_paid += delta
}

const applyAccountDelta = (account: Account, old_total: number, new_total: number) => {
    const delta = new_total - old_total
    account.balance -= delta
}

/* ============================
   Controller
============================ */

export const savePayment: RequestHandler = async (req: Request, res: Response) => {
    logger.debug(`${savePayment.name}-Start`)
    logger.info('savePayment called', { body: req.body, param: req.params })

    const auth_req = req as AuthRequest
    const payment_id = req.params.id ? Number(req.params.id) : req.body.id ? Number(req.body.id) : undefined
    const loan_id = req.body.loan_id ? Number(req.body.loan_id) : undefined
    const action = req.body.action || 'save'
    const timezone = auth_req.timezone || 'UTC'
    logger.debug(`${savePayment.name}-Timezone for saving payment: [${timezone}]`)

    const accounts = await getActiveAccountsByUser(auth_req)
    const form_state = {
        payment: { ...req.body },
        loan_id: loan_id,
        accounts,
        mode: action === 'delete' ? 'delete' : payment_id ? 'update' : 'insert'
    }

    const queryRunner = AppDataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
        if (!loan_id) throw new Error('Préstamo es requerido')

        const loan_repo = queryRunner.manager.getRepository(Loan)
        const payment_repo = queryRunner.manager.getRepository(LoanPayment)
        const transaction_repo = queryRunner.manager.getRepository(Transaction)
        const account_repo = queryRunner.manager.getRepository(Account)

        const loan = await loan_repo.findOneByOrFail({ id: loan_id })

        /* ============================
           DELETE
        ============================ */

        if (action === 'delete') {
            if (!payment_id) throw new Error('Pago es requerido para eliminar')

            const payment = await payment_repo.findOne({
                where: { id: payment_id },
                relations: { transaction: true, account: true, loan: true }
            })

            if (!payment) throw new Error('Pago no encontrado')

            const errors = await validateDeletePayment(auth_req, payment)
            if (errors) throw { validation_errors: errors }

            const total = getTotal(payment)

            loan.balance += payment.principal_paid
            loan.principal_paid -= payment.principal_paid
            loan.interest_paid -= payment.interest_paid

            // Si el ultimo pago es reversado, el prestamo se reactiva
            if (loan.balance > 0) {
                loan.is_active = true
            }

            await loan_repo.save(loan)

            payment.account.balance += total
            await account_repo.save(payment.account)

            await payment_repo.delete(payment.id)

            if (payment.transaction) {
                await transaction_repo.delete(payment.transaction.id)
            }

            await queryRunner.commitTransaction()
            KpiCacheService.recalcMonthlyKPIs(payment.transaction).catch(err => logger.error(`${savePayment.name}-Error. `, { err }))
            return res.redirect(`/payments/${loan_id}/loan`)
        }

        /* ============================
           INSERT / UPDATE
        ============================ */

        const account_id = Number(req.body.account_id)
        if (!account_id) throw new Error('Cuenta es requerida')

        const account = await account_repo.findOneByOrFail({
            id: account_id,
            user: { id: auth_req.user.id }
        })

        const note = String(req.body.note || '')
        const principal_paid = Number(req.body.principal_paid || 0)
        const interest_paid = Number(req.body.interest_paid || 0)

        const payment_date = req.body.payment_date ? parseLocalDateToUTC(req.body.payment_date, timezone) : new Date()

        let payment: LoanPayment
        let old_payment: LoanPayment | null = null

        let old_principal = 0
        let old_total = 0

        if (payment_id) {
            old_payment = await payment_repo.findOne({
                where: { id: payment_id },
                relations: { transaction: true, account: true }
            })

            if (!old_payment) throw new Error('Pago no encontrado')

            old_principal = old_payment.principal_paid
            old_total = getTotal(old_payment)

            payment = old_payment
            payment.note = note
            payment.principal_paid = principal_paid
            payment.interest_paid = interest_paid
            payment.payment_date = payment_date
            payment.account = account
            payment.loan = loan
        } else {
            payment = payment_repo.create({
                loan,
                note,
                principal_paid,
                interest_paid,
                payment_date,
                account
            })
        }

        const errors = await validateSavePayment(auth_req, payment, old_payment)
        if (errors) throw { validation_errors: errors }

        /* ============================
           UPDATE LOAN
        ============================ */

        if (!old_payment) {
            loan.balance -= payment.principal_paid
            loan.principal_paid += payment.principal_paid
            loan.interest_paid += payment.interest_paid
        } else {
            applyLoanDelta(loan, old_principal, payment.principal_paid)
            applyPrincipalDelta(loan, old_principal, payment.principal_paid)
            applyInterestDelta(loan, old_payment.interest_paid, payment.interest_paid)
        }

        // Si el balance es menor a cero, inactivar el prestamo
        if (loan.balance <= 0) {
            loan.balance = 0
            loan.is_active = false
        } else {
            loan.is_active = true
        }

        await loan_repo.save(loan)

        /* ============================
           UPDATE ACCOUNT
        ============================ */

        const new_total = getTotal(payment)

        if (!old_payment) {
            account.balance -= new_total
        } else {
            applyAccountDelta(account, old_total, new_total)
        }

        await account_repo.save(account)

        /* ============================
           TRANSACTION
        ============================ */

        let trx: Transaction

        if (old_payment && old_payment.transaction) {
            trx = old_payment.transaction
            trx.amount = new_total
            trx.account = account
            trx.date = payment.payment_date
            trx.description = payment.note
        } else {
            trx = transaction_repo.create({
                user: { id: auth_req.user.id } as any,
                type: 'expense',
                amount: new_total,
                account,
                date: payment.payment_date,
                description: payment.note
            })
        }

        await transaction_repo.save(trx)

        payment.transaction = trx
        await payment_repo.save(payment)

        await queryRunner.commitTransaction()
        KpiCacheService.recalcMonthlyKPIs(payment.transaction).catch(err => logger.error(`${savePayment.name}-Error. `, { err }))
        return res.redirect(`/payments/${loan_id}/loan`)
    } catch (err: any) {
        await queryRunner.rollbackTransaction()
        logger.error(`${savePayment.name}-Error. `, { user_id: auth_req.user.id, payment_id: payment_id, loan_id: loan_id, error: err, stack: err?.stack })

        const validation_errors = err?.validation_errors || null

        return res.render('layouts/main', {
            title: form_state.mode === 'delete' ? 'Eliminar Pago' : form_state.mode === 'insert' ? 'Insertar Pago' : 'Editar Pago',
            view: 'pages/payments/form',
            ...form_state,
            errors: validation_errors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
        })

    } finally {
        await queryRunner.release()
        logger.debug(`${savePayment.name}-End`)
    }
}
