import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from "../../config/typeorm.datasource"
import { Loan } from "../../entities/Loan.entity"
import { loanFormMatrix } from '../../policies/loan-form.policy'
import { getActiveAccountsByUser, getActiveParentLoansByUser } from '../../services/populate-items.service'
import { AuthRequest } from "../../types/auth-request"
import { formatDateForInputLocal } from '../../utils/date.util'
import { logger } from "../../utils/logger.util"
import { getNextValidTransactionDate } from '../transaction/transaction.auxiliar'
export { saveLoan as apiForSavingLoan } from './loan.saving'

type LoanFormViewParams = {
  title: string
  view: string
  loan: any
  errors: any
  mode: 'insert' | 'update' | 'delete'
  auth_req: AuthRequest
}

const renderLoanForm = async (res: Response, params: LoanFormViewParams) => {
  const { title, view, loan, errors, mode, auth_req } = params
  const disbursement_account = await getActiveAccountsByUser(auth_req)
  const loan_group = await getActiveParentLoansByUser(auth_req)
  const loan_form_policy = loanFormMatrix[mode]
  return res.render('layouts/main', {
    title,
    view,
    loan,
    errors,
    loan_form_policy,
    disbursement_account,
    loan_group,
    mode
  })
}

export const apiForGettingLoans: RequestHandler = async (req: Request, res: Response) => {
  logger.debug(`${apiForGettingLoans.name}-Start`)
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'

  try {
    const repository = AppDataSource.getRepository(Loan)

    const result = await repository
      .createQueryBuilder('loan')
      .leftJoinAndSelect('loan.loan_group', 'loan_group')
      .leftJoinAndSelect('loan.disbursement_account', 'disbursement_account')
      .leftJoinAndSelect('loan.transaction', 'transaction')
      .leftJoinAndSelect('loan.payments', 'payments')
      .where('loan.user_id = :userId', { userId: auth_req.user.id })
      .orderBy('loan_group.name', 'ASC')
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
      loan_group: loan.loan_group ? { id: loan.loan_group.id, name: loan.loan_group.name } : null
    }))

    logger.debug(`${apiForGettingLoans.name}-Loans found: [${loans.length}]`)
    res.json(loans)
  } catch (error) {
    logger.error(`${apiForGettingLoans.name}-Error. `, error)
    res.status(500).json({ error: 'Error al listar préstamos' })
  } finally {
    logger.debug(`${apiForGettingLoans.name}-End`)
  }
}

export const routeToPageLoan: RequestHandler = (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  res.render(
    'layouts/main',
    {
      title: 'Préstamos',
      view: 'pages/loans/index',
      disbursement_account: [],
      USER_ID: auth_req.user?.id || 'guest'
    })
}

export const routeToFormInsertLoan: RequestHandler = async (req, res) => {
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'

  const default_date = await getNextValidTransactionDate(auth_req)
  logger.debug(`${routeToFormInsertLoan.name}-Routing for inserting loan form with timezone: [${timezone}]`)
  return renderLoanForm(res, {
    title: 'Insertar Préstamo',
    view: 'pages/loans/form',
    loan: {
      start_date: formatDateForInputLocal(default_date, timezone),
      total_amount: '0.00',
      is_active: true,
      disbursement_account: null,
      loan_group: null,
    },
    errors: {},
    mode: 'insert',
    auth_req,
  })
}

export const routeToFormUpdateLoan: RequestHandler = async (req, res) => {
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const loan_id = Number(req.params.id)
  if (!Number.isInteger(loan_id) || loan_id <= 0) {
    return res.redirect('/loans')
  }
  const repo_loan = AppDataSource.getRepository(Loan)
  const loan = await repo_loan.findOne({
    where: { id: loan_id, user: { id: auth_req.user.id } },
    relations: { disbursement_account: true, transaction: true, loan_group: true }
  })
  if (!loan) {
    return res.redirect('/loans')
  }

  logger.debug(`${routeToFormUpdateLoan.name}-Routing for updating loan form with timezone: [${timezone}]`)
  return renderLoanForm(res, {
    title: 'Editar Préstamo',
    view: 'pages/loans/form',
    loan: {
      id: loan.id,
      name: loan.name,
      total_amount: loan.total_amount,
      balance: loan.balance,
      start_date: formatDateForInputLocal(loan.start_date, timezone),
      transaction: loan.transaction || null,
      disbursement_account: loan.disbursement_account || null,
      loan_group: loan.loan_group || null,
    },
    errors: {},
    mode: 'update',
    auth_req,
  })
}

export const routeToFormDeleteLoan: RequestHandler = async (req, res) => {
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const loan_id = Number(req.params.id)
  if (!Number.isInteger(loan_id) || loan_id <= 0) return res.redirect('/loans')
  const repo_loan = AppDataSource.getRepository(Loan)
  const loan = await repo_loan.findOne({
    where: { id: loan_id, user: { id: auth_req.user.id } },
    relations: { disbursement_account: true, loan_group: true }
  })
  if (!loan) {
    return res.redirect('/loans')
  }

  logger.debug(`${routeToFormDeleteLoan.name}-Routing for deleting loan form with timezone: [${timezone}]`)
  return renderLoanForm(res, {
    title: 'Eliminar Préstamo',
    view: 'pages/loans/form',
    loan: {
      id: loan.id,
      name: loan.name,
      total_amount: loan.total_amount,
      balance: loan.balance,
      start_date: formatDateForInputLocal(loan.start_date, timezone),
      is_active: loan.is_active,
      disbursement_account: loan.disbursement_account || null,
      loan_group: loan.loan_group || null,
    },
    errors: {},
    mode: 'delete',
    auth_req,
  })
}

