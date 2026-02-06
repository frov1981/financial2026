import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Account } from '../../entities/Account.entity'
import { AuthRequest } from '../../types/auth-request'
import { logger } from '../../utils/logger.util'
import { validateDeleteAccount, validateSaveAccount } from './account.validator'
import { accountFormMatrix, AccountFormMode } from '../../policies/account-form.policy'
import { getNumberFromBody } from '../../utils/req-params.util'

/* ============================
   Título según modo
============================ */
const getTitle = (mode: AccountFormMode) => {
  switch (mode) {
    case 'insert': return 'Insertar Cuenta'
    case 'update': return 'Editar Cuenta'
    case 'status': return 'Cambiar Estado de Cuenta'
    case 'delete': return 'Eliminar Cuenta'
    default: return 'Indefinido'
  }
}

/* ============================
   Sanitizar payload según policy
============================ */
const sanitizeByPolicy = (mode: AccountFormMode, body: any) => {
  const policy = accountFormMatrix[mode]
  const clean: any = {}

  for (const field in policy) {
    if (policy[field] === 'edit' && body[field] !== undefined) {
      clean[field] = body[field]
    }
  }

  return clean
}

export const saveAccount: RequestHandler = async (req: Request, res: Response) => {
  logger.debug('saveAccount called', { body: req.body, param: req.params })

  const authReq = req as AuthRequest
  const repoAccount = AppDataSource.getRepository(Account)

  const accountId = getNumberFromBody(req, 'id')
  const mode: AccountFormMode = req.body.mode || 'insert'

  try {
    let existing: Account | null = null

    if (accountId) {
      existing = await repoAccount.findOne({
        where: { id: accountId, user: { id: authReq.user.id } }
      })
      if (!existing) throw new Error('Cuenta no encontrada')
    }

    /* ============================
       DELETE
    ============================ */
    if (mode === 'delete') {
      if (!existing) throw new Error('Cuenta no encontrada')

      logger.info('Before deleting account', { userId: authReq.user.id, mode, existing })

      const errors = await validateDeleteAccount(authReq, existing)
      if (errors) throw { validationErrors: errors }

      await repoAccount.delete(existing.id)
      logger.info('Account deleted from database.')

      return res.redirect('/accounts')
    }

    /* ============================
       INSERT / UPDATE / STATUS
    ============================ */
    let account: Account

    if (mode === 'insert') {
      account = repoAccount.create({
        user: { id: authReq.user.id } as any,
        type: req.body.type,
        name: req.body.name,
        is_active: true,
        balance: 0
      })
    } else {
      if (!existing) throw new Error('Cuenta no encontrada')
      account = existing
    }

    const clean = sanitizeByPolicy(mode, req.body)

    if (clean.type !== undefined) {
      account.type = clean.type
    }

    if (clean.name !== undefined) {
      account.name = clean.name
    }

    if (clean.is_active !== undefined) {
      account.is_active = clean.is_active === 'true'
    }

    logger.info('Before saving account', { userId: authReq.user.id, mode, account })

    const errors = await validateSaveAccount(authReq, account)
    if (errors) throw { validationErrors: errors }

    await repoAccount.save(account)
    logger.info('Account saved to database.')

    return res.redirect('/accounts')
  } catch (err: any) {
    logger.error('Error saving account', {
      userId: authReq.user.id,
      accountId,
      mode,
      error: err,
      stack: err?.stack
    })

    const validationErrors = err?.validationErrors || null
    const accountFormPolicy = accountFormMatrix[mode]

    return res.render('layouts/main', {
      title: getTitle(mode),
      view: 'pages/accounts/form',
      account: {
        ...req.body,
        is_active: req.body.is_active === 'true'
      },
      errors: validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' },
      accountFormPolicy,
      mode
    })
  }
}
