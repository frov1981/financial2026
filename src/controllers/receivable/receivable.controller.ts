import { Request, RequestHandler, Response } from 'express'
import { getActiveAccounts } from '../../cache/cache-accounts.service'
import { getActiveCategoriesForReceivablesByUser, getReceivableById, getReceivablesForApi } from '../../cache/cache-receivables.service'
import { getActiveParentReceivablesByUser } from '../../cache/cache-receivable-groups.service'
import { getNextValidTransactionDate } from '../../services/next-valid-transaaction-date.service'
import { AuthRequest } from "../../types/auth-request"
import { BaseFormViewParams } from '../../types/form-view-params'
import { formatDateForInputLocal } from '../../utils/date.util'
import { logger } from "../../utils/logger.util"
import { parseError } from '../../utils/error.util'
import { receivableFormMatrix } from '../../policies/receivable-form.policy'
export { saveReceivable as apiForSavingReceivable } from './receivable.saving'

type ReceivableFormViewParams = BaseFormViewParams & {
  receivable: any
}

const renderReceivableForm = async (res: Response, params: ReceivableFormViewParams) => {
  const { title, view, receivable, errors, mode, auth_req } = params
  const receivable_form_policy = receivableFormMatrix[mode]
  const disbursement_account_list = await getActiveAccounts(auth_req)
  const receivable_group_list = await getActiveParentReceivablesByUser(auth_req)
  const active_income_category_list = await getActiveCategoriesForReceivablesByUser(auth_req)
  const category_id = auth_req.query.category_id || null
  const from = auth_req.query.from || null
  return res.render('layouts/main', {
    title,
    view,
    errors,
    mode,
    auth_req,
    receivable,
    receivable_form_policy,
    disbursement_account_list,
    active_income_category_list,
    receivable_group_list,
    context: { category_id, from },
  })
}

export const routeToPageReceivable: RequestHandler = (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  res.render(
    'layouts/main', {
    title: 'Cuentas por Cobrar',
    view: 'pages/receivables/index',
    disbursement_account: [],
    USER_ID: auth_req.user?.id || 'guest'
  })
}

export const routeToFormInsertReceivable: RequestHandler = async (req, res) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const default_date = await getNextValidTransactionDate(auth_req)
  return renderReceivableForm(res, {
    title: 'Insertar Cuenta por Cobrar',
    view: 'pages/receivables/form',
    errors: {},
    auth_req,
    mode,
    receivable: {
      start_date: formatDateForInputLocal(default_date, timezone),
      total_amount: '0.00',
      transaction: null,
      disbursement_account: null,
      category: null,
      receivable_group: null,
      is_active: true,
    },
  })
}

export const routeToFormUpdateReceivable: RequestHandler = async (req, res) => {
  const mode = 'update'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const receivable_id = Number(req.params.id)
  const receivable = await getReceivableById(auth_req, receivable_id)
  if (!receivable) {
    return res.redirect('/receivables')
  }
  return renderReceivableForm(res, {
    title: 'Editar Cuenta por Cobrar',
    view: 'pages/receivables/form',
    errors: {},
    mode,
    auth_req,
    receivable: {
      ...receivable,
      start_date: formatDateForInputLocal(receivable.start_date, timezone),
    },
  })
}

export const routeToFormCloneReceivable: RequestHandler = async (req, res) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const receivable_id = Number(req.params.id)
  const receivable = await getReceivableById(auth_req, receivable_id)
  if (!receivable) {
    return res.redirect('/receivables')
  }
  const default_date = await getNextValidTransactionDate(auth_req)
  return renderReceivableForm(res, {
    title: 'Insertar Cuenta por Cobrar',
    view: 'pages/receivables/form',
    errors: {},
    mode,
    auth_req,
    receivable: {
      ...receivable,
      start_date: formatDateForInputLocal(default_date, timezone),
    },
  })
}

export const routeToFormDeleteReceivable: RequestHandler = async (req, res) => {
  const mode = 'delete'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const receivable_id = Number(req.params.id)
  const receivable = await getReceivableById(auth_req, receivable_id)
  if (!receivable) {
    return res.redirect('/receivables')
  }
  return renderReceivableForm(res, {
    title: 'Eliminar Cuenta por Cobrar',
    view: 'pages/receivables/form',
    errors: {},
    mode,
    auth_req,
    receivable: {
      ...receivable,
      start_date: formatDateForInputLocal(receivable.start_date, timezone),
    },
  })
}

/*=================================================
Api para devolver el DTO Receivable en JSON
==================================================*/
export const apiForGettingReceivables: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  try {
    const result = await getReceivablesForApi(auth_req)
    res.json(result)
  } catch (error) {
    logger.error(`${apiForGettingReceivables.name}-Error. `, parseError(error))
    res.status(500).json({ error: 'Error al listar Cuentas por Cobrar' })
  } finally {
  }
}