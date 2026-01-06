import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/datasource'
import { Account } from '../../entities/Account.entity'
import { AuthRequest } from '../../types/AuthRequest'
import { logger } from '../../utils/logger.util'
import { validateDeleteAccount, validateSaveAccount } from './account.controller.validator'

export const saveAccount: RequestHandler = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest
  const repo = AppDataSource.getRepository(Account)
  const txId = req.body.id ? Number(req.body.id) : req.params.id ? Number(req.params.id) : undefined
  const action = req.body.action || 'save'

  let tx: Account
  let mode

  if (action === 'save') {
    if (txId) {
      const existing = await repo.findOne({ where: { id: txId, user: { id: authReq.user.id } } })
      if (!existing) {
        return res.redirect('/accounts')
      }

      if (req.body.is_active !== undefined) {
        mode = 'status'
        existing.is_active = req.body.is_active === 'true'
      } else {
        mode = 'update'
        if (req.body.type) { existing.type = req.body.type }
        if (req.body.name) { existing.name = req.body.name }
      }
      tx = existing
    } else {
      mode = 'insert'
      tx = repo.create({
        user: { id: authReq.user.id },
        type: req.body.type,
        name: req.body.name,
        is_active: true,
        balance: 0
      })
    }

    logger.info(`Before saving account`, { userId: authReq.user.id, mode, tx })

    const errors = await validateSaveAccount(tx, authReq)

    if (errors) {
      return res.render(
        'layouts/main',
        {
          title: mode === 'insert' ? 'Insertar Cuenta' : mode === 'update' ? 'Editar Cuenta' : 'Cambiar Estado de Cuenta',
          view: 'pages/accounts/form',
          account: {
            ...req.body,
            is_active: req.body.is_active === 'true' ? true : false
          },
          errors,
          mode,
        })
    }

    await repo.save(tx)
    logger.info(`Account saved to database.`)
    res.redirect('/accounts')

  } else if (action === 'delete') {
    const existing = await repo.findOne({ where: { id: txId, user: { id: authReq.user.id } } })
    if (!existing) {
      return res.redirect('/accounts')
    }

    mode = 'delete'
    if (req.body.type) { existing.type = req.body.type }
    if (req.body.name) { existing.name = req.body.name }

    logger.info(`Before deleting account`, { userId: authReq.user.id, mode, existing })

    const errors = await validateDeleteAccount(existing, authReq)

    if (errors) {
      return res.render(
        'layouts/main',
        {
          title: mode === 'delete' ? 'Eliminar Cuenta' : '',
          view: 'pages/accounts/form',
          account: {
            ...req.body,
            is_active: req.body.is_active === 'true' ? true : false
          },
          errors,
          mode,
        })
    }

    await repo.delete(existing.id)
    logger.info(`Account deleted from database.`)
    res.redirect('/accounts')
  }
}
