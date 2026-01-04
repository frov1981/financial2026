import { Request, Response, NextFunction, RequestHandler } from 'express'
import { AppDataSource } from '../config/datasource'
import { User } from '../entities/User.entity'
import { AuthRequest } from '../types/AuthRequest'

/*export const sessionAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if ((req.session as any)?.userId) return next()
  res.redirect('/login')
}*/

export const sessionAuthMiddleware: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionUserId = (req.session as any)?.userId
    if (!sessionUserId) return res.status(401).json({ error: 'No autorizado' })

    const user = await AppDataSource.getRepository(User).findOneBy({ id: sessionUserId })
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' })

    ;(req as AuthRequest).user = user
    next()
  } catch (err) {
    console.error('sessionAuthMiddleware error:', err)
    res.status(500).json({ error: 'Error interno de autenticación' })
  }
}
