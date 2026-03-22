import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { getActiveAccountById } from '../../cache/cache-accounts.service'
import { getActiveCategoryById } from '../../cache/cache-categories.service'
import { getActiveLoanGroupById } from '../../cache/cache-loan-group.service'
import { getLoanById, getLoanByName } from '../../cache/cache-loans.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Loan } from '../../entities/Loan.entity'
import { LoanPayment } from '../../entities/LoanPayment.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validateLoan = async (auth_req: AuthRequest, loan: Loan): Promise<Record<string, string> | null> => {
  const user_id = auth_req.user.id
  const loan_instance = plainToInstance(Loan, loan)
  const errors = await validate(loan_instance)
  const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}
  // Validaciones class-validator
  const payment_repo = AppDataSource.getRepository(LoanPayment)
  // Nombre único por usuario
  if (loan.name && user_id) {
    const existing_by_name = await getLoanByName(auth_req, loan.name)
    if (existing_by_name && existing_by_name.id !== loan.id) field_errors.name = 'Ya existe un préstamo con este nombre'
  }
  // Monto total obligatorio y > 0
  if (loan.total_amount === undefined || loan.total_amount === null || Number(loan.total_amount) <= 0) {
    field_errors.total_amount = 'El monto total del préstamo debe ser mayor a cero'
  }
  // Cuenta de desembolso obligatoria
  if (!loan.disbursement_account || !loan.disbursement_account.id) {
    field_errors.disbursement_account = 'Debe seleccionar una cuenta de desembolso'
  } else {
    const account = await getActiveAccountById(auth_req, loan.disbursement_account.id)
    if (!account) field_errors.disbursement_account = 'La cuenta de desembolso no es válida o no pertenece al usuario'
  }
  // Validación categoría
  if (loan.category && loan.category.id) {
    const category = await getActiveCategoryById(auth_req, loan.category.id)
    if (!category) field_errors.category = 'La categoría no es válida o no pertenece al usuario'
  }
  // Grupo de préstamo obligatorio
  if (!loan.loan_group || !loan.loan_group.id) {
    field_errors.loan_group = 'Debe seleccionar un grupo de préstamo'
  } else {
    const loan_group = await getActiveLoanGroupById(auth_req, loan.loan_group.id)
    if (!loan_group) field_errors.loan_group = 'El grupo de préstamo no es válido o no pertenece al usuario'
  }
  // Validaciones solo en edición
  if (loan.id) {
    const existing_loan = await getLoanById(auth_req, loan.id)
    if (!existing_loan) {
      field_errors.general = 'Préstamo no encontrado o no pertenece al usuario'
    } else {
      const payments = await payment_repo.find({ where: { loan: { id: loan.id } } })
      const totalPrincipalPaidCents = payments.reduce((sum, p) => sum + Math.round(Number(p.principal_paid) * 100), 0)
      const totalAmountCents = loan.total_amount !== undefined ? Math.round(Number(loan.total_amount) * 100) : 0
      // Validación modificación monto
      if (loan.total_amount !== undefined && Number(existing_loan.total_amount) !== Number(loan.total_amount)) {
        if (payments.length > 0) {
          if (!auth_req.role?.can_update_amount_loan) {
            field_errors.total_amount = 'No se puede modificar el monto total de un préstamo con pagos registrados'
          }
        } else {
          const now = new Date()
          const loan_date = new Date(existing_loan.start_date)
          const same_month = loan_date.getFullYear() === now.getFullYear() && loan_date.getMonth() === now.getMonth()
          if (!same_month) {
            if (!auth_req.role?.can_update_amount_loan) {
              field_errors.total_amount = 'No se puede modificar el monto de un préstamo de meses anteriores'
            }
          }
        }
      }
      // Validación cambio start_date
      if (payments.length > 0 && loan.start_date) {
        const normalizeToMinute = (date: Date | string) => {
          const d = new Date(date)
          d.setSeconds(0, 0)
          return d.getTime()
        }
        const existing_time = normalizeToMinute(existing_loan.start_date)
        const new_time = normalizeToMinute(loan.start_date)
        if (existing_time !== new_time) {
          if (!auth_req.role?.can_update_start_date_loan) {
            field_errors.start_date = 'No se puede modificar la fecha de inicio de un préstamo con pagos registrados'
          }
        }
      }
      // Validación capital pagado
      if (loan.total_amount !== undefined && totalAmountCents < totalPrincipalPaidCents) {
        field_errors.total_amount = 'El monto total no puede ser menor al capital ya pagado'
      }
      // No permitir cambiar usuario
      if (loan.user && loan.user.id !== existing_loan.user.id) {
        field_errors.user = 'No se puede cambiar el usuario del préstamo'
      }
      // No permitir cambiar cuenta si hay pagos
      if (payments.length > 0) {
        const newAccId = loan.disbursement_account?.id || null
        const oldAccId = existing_loan.disbursement_account?.id || null
        if (newAccId !== oldAccId) {
          field_errors.disbursement_account = 'No se puede cambiar la cuenta de desembolso de un préstamo con pagos registrados'
        }
      }
    }
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeleteLoan = async (auth_req: AuthRequest, loan: Loan): Promise<Record<string, string> | null> => {
  const field_errors: Record<string, string> = {}
  const loanPaymentRepo = AppDataSource.getRepository(LoanPayment)
  const paymentsCount = await loanPaymentRepo.count({
    where: { loan: { id: loan.id } }
  })
  if (paymentsCount > 0) field_errors.general = 'No se puede eliminar un préstamo con pagos registrados'
  return Object.keys(field_errors).length > 0 ? field_errors : null
}