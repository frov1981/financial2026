import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { getActiveAccountById } from '../../cache/cache-accounts.service'
import { getActiveCategoryById } from '../../cache/cache-categories.service'
import { getActivePayableGroupById } from '../../cache/cache-payable-groups.service'
import { getPayableById, getPayableByName } from '../../cache/cache-payables.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Payable } from '../../entities/Payable.entity'
import { PayablePayment } from '../../entities/PayablePayment.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validatePayable = async (auth_req: AuthRequest, payable: Payable): Promise<Record<string, string> | null> => {
  const user_id = auth_req.user.id
  const payable_instance = plainToInstance(Payable, payable)
  const errors = await validate(payable_instance)
  const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}
  // Validaciones class-validator
  const payment_repo = AppDataSource.getRepository(PayablePayment)
  // Nombre único por usuario
  if (payable.name && user_id) {
    const existing_by_name = await getPayableByName(auth_req, payable.name)
    if (existing_by_name && existing_by_name.id !== payable.id) field_errors.name = 'Ya existe un compromiso con este nombre'
  }
  // Monto total obligatorio y > 0
  if (payable.total_amount === undefined || payable.total_amount === null || Number(payable.total_amount) <= 0) {
    field_errors.total_amount = 'El monto total del compromiso debe ser mayor a cero'
  }
  // Cuenta de desembolso obligatoria
  if (!payable.disbursement_account || !payable.disbursement_account.id) {
    field_errors.disbursement_account = 'Debe seleccionar una cuenta de desembolso'
  } else {
    const account = await getActiveAccountById(auth_req, payable.disbursement_account.id)
    if (!account) field_errors.disbursement_account = 'La cuenta de desembolso no es válida o no pertenece al usuario'
  }
  // Validación categoría
  if (payable.category && payable.category.id) {
    const category = await getActiveCategoryById(auth_req, payable.category.id)
    if (!category) field_errors.category = 'La categoría no es válida o no pertenece al usuario'
  }
  // Grupo de compromiso obligatorio
  if (!payable.payable_group || !payable.payable_group.id) {
    field_errors.payable_group = 'Debe seleccionar un grupo de compromiso'
  } else {
    const payable_group = await getActivePayableGroupById(auth_req, payable.payable_group.id)
    if (!payable_group) field_errors.payable_group = 'El grupo de compromiso no es válido o no pertenece al usuario'
  }
  // Validaciones solo en edición
  if (payable.id) {
    const existing_payable = await getPayableById(auth_req, payable.id)
    if (!existing_payable) {
      field_errors.general = 'Compromiso no encontrado o no pertenece al usuario'
    } else {
      const payments = await payment_repo.find({ where: { payable: { id: payable.id } } })
      const totalPrincipalPaidCents = payments.reduce((sum, p) => sum + Math.round(Number(p.principal_paid) * 100), 0)
      const totalAmountCents = payable.total_amount !== undefined ? Math.round(Number(payable.total_amount) * 100) : 0
      // Validación modificación monto
      if (payable.total_amount !== undefined && Number(existing_payable.total_amount) !== Number(payable.total_amount)) {
        if (payments.length > 0) {
          if (!auth_req.role?.can_update_amount_payable) {
            field_errors.total_amount = 'No se puede modificar el monto total de una cuenta con pagar con pagos registrados'
          }
        } else {
          const now = new Date()
          const payable_date = new Date(existing_payable.start_date)
          const same_month = payable_date.getFullYear() === now.getFullYear() && payable_date.getMonth() === now.getMonth()
          if (!same_month) {
            if (!auth_req.role?.can_update_amount_payable) {
              field_errors.total_amount = 'No se puede modificar el monto de una cuenta con pagar de meses anteriores'
            }
          }
        }
      }
      // Validación cambio start_date
      if (payments.length > 0 && payable.start_date) {
        const normalizeToMinute = (date: Date | string) => {
          const d = new Date(date)
          d.setSeconds(0, 0)
          return d.getTime()
        }
        const existing_time = normalizeToMinute(existing_payable.start_date)
        const new_time = normalizeToMinute(payable.start_date)
        if (existing_time !== new_time) {
          if (!auth_req.role?.can_update_start_date_payable) {
            field_errors.start_date = 'No se puede modificar la fecha de inicio de una cuenta con pagar con pagos registrados'
          }
        }
      }
      // Validación capital pagado
      if (payable.total_amount !== undefined && totalAmountCents < totalPrincipalPaidCents) {
        field_errors.total_amount = 'El monto total no puede ser menor al capital ya pagado'
      }
      // No permitir cambiar usuario
      if (payable.user && payable.user.id !== existing_payable.user.id) {
        field_errors.user = 'No se puede cambiar el usuario de la cuenta'
      }
      // No permitir cambiar cuenta si hay pagos
      if (payments.length > 0) {
        const newAccId = payable.disbursement_account?.id || null
        const oldAccId = existing_payable.disbursement_account?.id || null
        if (newAccId !== oldAccId) {
          field_errors.disbursement_account = 'No se puede cambiar la cuenta de desembolso de una cuenta con pagar con pagos registrados'
        }
      }
    }
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeletePayable = async (auth_req: AuthRequest, payable: Payable): Promise<Record<string, string> | null> => {
  const field_errors: Record<string, string> = {}
  const payablePaymentRepo = AppDataSource.getRepository(PayablePayment)
  const paymentsCount = await payablePaymentRepo.count({
    where: { payable: { id: payable.id } }
  })
  if (paymentsCount > 0) field_errors.general = 'No se puede eliminar una cuenta con pagar con pagos registrados'
  return Object.keys(field_errors).length > 0 ? field_errors : null
}