import { LOGGER_EVENTS } from '../../utils/logger-events'
import { Request, RequestHandler, Response } from 'express'
import { getActiveAccounts } from '../../cache/cache-accounts.service'
import { getActiveCategoriesForPayablesByUser, getPayableById, getPayableNameList, getPayablesForApi } from '../../cache/cache-payables.service'
import { getActiveParentPayablesByUser } from '../../cache/cache-payable-groups.service'
import type { DTOPayablesResponse } from '../../dto/dto'
import { payableFormMatrix } from '../../policies/payable-form.policy'
import { getNextValidTransactionDate } from '../../services/next-valid-transaction-date.service'
import { AuthRequest } from "../../types/auth-request"
import { BaseFormViewParams } from '../../types/form-view-params'
import { formatDateForInputLocal } from '../../utils/date.util'
import { logger } from "../../utils/logger.util"
import { parseError } from '../../utils/error.util'
export { savePayable as apiForSavingPayable } from './payable.saving'

type PayableFormViewParams = BaseFormViewParams & {
  payable: any
}

const renderPayableForm = async (res: Response, params: PayableFormViewParams) => {
  const { title, view, payable, errors, mode, auth_req } = params
  const payable_form_policy = payableFormMatrix[mode]
  const disbursement_account_list = await getActiveAccounts(auth_req)
  const payable_group_list = await getActiveParentPayablesByUser(auth_req)
  const active_income_category_list = await getActiveCategoriesForPayablesByUser(auth_req)
  const payable_name_list = await getPayableNameList(auth_req)
  const category_id = auth_req.query.category_id || null
  const from = auth_req.query.from || null
  return res.render('layouts/main', {
    title,
    view,
    errors,
    mode,
    auth_req,
    payable,
    payable_form_policy,
    disbursement_account_list,
    active_income_category_list,
    payable_group_list,
    payable_name_list,
    context: { category_id, from },
  })
}

export const routeToPagePayable: RequestHandler = (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  res.render(
    'layouts/main', {
    title: 'Cuentas por Pagar',
    view: 'pages/payables/index',
    disbursement_account: [],
    USER_ID: auth_req.user?.id || 'guest'
  })
}

export const routeToFormInsertPayable: RequestHandler = async (req, res) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const default_date = await getNextValidTransactionDate(auth_req)
  return renderPayableForm(res, {
    title: 'Insertar Cuenta por Pagar',
    view: 'pages/payables/form',
    errors: {},
    auth_req,
    mode,
    payable: {
      start_date: formatDateForInputLocal(default_date, timezone),
      total_amount: '0.00',
      transaction: null,
      disbursement_account: null,
      category: null,
      payable_group: null,
      is_active: true,
    },
  })
}

export const routeToFormUpdatePayable: RequestHandler = async (req, res) => {
  const mode = 'update'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const payable_id = Number(req.params.id)
  const payable = await getPayableById(auth_req, payable_id)
  if (!payable) {
    return res.redirect('/payables')
  }
  return renderPayableForm(res, {
    title: 'Editar Cuenta por Pagar',
    view: 'pages/payables/form',
    errors: {},
    mode,
    auth_req,
    payable: {
      ...payable,
      start_date: formatDateForInputLocal(payable.start_date, timezone),
    },
  })
}

export const routeToFormClonePayable: RequestHandler = async (req, res) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const payable_id = Number(req.params.id)
  const payable = await getPayableById(auth_req, payable_id)
  if (!payable) {
    return res.redirect('/payables')
  }
  const default_date = await getNextValidTransactionDate(auth_req)
  return renderPayableForm(res, {
    title: 'Insertar Cuenta por Pagar',
    view: 'pages/payables/form',
    errors: {},
    mode,
    auth_req,
    payable: {
      ...payable,
      start_date: formatDateForInputLocal(default_date, timezone),
    },
  })
}

export const routeToFormDeletePayable: RequestHandler = async (req, res) => {
  const mode = 'delete'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const payable_id = Number(req.params.id)
  const payable = await getPayableById(auth_req, payable_id)
  if (!payable) {
    return res.redirect('/payables')
  }
  return renderPayableForm(res, {
    title: 'Eliminar Cuenta por Pagar',
    view: 'pages/payables/form',
    errors: {},
    mode,
    auth_req,
    payable: {
      ...payable,
      start_date: formatDateForInputLocal(payable.start_date, timezone),
    },
  })
}

/*=================================================
Api para devolver el DTO Payable en JSON
==================================================*/
export const apiForGettingPayables: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const apiForGettingPayables_logger = logger.forMethod(apiForGettingPayables.name, LOGGER_EVENTS.PAYABLE, auth_req.user.id)
  const started_at = performance.now()
  try {
    const response: DTOPayablesResponse = await getPayablesForApi(auth_req)
    apiForGettingPayables_logger.info(`Cuentas por pagar obtenidas desde: ${response.metadata.source}`, { number_of_rows: response.metadata.number_of_rows })
    res.json({ payables: response.payables, group_totals: response.group_totals })
  } catch (error) {
    apiForGettingPayables_logger.error('Error al listar cuentas por pagar', parseError(error))
    res.status(500).json({ error: 'Error al listar Cuentas por Pagar' })
  } finally {
    const ended_at = performance.now()
    const elapsed_ms = ended_at - started_at
    apiForGettingPayables_logger.elapsedTime('Elapsed time', { elapsed_ms })
    apiForGettingPayables_logger.debug('Fin de la operación del listado de cuentas por pagar')
  }
}