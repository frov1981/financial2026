import { LOGGER_EVENTS } from '../utils/logger-events'
import { Request, Response, NextFunction } from 'express'
import { AuthRequest } from '../types/auth-request'
import { PayableBalanceService } from '../services/payable-balance.service'
import { logger } from '../utils/logger.util'
import { parseError } from '../utils/error.util'

const lastPayableBalanceByUser = new Map<number, number>()

export const injectPayableBalance = async (req: Request, res: Response, next: NextFunction) => {
    const auth_req = req as AuthRequest
    const injectPayableBalance_logger = logger.forMethod(injectPayableBalance.name, LOGGER_EVENTS.MIDDLEWARE, auth_req.user?.id ?? null)
    try {
        if (!auth_req.user) return next()
        const payable_balance = await PayableBalanceService.getPendingPayableBalance(auth_req.user.id)
        res.locals.payable_balance = payable_balance
        const previous_payable_balance = lastPayableBalanceByUser.get(auth_req.user.id)
        if (previous_payable_balance !== undefined && previous_payable_balance !== payable_balance) {
            injectPayableBalance_logger.info('El balance por pagar cambió', {
                previous_payable_balance,
                payable_balance,
            })
        }
        lastPayableBalanceByUser.set(auth_req.user.id, payable_balance)
        next()
    } catch (error) {
        injectPayableBalance_logger.error('Error inyectando balance por pagar', parseError(error))
        next(error)
    }
}
