import { NextFunction, Request, RequestHandler, Response } from 'express'
import { AccountBalanceService } from '../services/account-balance.service'
import { AuthRequest } from '../types/auth-request'
import { logger } from '../utils/logger.util'

export const injectNetBalance: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {

    try {
        logger.debug(`${injectNetBalance.name}-Middleware ejecutado`)
        const auth_req = req as AuthRequest
        const user = auth_req.user
        if (!user) return next()
        const net_balance = await AccountBalanceService.getNetAvailableBalance(user.id)
        res.locals.net_balance = net_balance
        logger.debug(`${injectNetBalance.name}-Balance inyectado para usuario [${user.id}]=[${net_balance}]`)
        next()
    } catch (error) {
        logger.error(`${injectNetBalance.name}-Error. `, error)
        next(error)
    }
}
