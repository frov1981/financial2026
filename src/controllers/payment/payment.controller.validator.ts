import { validate } from 'class-validator'
import { AppDataSource } from '../../config/datasource'
import { LoanPayment } from '../../entities/LoanPayment.entity'
import { AuthRequest } from '../../types/AuthRequest'
import { mapValidationErrors } from '../../validators/mapValidationErrors.validator'
import { logger } from '../../utils/logger.util'

export const validateSavePayment = async (
    payment: LoanPayment,
    authReq: AuthRequest,
    oldPayment: LoanPayment | null
): Promise<Record<string, string> | null> => {

    const userId = authReq.user.id
    const errors = await validate(payment)
    const fieldErrors = errors.length > 0 ? mapValidationErrors(errors) : {}

    const paymentRepo = AppDataSource.getRepository(LoanPayment)

    // =========================
    // Validación monto principal
    // =========================

    let availableAmount = payment.loan.balance

    // UPDATE → artificio delta
    if (oldPayment) {
        availableAmount += oldPayment.principal_amount
    }

    if (payment.principal_amount > availableAmount) {
        fieldErrors.principal_amount = 'El monto del capital supera el saldo pendiente del préstamo'
    }

    // =========================
    // Validación fecha del pago
    // =========================

    const lastPayment = await paymentRepo.findOne({
        where: {
            loan: { id: payment.loan.id }
        },
        order: { payment_date: 'DESC' }
    })

    if (
        lastPayment &&
        (!oldPayment || lastPayment.id !== oldPayment.id) &&
        payment.payment_date < lastPayment.payment_date
    ) {
        fieldErrors.payment_date = 'La fecha del pago no puede ser anterior al último pago registrado'
    }

    logger.warn('Payment save validation', { userId, fieldErrors })

    return Object.keys(fieldErrors).length > 0 ? fieldErrors : null
}

export const validateDeletePayment = async (
    payment: LoanPayment,
    authReq: AuthRequest
): Promise<Record<string, string> | null> => {

    const userId = authReq.user.id
    const fieldErrors: Record<string, string> = {}

    const now = new Date()
    const paymentDate = new Date(payment.payment_date)

    const sameMonth =
        paymentDate.getFullYear() === now.getFullYear() &&
        paymentDate.getMonth() === now.getMonth()

    if (!sameMonth) {
        fieldErrors.general = 'Solo se pueden eliminar pagos del mes en curso'
    }

    logger.warn('Payment delete validation', { userId, fieldErrors })

    return Object.keys(fieldErrors).length > 0 ? fieldErrors : null
}
