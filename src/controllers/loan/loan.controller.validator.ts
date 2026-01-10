import { validate } from 'class-validator'
import { AppDataSource } from '../../config/datasource'
import { Account } from '../../entities/Account.entity'
import { Loan } from '../../entities/Loan.entity'
import { LoanPayment } from '../../entities/LoanPayment.entity'
import { AuthRequest } from '../../types/AuthRequest'
import { logger } from '../../utils/logger.util'
import { mapValidationErrors } from '../../validators/mapValidationErrors.validator'

export const validateLoan = async (
  loan: Loan,
  authReq: AuthRequest
): Promise<Record<string, string> | null> => {

  const userId = authReq.user.id
  const errors = await validate(loan)
  const fieldErrors = errors.length > 0 ? mapValidationErrors(errors) : {}

  const loanRepo = AppDataSource.getRepository(Loan)
  const paymentRepo = AppDataSource.getRepository(LoanPayment)
  const accountRepo = AppDataSource.getRepository(Account)

  // Validación: nombre único por usuario
  if (loan.name && userId) {
    const existingByName = await loanRepo.findOne({
      where: { name: loan.name, user: { id: userId } }
    })
    if (existingByName && existingByName.id !== loan.id) {
      fieldErrors.name = 'Ya existe un préstamo con este nombre'
    }
  }

  if (loan.total_amount !== undefined && Number(loan.total_amount) <= 0) {
    fieldErrors.total_amount = 'El monto total del préstamo no puede ser negativo o cero'
  }

  // Validación: cuenta de desembolso obligatoria
  if (!loan.disbursement_account || !loan.disbursement_account.id) {
    fieldErrors.disbursement_account = 'Debe seleccionar una cuenta de desembolso'
  } else {
    const account = await accountRepo.findOne({
      where: {
        id: loan.disbursement_account.id,
        user: { id: userId },
        is_active: true
      }
    })
    if (!account) {
      fieldErrors.disbursement_account = 'La cuenta de desembolso no es válida o no pertenece al usuario'
    }
  }

  // Validaciones solo aplican en edición
  if (loan.id) {
    const existingLoan = await loanRepo.findOne({
      where: { id: loan.id, user: { id: userId } }
    })

    if (!existingLoan) {
      fieldErrors.general = 'Préstamo no encontrado o no pertenece al usuario'
    } else {
      const payments = await paymentRepo.find({
        where: { loan: { id: loan.id } }
      })
      const totalPrincipalPaid = payments.reduce((sum, p) => sum + Number(p.principal_amount), 0)

      // No permitir modificar total_amount si hay pagos
      if (payments.length > 0 && loan.total_amount !== undefined &&
          Number(existingLoan.total_amount) !== Number(loan.total_amount)) {
        fieldErrors.total_amount = 'No se puede modificar el monto total de un préstamo con pagos registrados'
      }

      // No permitir modificar start_date si hay pagos
      if (payments.length > 0 && loan.start_date &&
          new Date(existingLoan.start_date).getTime() !== new Date(loan.start_date).getTime()) {
        fieldErrors.start_date = 'No se puede modificar la fecha de inicio de un préstamo con pagos registrados'
      }

      // No permitir total_amount menor al capital ya pagado
      if (loan.total_amount !== undefined && Number(loan.total_amount) < totalPrincipalPaid) {
        fieldErrors.total_amount = 'El monto total no puede ser menor al capital ya pagado'
      }

      // No permitir cambiar usuario
      if (loan.user && loan.user.id !== existingLoan.user.id) {
        fieldErrors.user = 'No se puede cambiar el usuario del préstamo'
      }

      // No permitir cambiar la cuenta de desembolso si hay pagos
      if (payments.length > 0 &&
          loan.disbursement_account &&
          loan.disbursement_account.id !== existingLoan.disbursement_account.id) {
        fieldErrors.disbursement_account = 'No se puede cambiar la cuenta de desembolso de un préstamo con pagos registrados'
      }
    }
  }

  logger.warn('Loan validation', { userId, fieldErrors })

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null
}


export const validateDeleteLoan = async (
  loan: Loan,
  authReq: AuthRequest
): Promise<Record<string, string> | null> => {

  const userId = authReq.user.id
  const fieldErrors: Record<string, string> = {}

  const loanPaymentRepo = AppDataSource.getRepository(LoanPayment)

  const paymentsCount = await loanPaymentRepo.count({
    where: { loan: { id: loan.id } }
  })

  if (paymentsCount > 0) {
    fieldErrors.general = 'No se puede eliminar un préstamo con pagos registrados'
  }

  logger.warn('Loan delete validation', { userId, fieldErrors })

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null
}


