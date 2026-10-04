import { LOGGER_EVENTS } from '../utils/logger-events'
import { NextFunction, Request, RequestHandler, Response } from 'express'
import { AccountBalanceService } from '../services/account-balance.service'
import { AuthRequest } from '../types/auth-request'
import { logger } from '../utils/logger.util'
import { parseError } from '../utils/error.util'

const lastNetBalanceByUser = new Map<number, number>()

export const injectNetBalance: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    const auth_req = req as AuthRequest
    const user_id = auth_req.user?.id
    const injectNetBalance_logger = logger.forMethod(injectNetBalance.name, LOGGER_EVENTS.MIDDLEWARE, user_id ?? null)
    try {
        const user = auth_req.user
        if (!user) return next()
        const net_balance = await AccountBalanceService.getNetAvailableBalance(user.id)
        res.locals.net_balance = net_balance
        const previous_net_balance = lastNetBalanceByUser.get(user.id)
        if (previous_net_balance !== undefined && previous_net_balance !== net_balance) {
            injectNetBalance_logger.info('El balance neto cambió', {
                previous_net_balance,
                net_balance,
            })
        }
        lastNetBalanceByUser.set(user.id, net_balance)
        next()
    } catch (error) {
        injectNetBalance_logger.error('Error inyectando balance neto', parseError(error))
        next(error)
    }
}
