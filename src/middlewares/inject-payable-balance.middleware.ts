import { Request, Response, NextFunction } from 'express'
import { AuthRequest } from '../types/auth-request'
import { PayableBalanceService } from '../services/payable-balance.service'
import { logger } from '../utils/logger.util'
import { parseError } from '../utils/error.util'

export const injectPayableBalance = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const auth_req = req as AuthRequest
        if (!auth_req.user) return next()
        const payable_balance = await PayableBalanceService.getPendingPayableBalance(auth_req.user.id)
        res.locals.payable_balance = payable_balance
        next()
    } catch (error) {
        logger.error(`${injectPayableBalance.name}-Error. `, parseError(error))
        next(error)
    }
}
