import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from "../../config/typeorm.datasource"
import { Loan } from "../../entities/Loan.entity"
import { LoanPayment } from '../../entities/LoanPayment.entity'
import { AuthRequest } from "../../types/auth-request"
import { formatDateForInputLocal } from '../../utils/date.util'
import { logger } from "../../utils/logger.util"
import { getActiveAccountsByUser, getActiveCategoriesForPaymentsByUser } from '../../services/populate-items.service'
import { getNextValidTransactionDate } from '../../services/next-valid-trx-date.service'
import { paymentFormMatrix } from '../../policies/payment-form.policy'
export { savePayment as apiForSavingAccount } from './payment.saving'

type PaymentFormViewParams = {
    title: string
    view: string
    payment: any
    errors: any
    accounts: any[]
    loan_id: number
    mode: 'insert' | 'update' | 'delete'
    auth_req: AuthRequest
}

const renderPaymentForm = async (res: Response, params: PaymentFormViewParams) => {
    const { title, view, payment, errors, accounts, loan_id, mode, auth_req } = params

    const payment_form_policy = paymentFormMatrix[mode]
    const active_expense_categories = await getActiveCategoriesForPaymentsByUser(auth_req)

    return res.render('layouts/main', {
        title,
        view,
        payment,
        errors,
        payment_form_policy,
        active_expense_categories,
        accounts,
        loan_id,
        mode
    })
}

export const apiForGettingPayments: RequestHandler = async (req: Request, res: Response) => {
    logger.debug(`${apiForGettingPayments.name}-Start`)
    const auth_req = req as AuthRequest
    const loan_id = Number(req.params.loan_id)
    const timezone = auth_req.timezone || 'UTC'

    try {
        const payments = await AppDataSource.getRepository(LoanPayment).find({
            where: { loan: { id: loan_id } },
            relations: { account: true, category: true },
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

export const routeToFormInsertPayment: RequestHandler = async (req, res) => {

    const auth_req = req as AuthRequest
    const timezone = auth_req.timezone || 'UTC'
    const loan_id = Number(req.params.loan_id)

    const accounts = await getActiveAccountsByUser(auth_req)
    const default_date = await getNextValidTransactionDate(auth_req)

    logger.debug(`${routeToFormInsertPayment.name}-Routing for inserting payment form with timezone: [${timezone}]`)

    return renderPaymentForm(res, {
        title: 'Insertar Pago',
        view: 'pages/payments/form',
        payment: {
            payment_date: formatDateForInputLocal(default_date, timezone),
            principal_paid: '0.00',
            interest_paid: '0.00',
            category: null,
            account: null,
        },
        errors: {},
        accounts,
        loan_id,
        mode: 'insert',
        auth_req
    })
}

export const routeToFormUpdatePayment: RequestHandler = async (req, res) => {

    const auth_req = req as AuthRequest
    const payment_id = Number(req.params.id)
    const timezone = auth_req.timezone || 'UTC'

    if (!Number.isInteger(payment_id) || payment_id <= 0) return res.redirect('/payments')

    const repo_payment = AppDataSource.getRepository(LoanPayment)

    const payment = await repo_payment.findOne({
        where: { id: payment_id },
        relations: { loan: true, account: true, category: true }
    })

    if (!payment) return res.redirect('/payments')

    const accounts = await getActiveAccountsByUser(auth_req)

    logger.debug(`${routeToFormUpdatePayment.name}-Routing for updating payment form with timezone: [${timezone}]`)

    return renderPaymentForm(res, {
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
            category: payment.category || null,
            account: payment.account || null,
        },
        errors: {},
        accounts,
        loan_id: payment.loan.id,
        mode: 'update',
        auth_req
    })
}
export const routeToFormClonePayment: RequestHandler = async (req, res) => {

    const auth_req = req as AuthRequest
    const payment_id = Number(req.params.id)
    const timezone = auth_req.timezone || 'UTC'

    if (!Number.isInteger(payment_id) || payment_id <= 0) return res.redirect('/payments')

    const repo_payment = AppDataSource.getRepository(LoanPayment)

    const payment = await repo_payment.findOne({
        where: { id: payment_id },
        relations: { loan: true, account: true, category: true }
    })

    if (!payment) return res.redirect('/loans')

    const accounts = await getActiveAccountsByUser(auth_req)
    const default_date = await getNextValidTransactionDate(auth_req)

    logger.debug(`${routeToFormClonePayment.name}-Routing for cloning payment form with timezone: [${timezone}]`)

    return renderPaymentForm(res, {
        title: 'Clonar Pago',
        view: 'pages/payments/form',
        payment: {
            note: payment.note ?? '',
            principal_paid: payment.principal_paid,
            interest_paid: payment.interest_paid,
            payment_date: formatDateForInputLocal(default_date, timezone),
            account_id: payment.account ? payment.account.id : '',
            account_name: payment.account ? payment.account.name : '',
            category: payment.category || null,
            account: payment.account || null,
        },
        errors: {},
        accounts,
        loan_id: payment.loan.id,
        mode: 'insert',
        auth_req
    })
}

export const routeToFormDeletePayment: RequestHandler = async (req, res) => {

    const auth_req = req as AuthRequest
    const payment_id = Number(req.params.id)
    const timezone = auth_req.timezone || 'UTC'

    if (!Number.isInteger(payment_id) || payment_id <= 0) return res.redirect('/payments')

    const repo_payment = AppDataSource.getRepository(LoanPayment)

    const payment = await repo_payment.findOne({
        where: { id: payment_id },
        relations: { loan: true, account: true, category: true }
    })

    if (!payment) return res.redirect('/payments')

    const accounts = await getActiveAccountsByUser(auth_req)

    logger.debug(`${routeToFormDeletePayment.name}-Routing for deleting payment form with timezone: [${timezone}]`)

    return renderPaymentForm(res, {
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
            category: payment.category || null,
            account: payment.account || null,
        },
        errors: {},
        accounts,
        loan_id: payment.loan.id,
        mode: 'delete',
        auth_req
    })
}


