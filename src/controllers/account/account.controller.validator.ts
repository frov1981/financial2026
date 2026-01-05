import { validate } from 'class-validator'
import { AppDataSource } from '../../config/datasource'
import { Account } from '../../entities/Account.entity'
import { AuthRequest } from '../../types/AuthRequest'
import { logger } from '../../utils/logger.util'
import { mapValidationErrors } from '../../validators/mapValidationErrors.validator'

export const validateAccount = async (account: Account, authReq: AuthRequest): Promise<Record<string, string> | null> => {
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

    logger.warn(`Account validation`, { userId, fieldErrors })
    return Object.keys(fieldErrors).length > 0 ? fieldErrors : null
}
