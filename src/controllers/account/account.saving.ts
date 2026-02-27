import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Account } from '../../entities/Account.entity'
import { accountFormMatrix, AccountFormMode } from '../../policies/account-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { logger } from '../../utils/logger.util'
import { validateDeleteAccount, validateSaveAccount } from './account.validator'

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

/* ============================
   Construir objeto para la vista
============================ */
const buildAccountView = (body: any) => {
  return {
    ...body,
    is_active: body.is_active === 'true' || body.is_active === true
  }
}

export const saveAccount: RequestHandler = async (req: Request, res: Response) => {
  logger.debug('saveAccount called', { body: req.body, param: req.params })

  const auth_req = req as AuthRequest
  const repo_account = AppDataSource.getRepository(Account)

  const account_id = req.body.id ? Number(req.body.id) : undefined
  const mode: AccountFormMode = req.body.mode || 'insert'

  const account_view = buildAccountView(req.body)

  const form_state = {
    account: account_view,
    account_form_policy: accountFormMatrix[mode],
    mode
  }

  try {
    let existing: Account | null = null

    if (account_id) {
      existing = await repo_account.findOne({
        where: { id: account_id, user: { id: auth_req.user.id } }
      })
      if (!existing) throw new Error('Cuenta no encontrada')
    }

    /* ============================
       DELETE
    ============================ */
    if (mode === 'delete') {
      if (!existing) throw new Error('Cuenta no encontrada')

      logger.info('Before deleting account', { userId: auth_req.user.id, mode, existing })

      const errors = await validateDeleteAccount(auth_req, existing)
      if (errors) throw { validationErrors: errors }

      await repo_account.delete(existing.id)
      logger.info('Account deleted from database.')

      return res.redirect('/accounts')
    }

    /* ============================
       INSERT / UPDATE / STATUS
    ============================ */
    let account: Account

    if (mode === 'insert') {
      account = repo_account.create({
        user: { id: auth_req.user.id } as any,
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
      account.is_active = clean.is_active === 'true' || clean.is_active === true
    }

    logger.info('Before saving account', { userId: auth_req.user.id, mode, account })

    const errors = await validateSaveAccount(auth_req, account)
    if (errors) throw { validationErrors: errors }

    await repo_account.save(account)
    logger.info('Account saved to database.')

    return res.redirect('/accounts')

  } catch (err: any) {
    logger.error('Error saving account', {
      userId: auth_req.user.id,
      account_id,
      mode,
      error: err,
      stack: err?.stack
    })

    const validation_errors = err?.validationErrors || null

    return res.render('layouts/main', {
      title: getTitle(mode),
      view: 'pages/accounts/form',
      ...form_state,
      errors: validation_errors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
    })
  }
}
