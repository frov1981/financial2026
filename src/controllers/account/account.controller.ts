import { LOGGER_EVENTS } from '../../utils/logger-events'
import { Request, RequestHandler, Response } from 'express'
import { getAccountById, getAccountsForApi } from '../../cache/cache-accounts.service'
import type { DTOAccountsResponse } from '../../dto/dto'
import { accountFormMatrix } from '../../policies/account-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { BaseFormViewParams } from '../../types/form-view-params'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'
export { saveAccount as apiForSavingAccount } from './account.saving'

type AccountFormViewParams = BaseFormViewParams & {
  account: any
}

const renderAccountForm = async (res: Response, params: AccountFormViewParams) => {
  const { title, view, account, errors, mode, auth_req } = params
  const account_form_policy = accountFormMatrix[mode]
  return res.render('layouts/main', {
    title,
    view,
    errors,
    mode,
    auth_req,
    account,
    account_form_policy,
  })
}

export const routeToPageAccount: RequestHandler = (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  res.render('layouts/main', {
    title: 'Cuentas',
    view: 'pages/accounts/index',
    USER_ID: auth_req.user?.id || 'guest'
  })
}

export const routeToFormInsertAccount: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  return renderAccountForm(res, {
    title: 'Insertar Cuenta',
    view: 'pages/accounts/form',
    errors: {},
    mode,
    auth_req,
    account: {
      type: null,
      is_active: true
    },
  })
}

export const routeToFormUpdateAccount: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'update'
  const auth_req = req as AuthRequest
  const account_id = Number(req.params.id)
  const account = await getAccountById(auth_req, account_id)
  if (!account) {
    return res.redirect('/accounts')
  }
  return renderAccountForm(res, {
    title: 'Editar Cuenta',
    view: 'pages/accounts/form',
    errors: {},
    mode,
    auth_req,
    account,
  })
}

export const routeToFormDeleteAccount: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'delete'
  const auth_req = req as AuthRequest
  const account_id = Number(req.params.id)
  const account = await getAccountById(auth_req, account_id)
  if (!account) {
    return res.redirect('/accounts')
  }
  return renderAccountForm(res, {
    title: 'Eliminar Cuenta',
    view: 'pages/accounts/form',
    errors: {},
    mode,
    auth_req,
    account,
  })
}

/*=================================================
Api para devolver el DTO Account en JSON
==================================================*/
export const apiForGettingAccounts: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const apiForGettingAccounts_logger = logger.forMethod(apiForGettingAccounts.name, LOGGER_EVENTS.ACCOUNT, auth_req.user.id)
  const started_at = performance.now()
  try {
    apiForGettingAccounts_logger.debug('Obteniendo cuentas')
    const response: DTOAccountsResponse = await getAccountsForApi(auth_req)
    apiForGettingAccounts_logger.info(`Cuentas obtenidas desde: ${response.metadata.source}`, { number_of_rows: response.metadata.number_of_rows })
    res.json(response.accounts)
  } catch (error) {
    apiForGettingAccounts_logger.error('Error al listar cuentas', parseError(error))
    res.status(500).json({ error: 'Error al listar cuentas' })
  } finally {
    const ended_at = performance.now()
    const elapsed_ms = ended_at - started_at
    apiForGettingAccounts_logger.elapsedTime('Elapsed time', { elapsed_ms })
    apiForGettingAccounts_logger.debug('Fin de la operación de listado de cuentas')
  }
}
