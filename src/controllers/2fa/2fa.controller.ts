import bcrypt from 'bcryptjs'
import { Request, RequestHandler, Response } from 'express'
import { IsNull, MoreThan } from 'typeorm'
import { deleteAll } from '../../cache/cache-key.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { AuthCode } from '../../entities/AuthCode.entity'
import { User } from '../../entities/User.entity'
import { send2FACode } from '../../services/send-2fa.service'
import { AuthRequest } from '../../types/auth-request'
import { compareCode } from '../../utils/auth-code.util'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'
import { regenerateSession, saveSession } from './2fa.auxiliar'

export const show2FA = (req: Request, res: Response) => {
  if (!req.session.pending2FAUserId) {
    return res.redirect('/login')
  }

  res.render('pages/2fa/form', { error: null })
}

export const verify2FA = async (req: Request, res: Response) => {
  const pendingUserId = req.session.pending2FAUserId
  const verify2FA_logger = logger.forMethod(verify2FA.name, 'VERIFY_2FA', pendingUserId ?? null)
  try {
    const { code } = req.body
    if (!pendingUserId) return res.redirect('/login')
    const repo = AppDataSource.getRepository(AuthCode)

    const authCode = await repo.findOne({
      where: {
        user: { id: pendingUserId },
        used_at: IsNull(),
        expires_at: MoreThan(new Date())
      },
      relations: ['user']
    })

    if (!authCode) {
      return res.render('pages/2fa/form', { error: 'Código inválido o expirado' })
    }

    const isValid = await compareCode(code, authCode.code_hash)
    if (!isValid) {
      authCode.attempts += 1
      await repo.save(authCode)
      return res.render('pages/2fa/form', { error: 'Código incorrecto' })
    }

    authCode.used_at = new Date()
    await repo.save(authCode)

    const preservedTimezone = req.session.timezone
    delete req.session.pending2FAUserId

    try {
      await regenerateSession(req)
    } catch (error) {
      verify2FA_logger.error('Regeneracion de sesion fallida', parseError(error))
      return res.redirect('/login')
    }

    req.session.user_id = pendingUserId
    req.session.timezone = preservedTimezone

    try {
      await saveSession(req)
    } catch (error) {
      verify2FA_logger.error('Error al guardar la sesion', parseError(error))
      return res.redirect('/login')
    }

    return res.redirect('/home')
  } catch (error) {
    verify2FA_logger.error('Error en verificacion del 2FA', parseError(error))
    return res.render('pages/2fa/form', { error: 'Error validando el código' })
  }
}

export const apiForValidatingLogin = async (req: Request, res: Response) => {
  const apiForValidatingLogin_logger = logger.forMethod(apiForValidatingLogin.name, 'LOGIN')
  try {
    const selected_fields: (keyof User)[] = ['id', 'email', 'password_hash', 'name', 'created_at']
    const timezone = String(req.body.timezone || 'UTC')
    const { username, password } = req.body
    const user_repo = AppDataSource.getRepository(User)
    const user = await user_repo.findOne({
      where: { name: username },
      select: selected_fields
    })
    if (!user) {
      return res.render('pages/login/form', { error: 'Usuario no encontrado' })
    }
    const valid_password = await bcrypt.compare(password, user.password_hash)
    if (!valid_password) {
      return res.render('pages/login/form', { error: 'Contraseña incorrecta' })
    }

    if (process.env.MAIL_SKIP_2FA === 'true') {
      await regenerateSession(req)
      req.session.user_id = user.id
      req.session.timezone = timezone
      await saveSession(req)
      apiForValidatingLogin_logger.info('Inicio de sesión sin 2FA por configuración', { user_id: user.id, timezone })
      return res.redirect('/home')
    }

    req.session.timezone = timezone
    apiForValidatingLogin_logger.info('Inicio de sesión con 2FA', { user_id: user.id, timezone })
    await send2FACode(user)
    req.session.pending2FAUserId = user.id
    await saveSession(req)
    return res.redirect('/2fa')
  } catch (error) {
    apiForValidatingLogin_logger.error('Error validando inicio de sesión', parseError(error))
    return res.render('pages/login/form', { error: 'Error de inicio de sesión, intenta de nuevo' })
  }
}

export const apiForLogout: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const apiForLogout_logger = logger.forMethod(apiForLogout.name, 'LOGOUT', auth_req.user.id)
  const started_at = performance.now()
  try {
    req.session.destroy(err => {
      if (err) {
        apiForLogout_logger.error('Error destruyendo sesión', err)
        return res.redirect('/home')
      }
      deleteAll(auth_req, 'home')
      res.clearCookie('connect.sid')
      return res.redirect('/login')
    })
  } catch (error) {
    apiForLogout_logger.error('Error cerrando sesión', parseError(error))
    return res.redirect('/login')
  } finally {
    const ended_at = performance.now()
    const elapsed_ms = ended_at - started_at
    apiForLogout_logger.elapsedTime('Elapsed time', { elapsed_ms })
  }
}