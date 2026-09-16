import { Request, Response, NextFunction } from 'express'
import { AuthRequest } from '../types/auth-request'
import { ReceivableBalanceService } from '../services/receivable-balance.service'
import { logger } from '../utils/logger.util'
import { parseError } from '../utils/error.util'

export const injectReceivableBalance = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const auth_req = req as AuthRequest
        if (!auth_req.user) return next()
        const receivable_balance = await ReceivableBalanceService.getPendingReceivableBalance(auth_req.user.id)
        res.locals.receivable_balance = receivable_balance
        next()
    } catch (error) {
        logger.error(`${injectReceivableBalance.name}-Error. `, parseError(error))
        next(error)
    }
}
