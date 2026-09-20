import { Request, Response, NextFunction } from 'express'
import { AuthRequest } from '../types/auth-request'
import { PayableBalanceService } from '../services/payable-balance.service'
import { logger } from '../utils/logger.util'
import { parseError } from '../utils/error.util'

export const injectPayableBalance = async (req: Request, res: Response, next: NextFunction) => {
    const auth_req = req as AuthRequest
    const injectPayableBalance_logger = logger.forMethod(injectPayableBalance.name, 'INJECT_PAYABLE_BALANCE', auth_req.user?.id ?? null)
    const started_at = performance.now()
    try {
        if (!auth_req.user) return next()
        const payable_balance = await PayableBalanceService.getPendingPayableBalance(auth_req.user.id)
        res.locals.payable_balance = payable_balance
        next()
    } catch (error) {
        injectPayableBalance_logger.error('Error inyectando balance por pagar', parseError(error))
        next(error)
    } finally {
        const ended_at = performance.now()
        const elapsed_ms = ended_at - started_at
        injectPayableBalance_logger.elapsedTime('Elapsed time', { elapsed_ms })
        injectPayableBalance_logger.debug('Fin de la operación de inyección de balance por pagar')
    }
}
