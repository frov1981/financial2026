import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { getActiveAccountById } from '../../cache/cache-accounts.service'
import { getActiveCategoryById } from '../../cache/cache-categories.service'
import { getActiveReceivableGroupById } from '../../cache/cache-receivable-groups.service'
import { getReceivableById, getReceivableByName } from '../../cache/cache-receivables.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Receivable } from '../../entities/Receivable.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'
import { ReceivableCollection } from '../../entities/ReceivableCollection.entity'

export const validateReceivable = async (auth_req: AuthRequest, receivable: Receivable): Promise<Record<string, string> | null> => {
  const user_id = auth_req.user.id
  const receivable_instance = plainToInstance(Receivable, receivable)
  const errors = await validate(receivable_instance)
  const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}
  // Validaciones class-validator
  const payment_repo = AppDataSource.getRepository(ReceivableCollection)
  // Nombre único por usuario
  if (receivable.name && user_id) {
    const existing_by_name = await getReceivableByName(auth_req, receivable.name)
    if (existing_by_name && existing_by_name.id !== receivable.id) field_errors.name = 'Ya existe un compromiso con este nombre'
  }
  // Monto total obligatorio y > 0
  if (receivable.total_amount === undefined || receivable.total_amount === null || Number(receivable.total_amount) <= 0) {
    field_errors.total_amount = 'El monto total del compromiso debe ser mayor a cero'
  }
  // Cuenta de desembolso obligatoria
  if (!receivable.disbursement_account || !receivable.disbursement_account.id) {
    field_errors.disbursement_account = 'Debe seleccionar una cuenta de desembolso'
  } else {
    const account = await getActiveAccountById(auth_req, receivable.disbursement_account.id)
    if (!account) field_errors.disbursement_account = 'La cuenta de desembolso no es válida o no pertenece al usuario'
  }
  // Validación categoría
  if (receivable.category && receivable.category.id) {
    const category = await getActiveCategoryById(auth_req, receivable.category.id)
    if (!category) field_errors.category = 'La categoría no es válida o no pertenece al usuario'
  }
  // Grupo de compromiso obligatorio
  if (!receivable.receivable_group || !receivable.receivable_group.id) {
    field_errors.receivable_group = 'Debe seleccionar un grupo de compromiso'
  } else {
    const receivable_group = await getActiveReceivableGroupById(auth_req, receivable.receivable_group.id)
    if (!receivable_group) field_errors.receivable_group = 'El grupo de compromiso no es válido o no pertenece al usuario'
  }
  // Validaciones solo en edición
  if (receivable.id) {
    const existing_receivable = await getReceivableById(auth_req, receivable.id)
    if (!existing_receivable) {
      field_errors.general = 'Compromiso no encontrado o no pertenece al usuario'
    } else {
      const payments = await payment_repo.find({ where: { receivable: { id: receivable.id } } })
      //const totalPrincipalPaidCents = payments.reduce((sum, p) => sum + Math.round(Number(p.principal_paid) * 100), 0)
      const totalAmountCents = receivable.total_amount !== undefined ? Math.round(Number(receivable.total_amount) * 100) : 0
      // Validación modificación monto
      /*if (receivable.total_amount !== undefined && Number(existing_receivable.total_amount) !== Number(receivable.total_amount)) {
        if (payments.length > 0) {
          if (!auth_req.role?.can_update_amount_receivable) {
            field_errors.total_amount = 'No se puede modificar el monto total de una cuenta con pagar con pagos registrados'
          }
        } else {
          const now = new Date()
          const receivable_date = new Date(existing_receivable.start_date)
          const same_month = receivable_date.getFullYear() === now.getFullYear() && receivable_date.getMonth() === now.getMonth()
          if (!same_month) {
            if (!auth_req.role?.can_update_amount_receivable) {
              field_errors.total_amount = 'No se puede modificar el monto de una cuenta con pagar de meses anteriores'
            }
          }
        }
      }*/
      // Validación cambio start_date
      if (payments.length > 0 && receivable.start_date) {
        const normalizeToMinute = (date: Date | string) => {
          const d = new Date(date)
          d.setSeconds(0, 0)
          return d.getTime()
        }
        const existing_time = normalizeToMinute(existing_receivable.start_date)
        const new_time = normalizeToMinute(receivable.start_date)
        /*if (existing_time !== new_time) {
          if (!auth_req.role?.can_update_start_date_receivable) {
            field_errors.start_date = 'No se puede modificar la fecha de inicio de una cuenta con pagar con pagos registrados'
          }
        }*/
      }
      // Validación capital pagado
      /*if (receivable.total_amount !== undefined && totalAmountCents < totalPrincipalPaidCents) {
        field_errors.total_amount = 'El monto total no puede ser menor al capital ya pagado'
      }*/
      // No permitir cambiar usuario
      if (receivable.user && receivable.user.id !== existing_receivable.user.id) {
        field_errors.user = 'No se puede cambiar el usuario de la cuenta'
      }
      // No permitir cambiar cuenta si hay pagos
      if (payments.length > 0) {
        const newAccId = receivable.disbursement_account?.id || null
        const oldAccId = existing_receivable.disbursement_account?.id || null
        if (newAccId !== oldAccId) {
          field_errors.disbursement_account = 'No se puede cambiar la cuenta de desembolso de una cuenta con pagar con pagos registrados'
        }
      }
    }
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeleteReceivable = async (auth_req: AuthRequest, receivable: Receivable): Promise<Record<string, string> | null> => {
  const field_errors: Record<string, string> = {}
  const receivablePaymentRepo = AppDataSource.getRepository(ReceivableCollection)
  const paymentsCount = await receivablePaymentRepo.count({
    where: { receivable: { id: receivable.id } }
  })
  if (paymentsCount > 0) field_errors.general = 'No se puede eliminar una cuenta con pagar con pagos registrados'
  return Object.keys(field_errors).length > 0 ? field_errors : null
}