import { Request, RequestHandler, Response } from 'express'
import { AuthRequest } from "../../types/AuthRequest"
import { Loan } from "../../entities/Loan.entity"
import { AppDataSource } from "../../config/datasource"
import { logger } from "../../utils/logger.util"
import { formatDateForInputLocal } from '../../utils/date.util'
import { LoanPayment } from '../../entities/LoanPayment.entity'
import { getActiveAccountsByUser } from '../transaction/transaction.controller.auxiliar'

export const listPaymentsAPI: RequestHandler = async (req: Request, res: Response) => {
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

export const insertPaymentFormPage: RequestHandler = async (req: Request, res: Response) => {
    const authReq = req as AuthRequest
    const loanId = Number(req.params.loanId)
    const mode = 'insert'
    const defaultDate = new Date()
    const accounts = await getActiveAccountsByUser(authReq)

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

export const updatePaymentFormPage: RequestHandler = async (req: Request, res: Response) => {
    const authReq = req as AuthRequest
    const txId = Number(req.params.id)
    const mode = 'update'

    const repo = AppDataSource.getRepository(LoanPayment)

    const tx = await repo.findOne({
        where: { id: txId },
        relations: { loan: true, account: true },
    })

    if (!tx) {
        return res.redirect('/payments')
    }
    const accounts = await getActiveAccountsByUser(authReq)

    res.render(
        'layouts/main',
        {
            title: 'Editar Pago',
            view: 'pages/payments/form',
            payment: {
                id: tx.id,
                note: tx.note,
                principal_amount: tx.principal_amount,
                interest_amount: tx.interest_amount,
                payment_date: formatDateForInputLocal(tx.payment_date).slice(0, 16),
                account_id: tx.account ? tx.account.id : '',
                account_name: tx.account ? tx.account.name : '',
            },
            loan_id: tx.loan.id,
            errors: {},
            accounts,
            mode
        })
}

export const deletePaymentFormPage: RequestHandler = async (req: Request, res: Response) => {
    const authReq = req as AuthRequest
    const txId = Number(req.params.id)
    const mode = 'delete'

    const repo = AppDataSource.getRepository(LoanPayment)

    const tx = await repo.findOne({
        where: { id: txId },
        relations: { loan: true, account: true },
    })

    if (!tx) {
        return res.redirect('/payments')
    }
    const accounts = await getActiveAccountsByUser(authReq)

    res.render(
        'layouts/main',
        {
            title: 'Eliminar Pago',
            view: 'pages/payments/form',
            payment: {
                id: tx.id,
                note: tx.note,
                principal_amount: tx.principal_amount,
                interest_amount: tx.interest_amount,
                payment_date: formatDateForInputLocal(tx.payment_date).slice(0, 16),
                account_id: tx.account ? tx.account.id : '',
                account_name: tx.account ? tx.account.name : '',
            },
            loan_id: tx.loan.id,
            errors: {},
            accounts,
            mode
        })
}

export const paymentsPage: RequestHandler = async (req, res) => {
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

