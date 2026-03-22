import { Request, RequestHandler, Response } from 'express'
import { DTOAccount, getAccountById, getAccountsForApi } from '../../cache/cache-accounts.service'
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
  try {
    const accounts: DTOAccount[] = await getAccountsForApi(auth_req)
    res.json(accounts)
  } catch (error) {
    logger.error(`${apiForGettingAccounts.name}-Error. `, parseError(error))
    res.status(500).json({ error: 'Error al listar cuentas' })
  } finally {
  }
}
