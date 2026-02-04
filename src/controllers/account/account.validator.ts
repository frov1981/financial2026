import { validate } from 'class-validator'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Account } from '../../entities/Account.entity'
import { AuthRequest } from '../../types/auth-request'
import { logger } from '../../utils/logger.util'
import { mapValidationErrors } from '../../validators/map-errors.validator'
import { Transaction } from '../../entities/Transaction.entity'

export const validateSaveAccount = async (authReq: AuthRequest, account: Account): Promise<Record<string, string> | null> => {
    const userId = authReq.user.id
    const errors = await validate(account)
    const fieldErrors = errors.length > 0 ? mapValidationErrors(errors) : {}

    if (account.id && account.is_active === false && Number(account.balance) !== 0) {
        fieldErrors.is_active = 'No se puede desactivar la cuenta si tiene un balance mayor a cero'
    }

    if (account.name && userId) {
        const repo = AppDataSource.getRepository(Account)

        const existing = await repo.findOne({
            where: {
                name: account.name,
                user: { id: userId }
            }
        })

        if (existing && existing.id !== account.id) {
            fieldErrors.name = 'Ya existe una cuenta con este nombre'
        }
    }

    logger.warn(`Account save validation`, { userId, fieldErrors })
    return Object.keys(fieldErrors).length > 0 ? fieldErrors : null
}

export const validateDeleteAccount = async (
    authReq: AuthRequest,
    account: Account
): Promise<Record<string, string> | null> => {

    const userId = authReq.user.id
    const fieldErrors: Record<string, string> = {}

    // =========================
    // BALANCE VALIDATION
    // =========================
    if (Number(account.balance) !== 0) {
        fieldErrors.general =
            'No se puede eliminar la cuenta porque tiene balance distinto de cero'
    }

    // =========================
    // TRANSACTION REFERENCE VALIDATION
    // =========================
    const transactionRepo = AppDataSource.getRepository(Transaction)

    const usedInTransactions = await transactionRepo.existsBy([
        { account: { id: account.id } },
        { to_account: { id: account.id } }
    ])

    if (usedInTransactions) {
        fieldErrors.general =
            'No se puede eliminar la cuenta porque tiene transacciones asociadas'
    }

    logger.warn('Account delete validation', { userId, accountId: account.id, fieldErrors })

    return Object.keys(fieldErrors).length > 0 ? fieldErrors : null
}

