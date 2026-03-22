import { Request, RequestHandler, Response } from 'express'
import { getActiveAccounts } from '../../cache/cache-accounts.service'
import { AppDataSource } from "../../config/typeorm.datasource"
import { Loan } from "../../entities/Loan.entity"
import { LoanPayment } from '../../entities/LoanPayment.entity'
import { paymentFormMatrix } from '../../policies/payment-form.policy'
import { getNextValidTransactionDate } from '../../services/next-valid-trx-date.service'
import { getActiveCategoriesForPaymentsByUser } from '../../services/populate-items.service'
import { AuthRequest } from "../../types/auth-request"
import { BaseFormViewParams } from '../../types/form-view-params'
import { formatDateForInputLocal } from '../../utils/date.util'
import { logger } from "../../utils/logger.util"
export { savePayment as apiForSavingAccount } from './payment.saving'

type PaymentFormViewParams = BaseFormViewParams & {
  payment: any
}

const renderPaymentForm = async (res: Response, params: PaymentFormViewParams) => {
    const { title, view, payment, errors, mode, auth_req } = params
    const payment_form_policy = paymentFormMatrix[mode]
    const active_expense_category_list = await getActiveCategoriesForPaymentsByUser(auth_req)
    const account_list = await getActiveAccounts(auth_req)
    const loan_id = auth_req.params.loan_id || payment.loan?.id || null
    const category_id = auth_req.query.category_id || null
    const from = auth_req.query.from || null

    return res.render('layouts/main', {
        mode,
        title,
        view,
        payment,
        errors,
        payment_form_policy,
        active_expense_category_list,
        account_list,
        loan_id,
        context: { category_id, from }
    })
}

export const apiForGettingPayments: RequestHandler = async (req: Request, res: Response) => {
    const loan_id = Number(req.params.loan_id)
    try {
        const payments = await AppDataSource.getRepository(LoanPayment).find({
            where: { loan: { id: loan_id } },
            relations: { account: true, category: true },
            order: { payment_date: 'DESC' }
        })
        res.json(payments)
    } catch (error) {
        logger.error(`${apiForGettingPayments.name}-Error. `, error)
        res.status(500).json({ error: 'Error al listar pagos' })
    } finally {
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
    const mode = 'insert'
    const auth_req = req as AuthRequest
    const timezone = auth_req.timezone || 'UTC'
    const default_date = await getNextValidTransactionDate(auth_req)
    return renderPaymentForm(res, {
        title: 'Insertar Pago',
        view: 'pages/payments/form',
        payment: {
            note: '',
            payment_date: formatDateForInputLocal(default_date, timezone),
            principal_paid: '0.00',
            interest_paid: '0.00',
            category: null,
            account: null,
        },
        errors: {},
        mode,
        auth_req,
    })
}

export const routeToFormUpdatePayment: RequestHandler = async (req, res) => {
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
        relations: { loan: true, account: true, category: true }
    })
    if (!payment) {
        return res.redirect('/payments')
    }
    return renderPaymentForm(res, {
        title: 'Editar Pago',
        view: 'pages/payments/form',
        payment: {
            id: payment.id,
            note: payment.note,
            principal_paid: payment.principal_paid,
            interest_paid: payment.interest_paid,
            payment_date: formatDateForInputLocal(payment.payment_date, timezone),
            category: payment.category,
            account: payment.account,
            loan: payment.loan,
        },
        errors: {},
        mode,
        auth_req,
    })
}
export const routeToFormClonePayment: RequestHandler = async (req, res) => {
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
        relations: { loan: true, account: true, category: true }
    })
    if (!payment) {
        return res.redirect('/loans')
    }
    const default_date = await getNextValidTransactionDate(auth_req)
    return renderPaymentForm(res, {
        title: 'Clonar Pago',
        view: 'pages/payments/form',
        payment: {
            note: payment.note,
            principal_paid: payment.principal_paid,
            interest_paid: payment.interest_paid,
            payment_date: formatDateForInputLocal(default_date, timezone),
            account: payment.account,
            category: payment.category,
            loan: payment.loan,
        },
        errors: {},
        mode,
        auth_req,
    })
}

export const routeToFormDeletePayment: RequestHandler = async (req, res) => {
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
        relations: { loan: true, account: true, category: true }
    })
    if (!payment) {
        return res.redirect('/payments')
    }
    return renderPaymentForm(res, {
        title: 'Eliminar Pago',
        view: 'pages/payments/form',
        payment: {
            id: payment.id,
            note: payment.note,
            principal_paid: payment.principal_paid,
            interest_paid: payment.interest_paid,
            payment_date: formatDateForInputLocal(payment.payment_date, timezone),
            category: payment.category,
            account: payment.account,
            loan: payment.loan,
        },
        errors: {},
        mode,
        auth_req,
    })
}


