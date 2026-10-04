import { Request, Response, NextFunction } from 'express'
import { AuthRequest } from '../types/auth-request'
import { ReceivableBalanceService } from '../services/receivable-balance.service'
import { logger } from '../utils/logger.util'
import { parseError } from '../utils/error.util'

const lastReceivableBalanceByUser = new Map<number, number>()

export const injectReceivableBalance = async (req: Request, res: Response, next: NextFunction) => {
    const auth_req = req as AuthRequest
    const injectReceivableBalance_logger = logger.forMethod(injectReceivableBalance.name, 'INJECT_RECEIVABLE_BALANCE', auth_req.user?.id ?? null)
    try {
        if (!auth_req.user) return next()
        const receivable_balance = await ReceivableBalanceService.getPendingReceivableBalance(auth_req.user.id)
        res.locals.receivable_balance = receivable_balance
        const previous_receivable_balance = lastReceivableBalanceByUser.get(auth_req.user.id)
        if (previous_receivable_balance !== undefined && previous_receivable_balance !== receivable_balance) {
            injectReceivableBalance_logger.info('El balance por cobrar cambió', {
                previous_receivable_balance,
                receivable_balance,
            })
        }
        lastReceivableBalanceByUser.set(auth_req.user.id, receivable_balance)
        next()
    } catch (error) {
        injectReceivableBalance_logger.error('Error inyectando balance por cobrar', parseError(error))
        next(error)
    }
}
