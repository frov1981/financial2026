import { NextFunction, Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../config/datasource'
import { User } from '../entities/User.entity'
import { AuthRequest } from '../types/AuthRequest'

export const sessionAuthMiddleware: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionUserId = (req.session as any)?.userId

    if (!sessionUserId) {
      const isApiRequest =
        req.originalUrl.startsWith('/api') ||
        req.headers.accept?.includes('application/json')

      if (isApiRequest) {
        return res.status(401).json({ error: 'No autorizado' })
      }

      return res.redirect('/login')
    }

    const user = await AppDataSource.getRepository(User).findOneBy({ id: sessionUserId })
    if (!user) {
      const isApiRequest =
        req.originalUrl.startsWith('/api') ||
        req.headers.accept?.includes('application/json')

      if (isApiRequest) {
        return res.status(401).json({ error: 'Usuario no encontrado' })
      }

      return res.redirect('/login')
    }

    ; (req as AuthRequest).user = user
    next()
  } catch (err) {
    console.error('sessionAuthMiddleware error:', err)
    res.status(500).json({ error: 'Error interno de autenticación' })
  }
}
