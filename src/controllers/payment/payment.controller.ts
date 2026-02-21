import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from "../../config/typeorm.datasource"
import { Loan } from "../../entities/Loan.entity"
import { LoanPayment } from '../../entities/LoanPayment.entity'
import { AuthRequest } from "../../types/auth-request"
import { formatDateForInputLocal } from '../../utils/date.util'
import { logger } from "../../utils/logger.util"
import { getNextValidTransactionDate } from '../transaction/transaction.auxiliar'
import { getActiveAccountsByUser } from '../../services/populate-items.service'
export { savePayment as apiForSavingAccount } from './payment.saving'

export const apiForGettingPayments: RequestHandler = async (req: Request, res: Response) => {
    logger.debug(`${apiForGettingPayments.name}-Start`)
    const auth_req = req as AuthRequest
    const loan_id = Number(req.params.loan_id)

    try {
        const payments = await AppDataSource.getRepository(LoanPayment).find({
            where: { loan: { id: loan_id } },
            relations: { account: true },
            order: { payment_date: 'DESC' }
        })

        logger.debug(`${apiForGettingPayments.name}-Payments found: [${payments.length}]`)
        res.json(payments)
    } catch (error) {
        logger.error(`${apiForGettingPayments.name}-Error. `, error)
        res.status(500).json({ error: 'Error al listar pagos' })
    } finally {
        logger.debug(`${apiForGettingPayments.name}-End`)
    }
}

export const routeToPagePayment: RequestHandler = async (req, res) => {
    const auth_req = req as AuthRequest
    const loan_id = Number(req.params.id)

    const loan = await AppDataSource.getRepository(Loan).findOne({
        where: { id: loan_id }
    })

    if (!loan) {
        return res.redirect('/loans')
    }

    res.render('layouts/main', {
        title: 'Pagos',
        view: 'pages/payments/index',
        USER_ID: auth_req.user?.id || 'guest',
        LOAN_ID: loan_id,
        loan
    })
}

export const routeToFormInsertPayment: RequestHandler = async (req: Request, res: Response) => {
    const mode = 'insert'
    const auth_req = req as AuthRequest
    const timezone = auth_req.timezone || 'UTC'
    const loan_id = Number(req.params.loan_id)

    const accounts = await getActiveAccountsByUser(auth_req)
    const default_date = await getNextValidTransactionDate(auth_req)
    logger.debug(`${routeToFormInsertPayment.name}-Routing for inserting payment form with timezone: [${timezone}]`)
    res.render(
        'layouts/main',
        {
            title: 'Insertar Pago',
            view: 'pages/payments/form',
            payment: {
                payment_date: formatDateForInputLocal(default_date, timezone),
                principal_paid: '0.00',
                interest_paid: '0.00',
            },
            loan_id: loan_id,
            errors: {},
            accounts,
            mode,
        })
}

export const routeToFormUpdatePayment: RequestHandler = async (req: Request, res: Response) => {
    const mode = 'update'
    const auth_req = req as AuthRequest
    const payment_id = Number(req.params.id)
    const timezone = auth_req.timezone || 'UTC'

    if (!Number.isInteger(payment_id) || payment_id <= 0) {
        return res.redirect('/payments')
    }

    const repo_payment = AppDataSource.getRepository(LoanPayment)
    const payment = await repo_payment.findOne({
        where: { id: payment_id },
        relations: { loan: true, account: true },
    })

    if (!payment) {
        return res.redirect('/payments')
    }

    const accounts = await getActiveAccountsByUser(auth_req)

    logger.debug(`${routeToFormUpdatePayment.name}-Routing for updating payment form with timezone: [${timezone}]`)
    res.render(
        'layouts/main',
        {
            title: 'Editar Pago',
            view: 'pages/payments/form',
            payment: {
                id: payment.id,
                note: payment.note,
                principal_paid: payment.principal_paid,
                interest_paid: payment.interest_paid,
                payment_date: formatDateForInputLocal(payment.payment_date, timezone),
                account_id: payment.account ? payment.account.id : '',
                account_name: payment.account ? payment.account.name : '',
            },
            loan_id: payment.loan.id,
            errors: {},
            accounts,
            mode
        })
}

export const routeToFormClonePayment: RequestHandler = async (req: Request, res: Response) => {
    const mode = 'insert'
    const auth_req = req as AuthRequest
    const payment_id = Number(req.params.id)
    const timezone = auth_req.timezone || 'UTC'

    if (!Number.isInteger(payment_id) || payment_id <= 0) {
        return res.redirect('/payments')
    }

    const repo_payment = AppDataSource.getRepository(LoanPayment)
    const payment = await repo_payment.findOne({
        where: { id: payment_id },
        relations: { loan: true, account: true }
    })

    if (!payment) {
        return res.redirect('/loans')
    }

    const accounts = await getActiveAccountsByUser(auth_req)
    const default_date = await getNextValidTransactionDate(auth_req)

    logger.debug(`${routeToFormClonePayment.name}-Routing for cloning payment form with timezone: [${timezone}]`)
    res.render(
        'layouts/main',
        {
            title: 'Clonar Pago',
            view: 'pages/payments/form',
            payment: {
                note: payment.note ?? '',
                principal_paid: payment.principal_paid,
                interest_paid: payment.interest_paid,
                payment_date: formatDateForInputLocal(default_date, timezone),
                account_id: payment.account ? payment.account.id : '',
                account_name: payment.account ? payment.account.name : '',
            },
            loan_id: payment.loan.id,
            errors: {},
            accounts,
            mode
        }
    )
}

export const routeToFormDeletePayment: RequestHandler = async (req: Request, res: Response) => {
    const mode = 'delete'
    const auth_req = req as AuthRequest
    const payment_id = Number(req.params.id)
    const timezone = auth_req.timezone || 'UTC'

    if (!Number.isInteger(payment_id) || payment_id <= 0) {
        return res.redirect('/payments')
    }

    const repo_payment = AppDataSource.getRepository(LoanPayment)
    const payment = await repo_payment.findOne({
        where: { id: payment_id },
        relations: { loan: true, account: true },
    })

    if (!payment) {
        return res.redirect('/payments')
    }

    const accounts = await getActiveAccountsByUser(auth_req)

    logger.debug(`${routeToFormDeletePayment.name}-Routing for deleting payment form with timezone: [${timezone}]`)
    res.render(
        'layouts/main',
        {
            title: 'Eliminar Pago',
            view: 'pages/payments/form',
            payment: {
                id: payment.id,
                note: payment.note,
                principal_paid: payment.principal_paid,
                interest_paid: payment.interest_paid,
                payment_date: formatDateForInputLocal(payment.payment_date, timezone),
                account_id: payment.account ? payment.account.id : '',
                account_name: payment.account ? payment.account.name : '',
            },
            loan_id: payment.loan.id,
            errors: {},
            accounts,
            mode
        })
}


