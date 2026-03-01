import { Request, Response } from 'express'
import { IsNull, MoreThan } from 'typeorm'
import { AppDataSource } from '../../config/typeorm.datasource'
import { AuthCode } from '../../entities/AuthCode.entity'
import { compareCode } from '../../utils/auth-code.util'
import { logger } from '../../utils/logger.util'

export const show2FA = (req: Request, res: Response) => {
  if (!(req.session as any)?.pending2FAUserId) {
    return res.redirect('/login')
  }

  res.render(
    'pages/2fa',
    {
      error: null
    })
}

export const verify2FA = async (req: Request, res: Response) => {
  try {
    const { code } = req.body
    const pendingUserId = (req.session as any)?.pending2FAUserId

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
      return res.render(
        'pages/2fa',
        {
          error: 'Código inválido o expirado'
        })
    }

    const isValid = await compareCode(code, authCode.code_hash)
    if (!isValid) {
      authCode.attempts += 1
      await repo.save(authCode)
      return res.render(
        'pages/2fa',
        {
          error: 'Código incorrecto'
        })
    }

    authCode.used_at = new Date()
    await repo.save(authCode)

    // preserve timezone across session regeneration (otherwise it's lost)
    const preservedTimezone = (req.session as any).timezone

    delete (req.session as any).pending2FAUserId

    req.session.regenerate(err => {
      if (err) {
        logger.error(err)
        return res.redirect('/login')
      }

      ; (req.session as any).user_id = pendingUserId
      ; (req.session as any).timezone = preservedTimezone

      req.session.save(err2 => {
        if (err2) {
          logger.error(err2)
          return res.redirect('/login')
        }

        res.redirect('/home')
      })
    })

  } catch (error) {
    logger.error('verify2FA error', error)
    res.render(
      'pages/2fa',
      {
        error: 'Error validando el código'
      })
  }
}
