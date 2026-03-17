import { Request, RequestHandler, Response } from 'express'
import { getActiveAccounts } from '../../cache/cache-accounts.service'
import { getLoanById, getLoansForApi } from '../../cache/cache-loans.service'
import { loanFormMatrix } from '../../policies/loan-form.policy'
import { getNextValidTransactionDate } from '../../services/next-valid-trx-date.service'
import { getActiveCategoriesForLoansByUser, getActiveParentLoansByUser } from '../../services/populate-items.service'
import { AuthRequest } from "../../types/auth-request"
import { BaseFormViewParams } from '../../types/form-view-params'
import { formatDateForInputLocal } from '../../utils/date.util'
import { logger } from "../../utils/logger.util"
export { saveLoan as apiForSavingLoan } from './loan.saving'

type LoanFormViewParams = BaseFormViewParams & {
  loan: any
}

const renderLoanForm = async (res: Response, params: LoanFormViewParams) => {
  const { title, view, loan, errors, mode, auth_req } = params
  const loan_form_policy = loanFormMatrix[mode]
  const disbursement_account_list = await getActiveAccounts(auth_req)
  const loan_group_list = await getActiveParentLoansByUser(auth_req)
  const active_income_category_list = await getActiveCategoriesForLoansByUser(auth_req)
  const category_id = auth_req.query.category_id || null
  const from = auth_req.query.from || null
  return res.render('layouts/main', {
    title,
    view,
    errors,
    mode,
    auth_req,
    loan,
    loan_form_policy,
    disbursement_account_list,
    active_income_category_list,
    loan_group_list,
    context: { category_id, from },
  })
}

export const routeToPageLoan: RequestHandler = (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  res.render(
    'layouts/main', {
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
    errors: {},
    auth_req,
    mode,
    loan: {
      start_date: formatDateForInputLocal(default_date, timezone),
      total_amount: '0.00',
      transaction: null,
      disbursement_account: null,
      category: null,
      loan_group: null,
      is_active: true,
    },
  })
}

export const routeToFormUpdateLoan: RequestHandler = async (req, res) => {
  const mode = 'update'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const loan_id = Number(req.params.id)
  const loan = await getLoanById(auth_req, loan_id)
  if (!loan) {
    return res.redirect('/loans')
  }
  return renderLoanForm(res, {
    title: 'Editar Préstamo',
    view: 'pages/loans/form',
    errors: {},
    mode,
    auth_req,
    loan: {
      ...loan,
      start_date: formatDateForInputLocal(loan.start_date, timezone),
    },
  })
}

export const routeToFormCloneLoan: RequestHandler = async (req, res) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const loan_id = Number(req.params.id)
  const loan = await getLoanById(auth_req, loan_id)
  if (!loan) {
    return res.redirect('/loans')
  }
  const default_date = await getNextValidTransactionDate(auth_req)
  return renderLoanForm(res, {
    title: 'Insertar Préstamo',
    view: 'pages/loans/form',
    errors: {},
    mode,
    auth_req,
    loan: {
      ...loan,
      start_date: formatDateForInputLocal(default_date, timezone),
    },
  })
}

export const routeToFormDeleteLoan: RequestHandler = async (req, res) => {
  const mode = 'delete'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const loan_id = Number(req.params.id)
  const loan = await getLoanById(auth_req, loan_id)
  if (!loan) {
    return res.redirect('/loans')
  }
  return renderLoanForm(res, {
    title: 'Eliminar Préstamo',
    view: 'pages/loans/form',
    errors: {},
    mode,
    auth_req,
    loan: {
      ...loan,
      start_date: formatDateForInputLocal(loan.start_date, timezone),
    },
  })
}

/*=================================================
Api para devolver el DTO Loan en JSON
==================================================*/
export const apiForGettingLoans: RequestHandler = async (req: Request, res: Response) => {
  logger.debug(`${apiForGettingLoans.name}-Start`)
  const auth_req = req as AuthRequest
  try {
    const result = await getLoansForApi(auth_req)
    logger.debug(`${apiForGettingLoans.name}-Loans found: [${result.loans.length}]`)
    logger.debug(`${apiForGettingLoans.name}-Loan groups with totals calculated: [${result.group_totals.length}]`)
    res.json(result)
  } catch (error) {
    logger.error(`${apiForGettingLoans.name}-Error. `, error)
    res.status(500).json({ error: 'Error al listar préstamos' })
  } finally {
    logger.debug(`${apiForGettingLoans.name}-End`)
  }
}