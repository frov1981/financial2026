import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Account } from '../../entities/Account.entity'
import { accountFormMatrix } from '../../policies/account-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { BaseFormViewParams } from '../../types/form-view-params'
import { logger } from '../../utils/logger.util'
export { saveAccount as apiForSavingAccount } from './account.saving'

type AccountFormViewParams = BaseFormViewParams & {
  account: any
}

const renderAccountForm = async (res: Response, params: AccountFormViewParams) => {
  const { title, view, account, errors, mode, auth_req } = params
  const account_form_policy = accountFormMatrix[mode]

  return res.render('layouts/main', {
    mode,
    title,
    view,
    account,
    errors,
    account_form_policy,
  })
}

export const apiForGettingAccounts: RequestHandler = async (req: Request, res: Response) => {
  logger.debug(`${apiForGettingAccounts.name}-Start`)
  const auth_req = req as AuthRequest
  try {
    const repository = AppDataSource.getRepository(Account)
    const result = await repository
      .createQueryBuilder('account')
      .where('account.user_id = :user_id', { user_id: auth_req.user.id })
      .addSelect(subQuery =>
        subQuery
          .select('COUNT(t.id)')
          .from('transactions', 't')
          .where('t.account_id = account.id'),
        'transaction_count'
      )
      .orderBy('account.name', 'ASC')
      .getRawAndEntities()
    const accounts = result.entities.map((account, index) => ({
      ...account,
      transaction_count: Number(result.raw[index].transaction_count)
    }))
    res.json(accounts)
  } catch (error) {
    logger.error(`${apiForGettingAccounts.name}-Error. `, error)
    res.status(500).json({ error: 'Error al listar cuentas' })
  } finally {
    logger.debug(`${apiForGettingAccounts.name}-End`)
  }
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
    account: {
      type: null,
      is_active: true
    },
    errors: {},
    mode,
    auth_req
  })
}

export const routeToFormUpdateAccount: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'update'
  const auth_req = req as AuthRequest
  const account_id = Number(req.params.id)
  if (!Number.isInteger(account_id) || account_id <= 0) {
    return res.redirect('/accounts')
  }
  const repo_account = AppDataSource.getRepository(Account)
  const account = await repo_account.findOne({
    where: { id: account_id, user: { id: auth_req.user.id } }
  })
  if (!account) {
    return res.redirect('/accounts')
  }
  return renderAccountForm(res, {
    title: 'Editar Cuenta',
    view: 'pages/accounts/form',
    account: {
      id: account.id,
      type: account.type,
      name: account.name,
      is_active: account.is_active,
    },
    errors: {},
    mode,
    auth_req
  })
}

export const routeToFormDeleteAccount: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'delete'
  const auth_req = req as AuthRequest
  const account_id = Number(req.params.id)
  if (!Number.isInteger(account_id) || account_id <= 0) {
    return res.redirect('/accounts')
  }
  const repo_account = AppDataSource.getRepository(Account)
  const account = await repo_account.findOne({
    where: { id: account_id, user: { id: auth_req.user.id } }
  })
  if (!account) {
    return res.redirect('/accounts')
  }
  return renderAccountForm(res, {
    title: 'Eliminar Cuenta',
    view: 'pages/accounts/form',
    account: {
      id: account.id,
      type: account.type,
      name: account.name,
      is_active: account.is_active,
    },
    errors: {},
    mode,
    auth_req
  })
}

export const routeToFormUpdateStatusAccount: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'update'
  const auth_req = req as AuthRequest
  const account_id = Number(req.params.id)

  if (!Number.isInteger(account_id) || account_id <= 0) {
    return res.redirect('/accounts')
  }

  const repo_account = AppDataSource.getRepository(Account)
  const account = await repo_account.findOne({
    where: { id: account_id, user: { id: auth_req.user.id } }
  })

  if (!account) {
    return res.redirect('/accounts')
  }

  return renderAccountForm(res, {
    title: 'Cambiar Estado de Cuenta',
    view: 'pages/accounts/form',
    account: {
      id: account.id,
      type: account.type,
      name: account.name,
      is_active: account.is_active
    },
    errors: {},
    mode,
    auth_req
  })
}

