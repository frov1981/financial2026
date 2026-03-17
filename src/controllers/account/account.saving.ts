import { Request, RequestHandler, Response } from 'express'
import { getAccountById } from '../../cache/cache-accounts.service'
import { deleteAll } from '../../cache/cache-key.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Account } from '../../entities/Account.entity'
import { accountFormMatrix } from '../../policies/account-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { AccountFormMode } from '../../types/form-view-params'
import { parseBoolean } from '../../utils/bool.util'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'
import { validateDeleteAccount, validateSaveAccount } from './account.validator'

/* ============================
   Título según modo
============================ */
const getTitle = (mode: AccountFormMode) => {
  switch (mode) {
    case 'insert': return 'Insertar Cuenta'
    case 'update': return 'Editar Cuenta'
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
    if ((policy[field] === 'editable' || policy[field] === 'readonly') && body[field] !== undefined) {
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
    is_active: parseBoolean(body.is_active)
  }
}

export const saveAccount: RequestHandler = async (req: Request, res: Response) => {
  logger.debug(`${saveAccount.name}-Start`)
  logger.info('saveAccount called', { body: req.body, param: req.params })
  const auth_req = req as AuthRequest
  const account_id = req.body.id ? Number(req.body.id) : undefined
  const mode: AccountFormMode = req.body.mode || 'insert'
  const repo_account = AppDataSource.getRepository(Account)

  const form_state = {
    account: buildAccountView(req.body),
    account_form_policy: accountFormMatrix[mode],
    mode
  }
  try {
    let existing: Account | null = null
    if (account_id) {
      existing = await getAccountById(auth_req, account_id)
      if (!existing) throw new Error('Cuenta no encontrada')
    }
    /* ============================
       DELETE
    ============================ */
    if (mode === 'delete') {
      if (!existing) throw new Error('Cuenta no encontrada')
      const errors = await validateDeleteAccount(auth_req, existing)
      if (errors) throw { validationErrors: errors }
      await repo_account.delete(existing.id)
      deleteAll(auth_req, 'account')
      logger.info('Account deleted from database.')
      return res.redirect('/accounts')
    }
    /* ============================
       INSERT / UPDATE
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
    /*=================================
      Aplicar sanitización por policy
    =================================*/
    const clean = sanitizeByPolicy(mode, req.body)
    if (clean.type !== undefined) { account.type = clean.type }
    if (clean.name !== undefined) { account.name = clean.name }
    if (clean.is_active !== undefined) { account.is_active = parseBoolean(clean.is_active) }
    const errors = await validateSaveAccount(auth_req, account)
    if (errors) throw { validationErrors: errors }
    /*=================================
      Guardar en base de datos y limpiar cache
    =================================*/
    await repo_account.save(account)
    logger.info('Account saved to database.')
    deleteAll(auth_req, 'account')
    return res.redirect('/accounts')
  } catch (err: any) {
    /* ============================
       Manejo de errores
    ============================ */
    logger.error('Error saving account', {
      user_id: auth_req.user.id,
      account_id,
      mode,
      error: parseError(err)
    })
    const validation_errors = err?.validationErrors || null
    return res.render('layouts/main', {
      title: getTitle(mode),
      view: 'pages/accounts/form',
      ...form_state,
      errors: validation_errors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
    })
  } finally {
    logger.debug(`${saveAccount.name}-End`)
  }
}
