import { Request, RequestHandler, Response } from 'express'
import { AuthRequest } from "../../types/AuthRequest"
import { Loan } from "../../entities/Loan.entity"
import { AppDataSource } from "../../config/datasource"
import { logger } from "../../utils/logger.util"
import { formatDateForInputLocal } from '../../utils/date.util'
import { getActiveAccountsByUser } from '../transaction/transaction.controller.auxiliar'
import { getActiveParentLoansByUser } from './loan.controller.auxiliar'
export { saveLoan as apiForSavingLoan } from './loan.controller.saving'

export const apiForGettingLoans: RequestHandler = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest

  try {
    const repository = AppDataSource.getRepository(Loan)

    const result = await repository
      .createQueryBuilder('loan')
      .leftJoinAndSelect('loan.parent', 'parent')
      .leftJoinAndSelect('loan.disbursement_account', 'disbursement_account')
      .leftJoinAndSelect('loan.transaction', 'transaction')
      .leftJoinAndSelect('loan.payments', 'payments')
      .where('loan.user_id = :userId', { userId: authReq.user.id })
      .orderBy('parent.name', 'ASC')
      .addOrderBy('loan.name', 'ASC')
      .getMany()

    const loans = result.map(loan => ({
      id: loan.id,
      name: loan.name,
      total_amount: loan.total_amount,
      interest_amount: loan.interest_amount,
      balance: loan.balance,
      start_date: loan.start_date,
      end_date: loan.end_date,
      is_active: loan.is_active,
      created_at: loan.created_at,
      note: loan.note,

      disbursement_account: loan.disbursement_account,
      transaction: loan.transaction,
      payments: loan.payments,

      parent: loan.parent
        ? {
          id: loan.parent.id,
          name: loan.parent.name
        }
        : null
    }))

    res.json(loans)
  } catch (error) {
    logger.error('Error al listar préstamos', error)
    res.status(500).json({ error: 'Error al listar préstamos' })
  }
}
export const routeToPageLoan: RequestHandler = (req: Request, res: Response) => {
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


export const routeToFormInsertLoan: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'insert'
  const authReq = req as AuthRequest

  const defaultDate = new Date()
  const disbursement_accounts = await getActiveAccountsByUser(authReq)
  const parentLoans = await getActiveParentLoansByUser(authReq)
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
      parentLoans,
      mode,
    })
}

export const routeToFormUpdateLoan: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'update'
  const authReq = req as AuthRequest
  const loanId = Number(req.params.id)

  if (!Number.isInteger(loanId) || loanId <= 0) {
    return res.redirect('/loans')
  }

  const repoLoan = AppDataSource.getRepository(Loan)
  const loan = await repoLoan.findOne({
    where: { id: loanId, user: { id: authReq.user.id } },
    relations: { disbursement_account: true, parent: true }
  })

  if (!loan) {
    return res.redirect('/loans')
  }

  const disbursement_accounts = await getActiveAccountsByUser(authReq)
  const parentLoans = await getActiveParentLoansByUser(authReq)
  res.render(
    'layouts/main',
    {
      title: 'Editar Préstamo',
      view: 'pages/loans/form',
      loan: {
        id: loan.id,
        name: loan.name,
        total_amount: loan.total_amount,
        balance: loan.balance,
        start_date: formatDateForInputLocal(loan.start_date).slice(0, 16),
        disbursement_account_id: loan.disbursement_account?.id || '',
        disbursement_account_name: loan.disbursement_account?.name || '',
        transaction_id: loan.transaction?.id || '',
        parent: loan.parent || null,
        is_parent: !loan.parent

      },
      errors: {},
      disbursement_accounts,
      parentLoans,
      mode
    })
}

export const routeToFormDeleteLoan: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'delete'
  const authReq = req as AuthRequest
  const loanId = Number(req.params.id)

  if (!Number.isInteger(loanId) || loanId <= 0) {
    return res.redirect('/loans')
  }

  const repoLoan = AppDataSource.getRepository(Loan)
  const loan = await repoLoan.findOne({
    where: { id: loanId, user: { id: authReq.user.id } },
    relations: { disbursement_account: true, parent: true }
  })

  if (!loan) {
    return res.redirect('/loans')
  }

  const disbursement_accounts = await getActiveAccountsByUser(authReq)
  const parentLoans = await getActiveParentLoansByUser(authReq)
  res.render(
    'layouts/main',
    {
      title: 'Eliminar Préstamo',
      view: 'pages/loans/form',
      loan: {
        id: loan.id,
        name: loan.name,
        total_amount: loan.total_amount,
        balance: loan.balance,
        start_date: formatDateForInputLocal(loan.start_date).slice(0, 16),
        disbursement_account_id: loan.disbursement_account?.id || '',
        disbursement_account_name: loan.disbursement_account?.name || '',
        is_active: loan.is_active,
        parent: loan.parent || null,
        is_parent: !loan.parent
      },
      errors: {},
      disbursement_accounts,
      parentLoans,
      mode
    })
}

