import { Request, Response, NextFunction } from 'express'
import { AuthRequest } from '../types/auth-request'
import { ReceivableBalanceService } from '../services/receivable-balance.service'
import { logger } from '../utils/logger.util'
import { parseError } from '../utils/error.util'

export const injectReceivableBalance = async (req: Request, res: Response, next: NextFunction) => {
    const auth_req = req as AuthRequest
    const injectReceivableBalance_logger = logger.forMethod(injectReceivableBalance.name, 'INJECT_RECEIVABLE_BALANCE', auth_req.user?.id ?? null)
    const started_at = performance.now()
    try {
        if (!auth_req.user) return next()
        const receivable_balance = await ReceivableBalanceService.getPendingReceivableBalance(auth_req.user.id)
        res.locals.receivable_balance = receivable_balance
        next()
    } catch (error) {
        injectReceivableBalance_logger.error('Error inyectando balance por cobrar', parseError(error))
        next(error)
    } finally {
        const ended_at = performance.now()
        const elapsed_ms = ended_at - started_at
        injectReceivableBalance_logger.elapsedTime('Elapsed time', { elapsed_ms })
        injectReceivableBalance_logger.debug('Fin de la operación de inyección de balance por cobrar')
    }
}
