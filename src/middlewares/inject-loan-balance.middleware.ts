import { Request, Response, NextFunction } from 'express'
import { AuthRequest } from '../types/auth-request'
import { LoanBalanceService } from '../services/loan-balance.service'
import { logger } from '../utils/logger.util'

export const injectLoanBalance = async (req: Request, res: Response, next: NextFunction) => {
    try {
        logger.debug(`${injectLoanBalance.name}-Middleware ejecutado`)
        const auth_req = req as AuthRequest
        if (!auth_req.user) return next()
        const loan_balance = await LoanBalanceService.getPendingLoanBalance(auth_req.user.id)
        res.locals.loan_balance = loan_balance
        logger.debug(`${injectLoanBalance.name}-Balance inyectado para usuario [${auth_req.user.id}]=[${loan_balance}]`)
        next()
    } catch (error) {
        logger.error(`${injectLoanBalance.name}-Error. `, error)
        next(error)
    }
}
