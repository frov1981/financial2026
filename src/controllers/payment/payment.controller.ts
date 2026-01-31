import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from "../../config/datasource"
import { Loan } from "../../entities/Loan.entity"
import { LoanPayment } from '../../entities/LoanPayment.entity'
import { AuthRequest } from "../../types/AuthRequest"
import { formatDateForInputLocal } from '../../utils/date.util'
import { logger } from "../../utils/logger.util"
import { getActiveAccountsByUser, getNextValidTransactionDate } from '../transaction/transaction.controller.auxiliar'
export { savePayment as apiForSavingAccount } from './payment.controller.saving'

export const apiForGettingPayments: RequestHandler = async (req: Request, res: Response) => {
    const authReq = req as AuthRequest
    const loanId = Number(req.params.loanId)

    try {
        const payments = await AppDataSource.getRepository(LoanPayment).find({
            where: { loan: { id: loanId } },
            relations: { account: true },
            order: { payment_date: 'DESC' }
        })
        res.json(payments)
    } catch (err) {
        logger.error('Error al listar pagos:', err)
        res.status(500).json({ error: 'Error al listar pagos' })
    }
}

export const routeToPagePayment: RequestHandler = async (req, res) => {
    const authReq = req as AuthRequest
    const loanId = Number(req.params.id)

    const loan = await AppDataSource.getRepository(Loan).findOne({
        where: { id: loanId }
    })

    if (!loan) {
        return res.redirect('/loans')
    }

    res.render('layouts/main', {
        title: 'Pagos',
        view: 'pages/payments/index',
        USER_ID: authReq.user?.id || 'guest',
        LOAN_ID: loanId,
        loan
    })
}

export const routeToFormInsertPayment: RequestHandler = async (req: Request, res: Response) => {
    const mode = 'insert'
    const authReq = req as AuthRequest
    const loanId = Number(req.params.loanId)
    const accounts = await getActiveAccountsByUser(authReq)
    const defaultDate = await getNextValidTransactionDate(authReq);

    res.render(
        'layouts/main',
        {
            title: 'Insertar Pago',
            view: 'pages/payments/form',
            payment: {
                payment_date: formatDateForInputLocal(defaultDate).slice(0, 16),
                principal_amount: '0.00',
                interest_amount: '0.00',
            },
            loan_id: loanId,
            errors: {},
            accounts,
            mode,
        })
}

export const routeToFormUpdatePayment: RequestHandler = async (req: Request, res: Response) => {
    const mode = 'update'
    const authReq = req as AuthRequest
    const paymentId = Number(req.params.id)

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
        return res.redirect('/payments')
    }

    const accounts = await getActiveAccountsByUser(authReq)
    const repoPayment = AppDataSource.getRepository(LoanPayment)
    const payment = await repoPayment.findOne({
        where: { id: paymentId },
        relations: { loan: true, account: true },
    })

    if (!payment) {
        return res.redirect('/payments')
    }

    res.render(
        'layouts/main',
        {
            title: 'Editar Pago',
            view: 'pages/payments/form',
            payment: {
                id: payment.id,
                note: payment.note,
                principal_amount: payment.principal_amount,
                interest_amount: payment.interest_amount,
                payment_date: formatDateForInputLocal(payment.payment_date).slice(0, 16),
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
    const authReq = req as AuthRequest
    const paymentId = Number(req.params.id)

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
        return res.redirect('/payments')
    }

    const accounts = await getActiveAccountsByUser(authReq)
    const defaultDate = await getNextValidTransactionDate(authReq)
    const repoPayment = AppDataSource.getRepository(LoanPayment)
    const payment = await repoPayment.findOne({
        where: { id: paymentId },
        relations: { loan: true, account: true }
    })

    if (!payment) {
        return res.redirect('/loans')
    }

    res.render(
        'layouts/main',
        {
            title: 'Clonar Pago',
            view: 'pages/payments/form',
            payment: {
                note: payment.note ?? '',
                principal_amount: payment.principal_amount,
                interest_amount: payment.interest_amount,
                payment_date: formatDateForInputLocal(defaultDate).slice(0, 16),
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
    const authReq = req as AuthRequest
    const paymentId = Number(req.params.id)

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
        return res.redirect('/payments')
    }

    const accounts = await getActiveAccountsByUser(authReq)
    const repoPayment = AppDataSource.getRepository(LoanPayment)
    const payment = await repoPayment.findOne({
        where: { id: paymentId },
        relations: { loan: true, account: true },
    })

    if (!payment) {
        return res.redirect('/payments')
    }

    res.render(
        'layouts/main',
        {
            title: 'Eliminar Pago',
            view: 'pages/payments/form',
            payment: {
                id: payment.id,
                note: payment.note,
                principal_amount: payment.principal_amount,
                interest_amount: payment.interest_amount,
                payment_date: formatDateForInputLocal(payment.payment_date).slice(0, 16),
                account_id: payment.account ? payment.account.id : '',
                account_name: payment.account ? payment.account.name : '',
            },
            loan_id: payment.loan.id,
            errors: {},
            accounts,
            mode
        })
}


