import { NextFunction, Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../config/typeorm.datasource'
import { User } from '../entities/User.entity'
import { AuthRequest } from '../types/auth-request'
import { logger } from '../utils/logger.util'

export const sessionAuthMiddleware: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionUserId = (req.session as any)?.userId
    if (!sessionUserId) return res.redirect('/login')

    const user = await AppDataSource.getRepository(User).findOneBy({ id: sessionUserId })
    if (!user) return res.redirect('/login')

    const authReq = req as AuthRequest
    authReq.user = user
    authReq.timezone = (req.session as any)?.timezone || 'UTC'

    next()
  } catch (err) {
    logger.error(`${sessionAuthMiddleware.name}-Error. `, err)
    return res.redirect('/login')
  }
}
