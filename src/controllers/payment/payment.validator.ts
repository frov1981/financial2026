import { validate } from 'class-validator'
import { AppDataSource } from '../../config/typeorm.datasource'
import { LoanPayment } from '../../entities/LoanPayment.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'
import { logger } from '../../utils/logger.util'

export const validateSavePayment = async (
    authReq: AuthRequest,
    payment: LoanPayment,
    oldPayment: LoanPayment | null
): Promise<Record<string, string> | null> => {
    const userId = authReq.user.id

    const errors = await validate(payment)
    const fieldErrors = errors.length > 0 ? mapValidationErrors(errors) : {}

    const paymentRepo = AppDataSource.getRepository(LoanPayment)

    /* =========================
       Validación monto principal
    ============================ */

    let availableAmount = payment.loan.balance

    if (oldPayment) {
        availableAmount += oldPayment.principal_amount
    }

    if (payment.principal_amount > availableAmount) {
        fieldErrors.principal_amount = 'El monto del capital supera el saldo pendiente del préstamo'
    }

    let totalPayment = payment.principal_amount + payment.interest_amount
    if (totalPayment <= 0) {
        fieldErrors.general = 'El monto total del pago (capital + intereses) debe ser mayor a cero'
    }

    /* =========================
       Validación fecha del pago
    ============================ */

    const lastPayment = await paymentRepo.findOne({
        where: { loan: { id: payment.loan.id } },
        order: { payment_date: 'DESC' }
    })

    if (
        lastPayment &&
        (!oldPayment || lastPayment.id !== oldPayment.id) &&
        payment.payment_date < lastPayment.payment_date
    ) {
        fieldErrors.payment_date = 'La fecha del pago no puede ser anterior al último pago registrado'
    }

    return Object.keys(fieldErrors).length > 0 ? fieldErrors : null
}

export const validateDeletePayment = async (
    authReq: AuthRequest,
    payment: LoanPayment
): Promise<Record<string, string> | null> => {
    const userId = authReq.user.id
    const fieldErrors: Record<string, string> = {}

    const now = new Date()
    const paymentDate = new Date(payment.payment_date)

    /* =========================
       SAME MONTH VALIDATION
    ============================ */

    const sameMonth =
        paymentDate.getFullYear() === now.getFullYear() &&
        paymentDate.getMonth() === now.getMonth()

    if (!sameMonth) {
        fieldErrors.general = 'Solo se pueden eliminar pagos del mes en curso'
    }

    /* =========================
       LAST PAYMENT VALIDATION
    ============================ */

    const paymentRepo = AppDataSource.getRepository(LoanPayment)

    const lastPayment = await paymentRepo.findOne({
        where: { loan: { id: payment.loan.id } },
        order: { payment_date: 'DESC', id: 'DESC' }
    })

    if (!lastPayment || lastPayment.id !== payment.id) {
        fieldErrors.general = 'Solo se puede eliminar el último pago registrado del préstamo'
    }

    return Object.keys(fieldErrors).length > 0 ? fieldErrors : null
}
