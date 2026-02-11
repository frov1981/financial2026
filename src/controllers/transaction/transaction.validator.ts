import { validate } from 'class-validator'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Account } from '../../entities/Account.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/auth-request'

export const validateSaveTransaction = async (tx: Transaction, authReq: AuthRequest): Promise<Record<string, string> | null> => {
    const errors = await validate(tx)
    const fieldErrors: Record<string, string> = {}

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
                    fieldErrors.account = message
                    break
                case 'to_account':
                    fieldErrors.to_account = message
                    break
                case 'description':
                    fieldErrors.description = message
                    break
                case 'category':
                    fieldErrors.category = message
                    break
                default:
                    fieldErrors.general = message
            }
        })
    }

    // Validación: la fecha debe ser del mes en curso o posterior
    if (tx.date) {
        const now = new Date()
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
        if (tx.date < startOfCurrentMonth) {
            fieldErrors.date = 'La fecha debe ser del mes en curso o posterior'
        }
    }

    // Validación: el monto debe ser mayor a cero
    if (tx.amount === undefined || tx.amount === null || Number(tx.amount) <= 0) {
        fieldErrors.amount = 'El monto debe ser mayor a cero'
    }

    if (tx.type === 'income' || tx.type === 'expense') {
        if (!tx.account) fieldErrors.account = 'Debe seleccionar una cuenta'
        if (!tx.category) fieldErrors.category = 'Debe seleccionar una categoría'
        if (tx.to_account) fieldErrors.to_account = 'Una transferencia no es válida para este tipo'
    }

    if (tx.type === 'transfer') {
        if (!tx.account) fieldErrors.account = 'Debe seleccionar una cuenta origen'
        if (!tx.to_account) fieldErrors.to_account = 'Debe seleccionar una cuenta destino'
        if (tx.category) fieldErrors.category = 'Una transferencia no lleva categoría'
    }

    // Validación: para egresos, la cuenta debe tener saldo disponible
    if (tx.type === 'expense') {
        if (!tx.account || !tx.account.id) {
            fieldErrors.account = 'Cuenta requerida para egreso'
        } else {
            const accRepo = AppDataSource.getRepository(Account)
            const acc = await accRepo.findOne({ where: { id: tx.account.id, user: { id: authReq.user.id } } })
            const accBalance = acc ? Number(acc.balance) : 0

            if (accBalance <= 0) {
                fieldErrors.amount = 'No hay saldo disponible en la cuenta para realizar el egreso'
            } else if (Number(tx.amount) > accBalance) {
                fieldErrors.amount = 'Saldo insuficiente en la cuenta para este egreso'
            }
        }
    }

    // Validación: para transferencias, la cuenta origen debe tener saldo suficiente
    if (tx.type === 'transfer') {
        if (!tx.account || !tx.account.id) {
            fieldErrors.account = 'Cuenta origen requerida para transferencia'
        }
        if (!tx.to_account || !tx.to_account.id) {
            fieldErrors.to_account = 'Cuenta destino requerida para transferencia'
        }
        if (tx.account && tx.to_account && tx.account.id === tx.to_account.id) {
            fieldErrors.to_account = 'La cuenta destino debe ser distinta a la cuenta origen'
        }

        if (tx.account && tx.account.id) {
            const accRepo = AppDataSource.getRepository(Account)
            const acc = await accRepo.findOne({ where: { id: tx.account.id, user: { id: authReq.user.id } } })
            const accBalance = acc ? Number(acc.balance) : 0

            if (accBalance <= 0) {
                fieldErrors.amount = 'No hay saldo disponible en la cuenta origen para realizar la transferencia'
            } else if (Number(tx.amount) > accBalance) {
                fieldErrors.amount = 'Saldo insuficiente en la cuenta origen para esta transferencia'
            }
        }
    }

    return Object.keys(fieldErrors).length > 0 ? fieldErrors : null
}

export const validateDeleteTransaction = async (transaction: Transaction, authReq: AuthRequest): Promise<Record<string, string> | null> => {
    const userId = authReq.user.id
    const fieldErrors: Record<string, string> = {}

    if (!transaction.date) {
        fieldErrors.general = 'La transacción no tiene fecha registrada'
    } else {
        const txDate = new Date(transaction.date)
        const now = new Date()

        if (txDate.getFullYear() < now.getFullYear() ||
            (txDate.getFullYear() === now.getFullYear() && txDate.getMonth() < now.getMonth())) {
            fieldErrors.general = 'No se puede eliminar transacciones de meses anteriores'
        }
    }

    return Object.keys(fieldErrors).length > 0 ? fieldErrors : null
}
