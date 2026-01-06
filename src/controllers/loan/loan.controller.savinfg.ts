import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/datasource'
import { Account } from '../../entities/Account.entity'
import { AuthRequest } from '../../types/AuthRequest'
import { logger } from '../../utils/logger.util'
import { Loan } from '../../entities/Loan.entity'
import { validateLoan } from './loan.controller.validator'

export const saveLoan: RequestHandler = async (req: Request, res: Response) => {
    const authReq = req as AuthRequest
    const repo = AppDataSource.getRepository(Loan)
    const txId = req.body.id ? Number(req.body.id) : req.params.id ? Number(req.params.id) : undefined

    let tx: Loan
    let mode

    if (txId) {
        const existing = await repo.findOne({ where: { id: txId, user: { id: authReq.user.id } } })
        if (!existing) {
            return res.redirect('/loans')
        }
        mode = 'update'
        if (req.body.loan_number) { existing.loan_number = req.body.loan_number }
        if (req.body.name) { existing.name = req.body.name }
        if (req.body.total_amount) { existing.total_amount = Number(req.body.total_amount) }
        if (req.body.balance) { existing.balance = Number(req.body.balance) }
        if (req.body.interest_rate) { existing.interest_rate = Number(req.body.interest_rate) }
        if (req.body.start_date) { existing.start_date = new Date(req.body.start_date) }
        if (req.body.end_date) { existing.end_date = new Date(req.body.end_date) }
        if (req.body.status) { existing.status = req.body.status }

        tx = existing
    } else {
        mode = 'insert'
        tx = repo.create({
            user: { id: authReq.user.id },
            loan_number: req.body.loan_number,
            name: req.body.name,
            total_amount: Number(req.body.total_amount),
            balance: 0,
            interest_rate: Number(req.body.interest_rate),
            start_date: new Date(req.body.start_date),
            end_date: new Date(req.body.end_date),
            status: req.body.status
        })
    }

    logger.info(`Before saving loan`, { userId: authReq.user.id, mode, tx })

    const errors = await validateLoan(tx, authReq)

    if (errors) {
        return res.render(
            'layouts/main', {
            title: mode === 'insert' ? 'Insertar Préstamo' : 'Editar Préstamo',
            view: 'pages/loans/form',
            loan: {
                ...req.body
            },
            errors,
            mode,
        })
    }

    await repo.save(tx)
    logger.info(`Loan saved to database.`)
    res.redirect('/loans')
}
