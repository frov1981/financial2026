import { validate } from 'class-validator'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Account } from '../../entities/Account.entity'
import { Category } from '../../entities/Category.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/auth-request'
import { logger } from '../../utils/logger.util'

export const validateSaveTransaction = async (transaction: Transaction, auth_req: AuthRequest): Promise<Record<string, string> | null> => {
    const errors = await validate(transaction)
    const field_errors: Record<string, string> = {}

    if (errors.length > 0) {
        errors.forEach(err => {
            const message = err.constraints
                ? Object.values(err.constraints)[0]
                : err.children?.[0]?.constraints
                    ? Object.values(err.children[0].constraints)[0]
                    : null

            if (!message) return

            switch (err.property) {
                case 'account':
                    field_errors.account = message
                    break
                case 'to_account':
                    field_errors.to_account = message
                    break
                case 'description':
                    field_errors.description = message
                    break
                case 'category':
                    field_errors.category = message
                    break
                default:
                    field_errors.general = message
            }
        })
    }

    // Validación: la fecha debe ser del mes en curso o posterior
    if (transaction.date) {
        const now = new Date()
        const start_of_current_month = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
        if (transaction.date < start_of_current_month) {
            field_errors.date = 'La fecha debe ser del mes en curso o posterior'
        }
    }

    // Validación: el monto debe ser mayor a cero
    if (transaction.amount === undefined || transaction.amount === null || Number(transaction.amount) <= 0) {
        field_errors.amount = 'El monto debe ser mayor a cero'
    }

    if (transaction.type === 'income' || transaction.type === 'expense') {
        if (!transaction.account) field_errors.account = 'Debe seleccionar una cuenta'
        if (!transaction.category) field_errors.category = 'Debe seleccionar una categoría'
        if (transaction.to_account) field_errors.to_account = 'Una transferencia no es válida para este tipo'
    }

    if (transaction.type === 'transfer') {
        if (!transaction.account) field_errors.account = 'Debe seleccionar una cuenta origen'
        if (!transaction.to_account) field_errors.to_account = 'Debe seleccionar una cuenta destino'
        if (transaction.category) field_errors.category = 'Una transferencia no lleva categoría'
    }

    // Validación: para egresos, la cuenta debe tener saldo disponible
    if (transaction.type === 'expense') {
        if (!transaction.account || !transaction.account.id) {
            field_errors.account = 'Cuenta requerida para egreso'
        } else {
            const accRepo = AppDataSource.getRepository(Account)
            const acc = await accRepo.findOne({ where: { id: transaction.account.id, user: { id: auth_req.user.id } } })
            const acc_balance = acc ? Number(acc.balance) : 0

            if (acc_balance <= 0) {
                field_errors.amount = 'No hay saldo disponible en la cuenta para realizar el egreso'
            } else if (Number(transaction.amount) > acc_balance) {
                field_errors.amount = 'Saldo insuficiente en la cuenta para este egreso'
            }
        }
    }

    // Validación: para transferencias, la cuenta origen debe tener saldo suficiente
    if (transaction.type === 'transfer') {
        if (!transaction.account || !transaction.account.id) {
            field_errors.account = 'Cuenta origen requerida para transferencia'
        }
        if (!transaction.to_account || !transaction.to_account.id) {
            field_errors.to_account = 'Cuenta destino requerida para transferencia'
        }
        if (transaction.account && transaction.to_account && transaction.account.id === transaction.to_account.id) {
            field_errors.to_account = 'La cuenta destino debe ser distinta a la cuenta origen'
        }

        if (transaction.account && transaction.account.id) {
            const accRepo = AppDataSource.getRepository(Account)
            const acc = await accRepo.findOne({ where: { id: transaction.account.id, user: { id: auth_req.user.id } } })
            const acc_balance = acc ? Number(acc.balance) : 0

            if (acc_balance <= 0) {
                field_errors.amount = 'No hay saldo disponible en la cuenta origen para realizar la transferencia'
            } else if (Number(transaction.amount) > acc_balance) {
                field_errors.amount = 'Saldo insuficiente en la cuenta origen para esta transferencia'
            }
        }
    }
    logger.debug(`${validateSaveTransaction.name}-Errors: ${JSON.stringify(field_errors)}`)
    return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeleteTransaction = async (transaction: Transaction, auth_req: AuthRequest): Promise<Record<string, string> | null> => {
    const field_errors: Record<string, string> = {}

    if (!transaction.date) {
        field_errors.general = 'La transacción no tiene fecha registrada'
    } else {
        const transaction_date = new Date(transaction.date)
        const now = new Date()

        if (transaction_date.getFullYear() < now.getFullYear() ||
            (transaction_date.getFullYear() === now.getFullYear() && transaction_date.getMonth() < now.getMonth())) {
            field_errors.general = 'No se puede eliminar transacciones de meses anteriores'
        }
    }

    logger.debug(`${validateDeleteTransaction.name}-Errors: ${JSON.stringify(field_errors)}`)
    return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateActiveCategoryTransaction = async (transaction: Transaction, auth_req: AuthRequest): Promise<Record<string, string> | null> => {
    const field_errors: Record<string, string> = {}

    if (!transaction.category || !transaction.category.id) {
        return null
    }

    const categoryRepo = AppDataSource.getRepository(Category)
    const category = await categoryRepo.findOne({
        where: {
            id: transaction.category.id,
            user: { id: auth_req.user.id },
            is_active: true
        }
    })

    if (!category) {
        const category_name = transaction.category?.name || ''
        field_errors.category = `La categoría "${category_name}" de esta transacción ya no está activa o no existe`
    }

    logger.debug(`${validateActiveCategoryTransaction.name}-Errors: ${JSON.stringify(field_errors)}`)
    return Object.keys(field_errors).length > 0 ? field_errors : null
}