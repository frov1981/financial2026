// controllers/account.controller.ts
import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../config/datasource'
import { Account } from '../entities/Account.entity'
import { AuthRequest } from '../types/AuthRequest'
import { logger } from '../utils/logger.util'
import { recalculateAllAccountBalances } from './account.controller.auxiliar'
export { saveAccount } from './account.controller.saving'

export const listAccountsAPI: RequestHandler = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest

  try {
    const accounts = await AppDataSource.getRepository(Account).find({
      where: { user: { id: authReq.user.id } },
      order: { name: 'ASC' }
    })
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

export const insertAccountFormPage: RequestHandler = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest
  const mode = 'insert'

  res.render('layouts/main', {
    title: 'Nueva Cuenta',
    view: 'pages/accounts/form',
    account: {},
    errors: {},
    mode,
  })
}

export const updateAccountFormPage: RequestHandler = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest
  const txId = Number(req.params.id)
  const mode = 'update'

  const repo = AppDataSource.getRepository(Account)

  const tx = await repo.findOne({
    where: { id: txId, user: { id: authReq.user.id } },
  })

  if (!tx) {
    return res.redirect('/accounts')
  }

  res.render('layouts/main', {
    title: 'Editar Cuenta',
    view: 'pages/accounts/form',
    account: {
      id: tx.id,
      type: tx.type,
      name: tx.name
    },
    errors: {},
    mode
  })
}

export const updateAccountStatusFormPage: RequestHandler = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest
  const txId = Number(req.params.id)
  const mode = 'status'

  const repo = AppDataSource.getRepository(Account)

  const tx = await repo.findOne({
    where: { id: txId, user: { id: authReq.user.id } },
  })

  if (!tx) {
    return res.redirect('/accounts')
  }

  res.render('layouts/main', {
    title: 'Editar Estado Cuenta',
    view: 'pages/accounts/form',
    account: {
      id: tx.id,
      type: tx.type,
      name: tx.name,
      is_active: tx.is_active
    },
    errors: {},
    mode
  })
} 

export const accountsPage = (req: Request, res: Response) => {
  const authReq = req as AuthRequest
  res.render('layouts/main', {
    title: 'Cuentas',
    view: 'pages/accounts/index',    
    USER_ID: authReq.user?.id || 'guest'
  })
}
