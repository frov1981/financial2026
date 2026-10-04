import { RequestHandler } from 'express'
import { AuthRequest } from '../types/auth-request'

export const adminOnlyMiddleware: RequestHandler = (req, res, next) => {
  const auth_req = req as AuthRequest
  if (auth_req.user?.role !== 'ADMIN') {
    return res.status(403).send('Acceso restringido a administradores.')
  }
  next()
}
