import { Request, RequestHandler, Response } from 'express'
import { getActiveAccounts } from '../../cache/cache-accounts.service'
import { getPaymentById, getPaymentsForApi, getActiveCategoriesForPayablePaymentsByUser } from '../../cache/cache-payable-payments.service'
import { getPayableById } from '../../cache/cache-payables.service'
import { payablePaymentFormMatrix } from '../../policies/payable-payment-form.policy'
import { getNextValidTransactionDate } from '../../services/next-valid-transaaction-date.service'
import { AuthRequest } from "../../types/auth-request"
import { BaseFormViewParams } from '../../types/form-view-params'
import { formatDateForInputLocal } from '../../utils/date.util'
import { parseError } from '../../utils/error.util'
import { logger } from "../../utils/logger.util"
export { savePayment as apiForSavingAccount } from './payable-payment.saving'

type PaymentFormViewParams = BaseFormViewParams & {
    payment: any
}

const renderPayablePaymentForm = async (res: Response, params: PaymentFormViewParams) => {
    const { title, view, payment, errors, mode, auth_req } = params
    const payment_form_policy = payablePaymentFormMatrix[mode]
    const active_expense_category_list = await getActiveCategoriesForPayablePaymentsByUser(auth_req)
    const account_list = await getActiveAccounts(auth_req)
    const payable_id = auth_req.params.payable_id || payment.payable?.id || null
    const category_id = auth_req.query.category_id || null
    const from = auth_req.query.from || null
    return res.render('layouts/main', {
        title,
        view,
        errors,
        mode,
        auth_req,
        payment,
        payment_form_policy,
        active_expense_category_list,
        account_list,
        payable_id,
        context: { category_id, from }
    })
}

export const routeToPagePayablePayment: RequestHandler = async (req, res) => {
    const auth_req = req as AuthRequest
    const payable_id = Number(req.params.id)
    const payable = await getPayableById(auth_req, payable_id)
    if (!payable) {
        return res.redirect('/payables')
    }
    res.render('layouts/main', {
        title: 'Pagos',
        view: 'pages/payable-payments/index',
        USER_ID: auth_req.user?.id || 'guest',
        PAYABLE_ID: payable_id,
        payable
    })
}

export const routeToFormInsertPayablePayment: RequestHandler = async (req, res) => {
    const mode = 'insert'
    const auth_req = req as AuthRequest
    const timezone = auth_req.timezone || 'UTC'
    const default_date = await getNextValidTransactionDate(auth_req)
    return renderPayablePaymentForm(res, {
        title: 'Insertar Pago',
        view: 'pages/payable-payments/form',
        errors: {},
        auth_req,
        mode,
        payment: {
            payment_date: formatDateForInputLocal(default_date, timezone),
            note: '',
            principal_paid: '0.00',
            interest_paid: '0.00',
            category: null,
            account: null,
        },
    })
}

export const routeToFormUpdatePayablePayment: RequestHandler = async (req, res) => {
    const mode = 'update'
    const auth_req = req as AuthRequest
    const timezone = auth_req.timezone || 'UTC'
    const payment_id = Number(req.params.id)
    const payment = await getPaymentById(auth_req, payment_id)
    if (!payment) {
        return res.redirect('/payments')
    }
    return renderPayablePaymentForm(res, {
        title: 'Editar Pago',
        view: 'pages/payable-payments/form',
        errors: {},
        mode,
        auth_req,
        payment: {
            ...payment,
            payment_date: formatDateForInputLocal(payment.payment_date, timezone)
        }
    })
}

export const routeToFormClonePayablePayment: RequestHandler = async (req, res) => {
    const mode = 'insert'
    const auth_req = req as AuthRequest
    const timezone = auth_req.timezone || 'UTC'
    const payment_id = Number(req.params.id)
    const payment = await getPaymentById(auth_req, payment_id)
    if (!payment) {
        return res.redirect('/payments')
    }
    const default_date = await getNextValidTransactionDate(auth_req)
    return renderPayablePaymentForm(res, {
        title: 'Insertar Pago',
        view: 'pages/payable-payments/form',
        errors: {},
        mode,
        auth_req,
        payment: {
            ...payment,
            payment_date: formatDateForInputLocal(default_date, timezone)
        }
    })
}

export const routeToFormDeletePayablePayment: RequestHandler = async (req, res) => {
    const mode = 'delete'
    const auth_req = req as AuthRequest
    const timezone = auth_req.timezone || 'UTC'
    const payment_id = Number(req.params.id)
    const payment = await getPaymentById(auth_req, payment_id)
    if (!payment) {
        return res.redirect('/payments')
    }
    return renderPayablePaymentForm(res, {
        title: 'Eliminar Pago',
        view: 'pages/payable-payments/form',
        errors: {},
        mode,
        auth_req,
        payment: {
            ...payment,
            payment_date: formatDateForInputLocal(payment.payment_date, timezone)
        }
    })
}

/*=================================================
Api para devolver el DTO Payable en JSON
==================================================*/
export const apiForGettingPayablePayments: RequestHandler = async (req: Request, res: Response) => {
    const auth_req = req as AuthRequest
    const payable_id = Number(req.params.payable_id)
    try {
        const payments = await getPaymentsForApi(auth_req, payable_id)
        res.json(payments)
    } catch (error) {
        logger.error(`${apiForGettingPayablePayments.name}-Error. `, parseError(error))
        res.status(500).json({ error: 'Error al listar pagos' })
    } finally {
    }
}


