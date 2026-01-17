import { Request, RequestHandler, Response } from 'express'
import { AuthRequest } from "../../types/AuthRequest"
import { Loan } from "../../entities/Loan.entity"
import { AppDataSource } from "../../config/datasource"
import { logger } from "../../utils/logger.util"
import { formatDateForInputLocal } from '../../utils/date.util'
import { getActiveAccountsByUser } from '../transaction/transaction.controller.auxiliar'

export const listLoansAPI: RequestHandler = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest

  try {
    const loans = await AppDataSource.getRepository(Loan).find({
      where: { user: { id: authReq.user.id } },
      relations: { disbursement_account: true, transaction: true, payments: true },
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
  const defaultDate = new Date()
  const disbursement_accounts = await getActiveAccountsByUser(authReq)

  res.render(
    'layouts/main',
    {
      title: 'Insertar Préstamo',
      view: 'pages/loans/form',
      loan: {
        start_date: formatDateForInputLocal(defaultDate).slice(0, 16),
        total_amount: '0.00',
        disbursement_account_id: '',
        disbursement_account_name: '',
      },
      errors: {},
      disbursement_accounts,
      mode,
    })
}

export const updateLoanFormPage: RequestHandler = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest
  const txId = Number(req.params.id)
  const mode = 'update'

  const repo = AppDataSource.getRepository(Loan)
  const disbursement_accounts = await getActiveAccountsByUser(authReq)

  const tx = await repo.findOne({
    where: { id: txId, user: { id: authReq.user.id } },
    relations: ['disbursement_account']
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
        name: tx.name,
        total_amount: tx.total_amount,
        balance: tx.balance,
        start_date: formatDateForInputLocal(tx.start_date).slice(0, 16),
        disbursement_account_id: tx.disbursement_account?.id || '',
        disbursement_account_name: tx.disbursement_account?.name || '',
        transaction_id: tx.transaction?.id || '',
        
      },
      errors: {},
      disbursement_accounts,
      mode
    })
}

export const deleteLoanFormPage: RequestHandler = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest
  const txId = Number(req.params.id)
  const mode = 'delete'

  const repo = AppDataSource.getRepository(Loan)
  const disbursement_accounts = await getActiveAccountsByUser(authReq)

  const tx = await repo.findOne({
    where: { id: txId, user: { id: authReq.user.id } },
    relations: ['disbursement_account']
  })

  if (!tx) {
    return res.redirect('/loans')
  }

  res.render(
    'layouts/main',
    {
      title: 'Eliminar Préstamo',
      view: 'pages/loans/form',
      loan: {
        id: tx.id,
        name: tx.name,
        total_amount: tx.total_amount,
        balance: tx.balance,
        start_date: formatDateForInputLocal(tx.start_date).slice(0, 16),
        disbursement_account_id: tx.disbursement_account?.id || '',
        disbursement_account_name: tx.disbursement_account?.name || '',
        is_active: tx.is_active,
      },
      errors: {},
      disbursement_accounts,
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
      disbursement_accounts: [],
      USER_ID: authReq.user?.id || 'guest'
    })
}
