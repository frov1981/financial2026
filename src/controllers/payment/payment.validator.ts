import { validate } from 'class-validator'
import { AppDataSource } from '../../config/typeorm.datasource'
import { LoanPayment } from '../../entities/LoanPayment.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'
import { logger } from '../../utils/logger.util'

export const validateSavePayment = async (auth_req: AuthRequest, payment: LoanPayment, old_payment: LoanPayment | null): Promise<Record<string, string> | null> => {
    const user_id = auth_req.user.id

    const errors = await validate(payment)
    const fields_errors = errors.length > 0 ? mapValidationErrors(errors) : {}

    const payment_repo = AppDataSource.getRepository(LoanPayment)

    /* =========================
       Validación monto principal
    ============================ */

    let available_amount = payment.loan.balance

    if (old_payment) {
        available_amount += old_payment.principal_paid
    }

    if (payment.principal_paid > available_amount) {
        fields_errors.principal_paid = 'El monto del capital supera el saldo pendiente del préstamo'
    }

    let total_payment = payment.principal_paid + payment.interest_paid
    if (total_payment <= 0) {
        fields_errors.general = 'El monto total del pago (capital + intereses) debe ser mayor a cero'
    }

    /* =========================
       Validación fecha del pago
    ============================ */

    const last_payment = await payment_repo.findOne({
        where: { loan: { id: payment.loan.id } },
        order: { payment_date: 'DESC' }
    })

    if (
        last_payment &&
        (!old_payment || last_payment.id !== old_payment.id) &&
        payment.payment_date.getTime() < last_payment.payment_date.getTime()
    ) {
        fields_errors.payment_date = 'La fecha del pago no puede ser anterior al último pago registrado'
    }

    return Object.keys(fields_errors).length > 0 ? fields_errors : null
}

export const validateDeletePayment = async (auth_req: AuthRequest, payment: LoanPayment): Promise<Record<string, string> | null> => {
    const user_id = auth_req.user.id
    const fields_errors: Record<string, string> = {}

    const now = new Date()
    const payment_date = new Date(payment.payment_date)

    /* =========================
       SAME MONTH VALIDATION
    ============================ */

    const same_month =
        payment_date.getFullYear() === now.getFullYear() &&
        payment_date.getMonth() === now.getMonth()

    if (!same_month) {
        fields_errors.general = 'Solo se pueden eliminar pagos del mes en curso'
    }

    /* =========================
       LAST PAYMENT VALIDATION
    ============================ */

    const payment_repo = AppDataSource.getRepository(LoanPayment)

    const last_payment = await payment_repo.findOne({
        where: { loan: { id: payment.loan.id } },
        order: { payment_date: 'DESC', id: 'DESC' }
    })

    if (!last_payment || last_payment.id !== payment.id) {
        fields_errors.general = 'Solo se puede eliminar el último pago registrado del préstamo'
    }

    return Object.keys(fields_errors).length > 0 ? fields_errors : null
}
