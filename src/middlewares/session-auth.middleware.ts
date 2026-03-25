import { NextFunction, Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../config/typeorm.datasource'
import { User } from '../entities/User.entity'
import { AuthRequest } from '../types/auth-request'
import { logger } from '../utils/logger.util'
import { role_permissions } from '../policies/roles-user.policy'
import { parseError } from '../utils/error.util'


export const sessionAuthMiddleware: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session_user_id = (req.session as any)?.user_id
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
    logger.error(`${sessionAuthMiddleware.name}-Error. `, parseError(error))
    return res.redirect('/login')
  }
}

