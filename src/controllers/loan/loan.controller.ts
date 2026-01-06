import { Request, RequestHandler, Response } from 'express'
import { AuthRequest } from "../../types/AuthRequest"
import { Loan } from "../../entities/Loan.entity"
import { AppDataSource } from "../../config/datasource"
import { logger } from "../../utils/logger.util"
import { formatDateForInputLocal } from '../../utils/date.util'

export const listLoansAPI: RequestHandler = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest

  try {
    const loans = await AppDataSource.getRepository(Loan).find({
      where: { user: { id: authReq.user.id } },
      order: { name: 'ASC' }
    })
    res.json(loans)
  } catch (err) {
    logger.error('Error al listar préstamos:', err)
    res.status(500).json({ error: 'Error al listar préstamos' })
  }
}

export const insertLoanFormPage: RequestHandler = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest
  const mode = 'insert'

  res.render(
    'layouts/main',
    {
      title: 'Insertar Préstamo',
      view: 'pages/loans/form',
      loan: {},
      errors: {},
      mode,
    })
}

export const updateLoanFormPage: RequestHandler = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest
  const txId = Number(req.params.id)
  const mode = 'update'

  const repo = AppDataSource.getRepository(Loan)

  const tx = await repo.findOne({
    where: { id: txId, user: { id: authReq.user.id } },
  })

  if (!tx) {
    return res.redirect('/loans')
  }

  res.render(
    'layouts/main',
    {
      title: 'Editar Préstamo',
      view: 'pages/loans/form',
      loan: {
        id: tx.id,
        loan_number: tx.loan_number,
        name: tx.name,
        total_amount: tx.total_amount,
        balance: tx.balance,
        interest_rate: tx.interest_rate,
        start_date: formatDateForInputLocal(tx.start_date).slice(0, 16),
        end_date: formatDateForInputLocal(tx.end_date).slice(0, 16),
        status: tx.status,
      },
      errors: {},
      mode
    })
}

export const loansPage: RequestHandler = (req: Request, res: Response) => {
  const authReq = req as AuthRequest

  res.render(
    'layouts/main',
    {
      title: 'Préstamos',
      view: 'pages/loans/index',
      USER_ID: authReq.user?.id || 'guest'
    })
}
