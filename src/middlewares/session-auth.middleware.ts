import { NextFunction, Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../config/typeorm.datasource'
import { User } from '../entities/User.entity'
import { AuthRequest } from '../types/auth-request'
import { logger } from '../utils/logger.util'
import { role_permissions } from '../policies/roles-user.policy'
import { parseError } from '../utils/error.util'


export const sessionAuthMiddleware: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  const session_user_id = (req.session as any)?.user_id
  const sessionAuthMiddleware_logger = logger.forMethod(sessionAuthMiddleware.name, 'SESSION_AUTH', session_user_id ?? null)
  const started_at = performance.now()
  try {
    if (!session_user_id) return res.redirect('/login')

    const user = await AppDataSource.getRepository(User).findOneBy({ id: session_user_id })
    if (!user) return res.redirect('/login')

    const auth_req = req as AuthRequest
    auth_req.user = user
    auth_req.timezone = (req.session as any)?.timezone || 'UTC'

    const role =  user.role
    auth_req.role = role_permissions[role]

    next()
  } catch (error) {
    sessionAuthMiddleware_logger.error('Error autenticando sesión', parseError(error))
    return res.redirect('/login')
  } finally {
    const ended_at = performance.now()
    const elapsed_ms = ended_at - started_at
    sessionAuthMiddleware_logger.elapsedTime('Elapsed time', { elapsed_ms })
    sessionAuthMiddleware_logger.debug('Fin de la operación de autenticación de sesión')
  }
}

