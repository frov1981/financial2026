import { NextFunction, Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../config/typeorm.datasource'
import { User } from '../entities/User.entity'
import { AuthRequest } from '../types/auth-request'
import { logger } from '../utils/logger.util'

export const sessionAuthMiddleware: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    /* ============================
       Modo desarrollo: auto-login
    ============================ */
    if (process.env.NODE_ENV === 'development') {
      const devUser = await AppDataSource.getRepository(User).findOneBy({ id: 1 })
      if (devUser) {
        const authReq = req as AuthRequest
        authReq.user = devUser
        authReq.timezone = (req.session as any)?.timezone || 'America/Guayaquil'
      }
    }

    /* ============================
       Verificar sesión
    ============================ */
    const sessionUserId = (req.session as any)?.userId

    if (!sessionUserId) {
      return res.redirect('/login')
    }

    /* ============================
       Cargar usuario
    ============================ */
    const user = await AppDataSource.getRepository(User).findOneBy({ id: sessionUserId })

    if (!user) {
      return res.redirect('/login')
    }

    /* ============================
       Adjuntar usuario al request
    ============================ */
    const authReq = req as AuthRequest
    authReq.user = user
    authReq.timezone = (req.session as any)?.timezone || 'UTC'
    next()
  } catch (err) {
    logger.error('Error en sessionAuthMiddleware:', err)
    return res.redirect('/login')
  }
}
