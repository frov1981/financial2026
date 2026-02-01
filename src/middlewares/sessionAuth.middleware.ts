import { NextFunction, Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../config/datasource'
import { User } from '../entities/User.entity'
import { AuthRequest } from '../types/AuthRequest'
import { logger } from '../utils/logger.util'

export const sessionAuthMiddleware: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    /* ============================
       Modo desarrollo: auto-login
    ============================ */
    if (process.env.NODE_ENV === 'development') {
      const devUser = await AppDataSource.getRepository(User).findOneBy({ id: 1 })
      if (devUser) {
        (req as AuthRequest).user = devUser
        return next()
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
    ;(req as AuthRequest).user = user
    next()
  } catch (err) {
    logger.error('Error en sessionAuthMiddleware:', err)
    return res.redirect('/login')
  }
}
