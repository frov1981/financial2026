import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/datasource'
import { Account } from '../../entities/Account.entity'
import { AuthRequest } from '../../types/AuthRequest'
import { logger } from '../../utils/logger.util'
import { recalculateAllAccountBalances } from './account.controller.auxiliar'
export { saveAccount as apiForSavingAccount } from './account.controller.saving'

export const apiForGettingAccounts: RequestHandler = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest

  try {
    const repository = AppDataSource.getRepository(Account)

    const result = await repository
      .createQueryBuilder('account')
      .where('account.user_id = :userId', { userId: authReq.user.id })
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
  } catch (err) {
    logger.error('Error al listar cuentas:', err)
    res.status(500).json({ error: 'Error al listar cuentas' })
  }
}

export const recalculateBalancesAPI: RequestHandler = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest

    await recalculateAllAccountBalances(authReq)

    res.json({
      success: true,
      message: 'Balances recalculados correctamente'
    })

  } catch (error) {
    logger.error('Error al recalcular balances', error)

    res.status(500).json({
      success: false,
      message: 'Error al recalcular balances'
    })
  }
}

export const routeToPageAccount = (req: Request, res: Response) => {
  const authReq = req as AuthRequest

  res.render(
    'layouts/main',
    {
      title: 'Cuentas',
      view: 'pages/accounts/index',
      USER_ID: authReq.user?.id || 'guest'
    })
}

export const routeToFormInsertAccount: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'insert'
  const authReq = req as AuthRequest

  res.render(
    'layouts/main',
    {
      title: 'Insertar Cuenta',
      view: 'pages/accounts/form',
      account: {
        type: null,
        is_active: true,
      },
      errors: {},
      mode,
    })
}

export const routeToFormUpdateAccount: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'update'
  const authReq = req as AuthRequest
  const accountId = Number(req.params.id)

  if (!Number.isInteger(accountId) || accountId <= 0) {
    return res.redirect('/accounts')
  }

  const repoAccount = AppDataSource.getRepository(Account)
  const account = await repoAccount.findOne({
    where: { id: accountId, user: { id: authReq.user.id } },
  })

  if (!account) {
    return res.redirect('/accounts')
  }

  res.render(
    'layouts/main',
    {
      title: 'Editar Cuenta',
      view: 'pages/accounts/form',
      account: {
        id: account.id,
        type: account.type,
        name: account.name
      },
      errors: {},
      mode
    })
}

export const routeToFormDeleteAccount: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'delete'
  const authReq = req as AuthRequest
  const accountId = Number(req.params.id)

  if (!Number.isInteger(accountId) || accountId <= 0) {
    return res.redirect('/accounts')
  }

  const repoAccount = AppDataSource.getRepository(Account)
  const account = await repoAccount.findOne({
    where: { id: accountId, user: { id: authReq.user.id } },
  })

  if (!account) {
    return res.redirect('/accounts')
  }

  res.render(
    'layouts/main',
    {
      title: 'Eliminar Cuenta',
      view: 'pages/accounts/form',
      account: {
        id: account.id,
        type: account.type,
        name: account.name
      },
      errors: {},
      mode
    })
}

export const routeToFormUpdateStatusAccount: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'status'
  const authReq = req as AuthRequest
  const accountId = Number(req.params.id)

  if (!Number.isInteger(accountId) || accountId <= 0) {
    return res.redirect('/accounts')
  }

  const repoAccount = AppDataSource.getRepository(Account)
  const account = await repoAccount.findOne({
    where: { id: accountId, user: { id: authReq.user.id } },
  })

  if (!account) {
    return res.redirect('/accounts')
  }

  res.render(
    'layouts/main',
    {
      title: 'Cambiar Estado de Cuenta',
      view: 'pages/accounts/form',
      account: {
        id: account.id,
        type: account.type,
        name: account.name,
        is_active: account.is_active
      },
      errors: {},
      mode
    })
}
