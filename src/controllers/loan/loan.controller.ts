import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from "../../config/typeorm.datasource"
import { Loan } from "../../entities/Loan.entity"
import { loanFormMatrix } from '../../policies/loan-form.policy'
import { getNextValidTransactionDate } from '../../services/next-valid-trx-date.service'
import { getActiveCategoriesForLoansByUser, getActiveParentLoansByUser } from '../../services/populate-items.service'
import { AuthRequest } from "../../types/auth-request"
import { BaseFormViewParams } from '../../types/form-view-params'
import { formatDateForInputLocal } from '../../utils/date.util'
import { logger } from "../../utils/logger.util"
import { getActiveAccounts } from '../cache/cache-accounts.service'
export { saveLoan as apiForSavingLoan } from './loan.saving'

type LoanFormViewParams = BaseFormViewParams & {
  loan: any
}

const renderLoanForm = async (res: Response, params: LoanFormViewParams) => {
  const { title, view, loan, errors, mode, auth_req } = params
  const loan_form_policy = loanFormMatrix[mode]
  /*const disbursement_account_list = await getActiveAccountsByUser(auth_req)*/
  const disbursement_account_list = await getActiveAccounts(auth_req)

  const loan_group_list = await getActiveParentLoansByUser(auth_req)
  const active_income_category_list = await getActiveCategoriesForLoansByUser(auth_req)
  const category_id = auth_req.query.category_id || null
  const from = auth_req.query.from || null

  return res.render('layouts/main', {
    mode,
    title,
    view,
    loan,
    errors,
    loan_form_policy,
    disbursement_account_list,
    active_income_category_list,
    loan_group_list,
    context: { category_id, from }
  })
}

export const apiForGettingLoans: RequestHandler = async (req: Request, res: Response) => {
  logger.debug(`${apiForGettingLoans.name}-Start`)
  const auth_req = req as AuthRequest
  try {
    const repository = AppDataSource.getRepository(Loan)
    const result = await repository
      .createQueryBuilder('loan')
      .leftJoinAndSelect('loan.loan_group', 'loan_group')
      .leftJoinAndSelect('loan.disbursement_account', 'disbursement_account')
      .leftJoinAndSelect('loan.transaction', 'transaction')
      .leftJoinAndSelect('loan.payments', 'payments')
      .leftJoinAndSelect('loan.category', 'category')
      .where('loan.user_id = :user_id', { user_id: auth_req.user.id })
      .orderBy('loan_group.name', 'ASC')
      .addOrderBy('loan.name', 'ASC')
      .getMany()
    const loans = result.map(loan => ({
      id: loan.id,
      name: loan.name,
      total_amount: loan.total_amount,
      principal_paid: loan.principal_paid,
      interest_paid: loan.interest_paid,
      balance: loan.balance,
      start_date: loan.start_date,
      end_date: loan.end_date,
      is_active: loan.is_active,
      created_at: loan.created_at,
      note: loan.note,
      disbursement_account: loan.disbursement_account,
      category: loan.category,
      transaction: loan.transaction,
      payments: loan.payments,
      loan_group: loan.loan_group ? { id: loan.loan_group.id, name: loan.loan_group.name } : null,
    }))
    logger.debug(`${apiForGettingLoans.name}-Loans found: [${loans.length}]`)
    const group_totals_map: Record<number, { loan_group_id: number, loan_group_name: string, total_balance: number }> = {}
    for (const loan of result) {
      if (!loan.loan_group) continue
      const group_id = loan.loan_group.id
      if (!group_totals_map[group_id]) {
        group_totals_map[group_id] = {
          loan_group_id: group_id,
          loan_group_name: loan.loan_group.name,
          total_balance: 0
        }
      }
      group_totals_map[group_id].total_balance += Number(loan.balance)
    }
    const group_totals = Object.values(group_totals_map)
    logger.debug(`${apiForGettingLoans.name}-Loan groups with totals calculated: [${group_totals.length}]`)
    res.json({ loans, group_totals })
  } catch (error) {
    logger.error(`${apiForGettingLoans.name}-Error. `, error)
    res.status(500).json({ error: 'Error al listar préstamos' })
  } finally {
    logger.debug(`${apiForGettingLoans.name}-End`)
  }
}

export const routeToPageLoan: RequestHandler = (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
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
  const mode = 'insert'
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
      transaction: null,
      disbursement_account: null,
      category: null,
      loan_group: null,
    },
    errors: {},
    mode,
    auth_req,
  })
}

export const routeToFormUpdateLoan: RequestHandler = async (req, res) => {
  const mode = 'update'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const loan_id = Number(req.params.id)
  if (!Number.isInteger(loan_id) || loan_id <= 0) {
    return res.redirect('/loans')
  }
  const repo_loan = AppDataSource.getRepository(Loan)
  const loan = await repo_loan.findOne({
    where: { id: loan_id, user: { id: auth_req.user.id } },
    relations: { disbursement_account: true, transaction: true, loan_group: true, category: true }
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
      transaction: loan.transaction,
      disbursement_account: loan.disbursement_account,
      category: loan.category,
      loan_group: loan.loan_group,
    },
    errors: {},
    mode,
    auth_req,
  })
}

export const routeToFormCloneLoan: RequestHandler = async (req, res) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const loan_id = Number(req.params.id)
  if (!Number.isInteger(loan_id) || loan_id <= 0) {
    return res.redirect('/loans')
  }
  const repo_loan = AppDataSource.getRepository(Loan)
  const loan = await repo_loan.findOne({
    where: { id: loan_id, user: { id: auth_req.user.id } },
    relations: { disbursement_account: true, transaction: true, loan_group: true, category: true }
  })
  if (!loan) {
    return res.redirect('/loans')
  }
  const default_date = await getNextValidTransactionDate(auth_req)
  logger.debug(`${routeToFormUpdateLoan.name}-Routing for updating loan form with timezone: [${timezone}]`)
  return renderLoanForm(res, {
    title: 'Insertar Préstamo',
    view: 'pages/loans/form',
    loan: {
      name: loan.name,
      total_amount: loan.total_amount,
      balance: loan.balance,
      start_date: formatDateForInputLocal(default_date, timezone),
      transaction: loan.transaction,
      disbursement_account: loan.disbursement_account,
      category: loan.category,
      loan_group: loan.loan_group,
    },
    errors: {},
    mode,
    auth_req,
  })
}

export const routeToFormDeleteLoan: RequestHandler = async (req, res) => {
  const mode = 'delete'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const loan_id = Number(req.params.id)
  if (!Number.isInteger(loan_id) || loan_id <= 0) {
    return res.redirect('/loans')
  }
  const repo_loan = AppDataSource.getRepository(Loan)
  const loan = await repo_loan.findOne({
    where: { id: loan_id, user: { id: auth_req.user.id } },
    relations: { disbursement_account: true, transaction: true, loan_group: true, category: true }
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
      transaction: loan.transaction,
      disbursement_account: loan.disbursement_account,
      category: loan.category,
      loan_group: loan.loan_group,
    },
    errors: {},
    mode,
    auth_req,
  })
}

