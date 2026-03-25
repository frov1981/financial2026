import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { getActiveCategoryById } from '../../cache/cache-categories.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { LoanPayment } from '../../entities/LoanPayment.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validateSavePayment = async (auth_req: AuthRequest, payment: LoanPayment, old_payment: LoanPayment | null): Promise<Record<string, string> | null> => {
    const payment_instance = plainToInstance(LoanPayment, payment)
    const errors = await validate(payment_instance)
    const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}

    const payment_repo = AppDataSource.getRepository(LoanPayment)
    // Validación monto principal
    let available_amount = payment.loan.balance
    if (old_payment) available_amount += old_payment.principal_paid
    if (payment.principal_paid > available_amount) {
        field_errors.principal_paid = 'El monto del capital supera el saldo pendiente del préstamo'
    }
    const total_payment = payment.principal_paid + payment.interest_paid
    if (total_payment <= 0) {
        field_errors.general = 'El monto total del pago (capital + intereses) debe ser mayor a cero'
    }
    // Detectar cambios contables
    let financial_change = false
    if (old_payment) {
        const principal_changed = payment.principal_paid !== old_payment.principal_paid
        const interest_changed = payment.interest_paid !== old_payment.interest_paid
        const new_date = payment.payment_date.getTime()
        const old_date = new Date(old_payment.payment_date).getTime()
        const date_changed = new_date !== old_date
        financial_change = principal_changed || interest_changed || date_changed
    }
    if (old_payment && financial_change) {
        const now = new Date()
        const payment_date = new Date(old_payment.payment_date)
        const same_month = payment_date.getFullYear() === now.getFullYear() && payment_date.getMonth() === now.getMonth()
        if (!same_month) {
            if (!auth_req.role?.can_update_date_payment) {
                field_errors.general = 'No se pueden modificar monto o fecha de pagos de meses anteriores'
            }
        }
    }
    // Validación categoría
    if (payment.category && payment.category.id) {
        const category = await getActiveCategoryById(auth_req, payment.category.id)
        if (!category) {
            field_errors.category = 'La categoría seleccionada no es válida'
        }
    }
    // Validación fecha del pago
    const last_payment = await payment_repo.findOne({ where: { loan: { id: payment.loan.id } }, order: { payment_date: 'DESC', id: 'DESC' } })
    if (last_payment && (!old_payment || last_payment.id !== old_payment.id) && payment.payment_date.getTime() < last_payment.payment_date.getTime()) {
        if (!auth_req.role?.can_update_date_payment) {
            field_errors.payment_date = 'La fecha del pago no puede ser anterior al último pago registrado'
        }
    }
    return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeletePayment = async (auth_req: AuthRequest, payment: LoanPayment): Promise<Record<string, string> | null> => {
    const field_errors: Record<string, string> = {}
    const now = new Date()
    const payment_date = new Date(payment.payment_date)
    // Validación mismo mes
    const same_month = payment_date.getFullYear() === now.getFullYear() && payment_date.getMonth() === now.getMonth()
    if (!same_month) {
        if (!auth_req.role?.can_update_date_payment) {
            field_errors.general = 'Solo se pueden eliminar pagos del mes en curso'
        }
    }
    // Validación último pago
    const payment_repo = AppDataSource.getRepository(LoanPayment)
    const last_payment = await payment_repo.findOne({
        where: { loan: { id: payment.loan.id } },
        order: { payment_date: 'DESC', id: 'DESC' }
    })
    if (!last_payment || last_payment.id !== payment.id) {
        field_errors.general = 'Solo se puede eliminar el último pago registrado del préstamo'
    }
    return Object.keys(field_errors).length > 0 ? field_errors : null
}