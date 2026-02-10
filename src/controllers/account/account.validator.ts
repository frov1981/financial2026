import { validate } from 'class-validator'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Account } from '../../entities/Account.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validateSaveAccount = async (auth_req: AuthRequest, account: Account): Promise<Record<string, string> | null> => {
    const user_id = auth_req.user.id
    const errors = await validate(account)
    const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}

    if (account.id && account.is_active === false && account.balance !== 0) {
        field_errors.is_active = 'No se puede desactivar la cuenta si tiene un balance mayor a cero'
    }

    if (account.name && user_id) {
        const repo_account = AppDataSource.getRepository(Account)

        const existing = await repo_account.findOne({
            where: {
                name: account.name,
                user: { id: user_id }
            }
        })

        if (existing && existing.id !== account.id) {
            field_errors.name = 'Ya existe una cuenta con este nombre'
        }
    }

    return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeleteAccount = async (auth_req: AuthRequest, account: Account): Promise<Record<string, string> | null> => {

    const user_id = auth_req.user.id
    const field_errors: Record<string, string> = {}

    // =========================
    // BALANCE VALIDATION
    // =========================
    if (account.balance !== 0) {
        field_errors.general =
            'No se puede eliminar la cuenta porque tiene balance distinto de cero'
    }

    // =========================
    // TRANSACTION REFERENCE VALIDATION
    // =========================
    const transaction_repo = AppDataSource.getRepository(Transaction)

    const used_in_transactions = await transaction_repo.existsBy([
        { account: { id: account.id } },
        { to_account: { id: account.id } }
    ])

    if (used_in_transactions) {
        if (field_errors.general) {
            field_errors.general += ' y tiene transacciones asociadas'
        } else {
            field_errors.general =
                'No se puede eliminar la cuenta porque tiene transacciones asociadas'
        }
    }

    return Object.keys(field_errors).length > 0 ? field_errors : null
}
