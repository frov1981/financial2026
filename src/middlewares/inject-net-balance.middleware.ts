import { NextFunction, Request, RequestHandler, Response } from 'express'
import { AccountBalanceService } from '../services/account-balance.service'
import { AuthRequest } from '../types/auth-request'
import { logger } from '../utils/logger.util'
import { parseError } from '../utils/error.util'

export const injectNetBalance: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    const auth_req = req as AuthRequest
    const user_id = auth_req.user?.id
    const injectNetBalance_logger = logger.forMethod(injectNetBalance.name, 'INJECT_NET_BALANCE', user_id ?? null)
    try {
        const user = auth_req.user
        if (!user) return next()
        const net_balance = await AccountBalanceService.getNetAvailableBalance(user.id)
        res.locals.net_balance = net_balance
        next()
    } catch (error) {
        injectNetBalance_logger.error('Error inyectando balance neto', parseError(error))
        next(error)
    }
}
