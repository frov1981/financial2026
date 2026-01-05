import { validate } from 'class-validator'
import { AppDataSource } from '../../config/datasource'
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

  // Validación: nombre único por usuario
  if (loan.name && userId) {
    const existingByName = await loanRepo.findOne({
      where: {
        name: loan.name,
        user: { id: userId }
      }
    })

    if (existingByName && existingByName.id !== loan.id) {
      fieldErrors.name = 'Ya existe un préstamo con este nombre'
    }
  }

  // Validaciones solo aplican en edición
  if (loan.id) {
    const existingLoan = await loanRepo.findOne({
      where: {
        id: loan.id,
        user: { id: userId }
      }
    })

    if (!existingLoan) {
      fieldErrors.general = 'Préstamo no encontrado o no pertenece al usuario'
    } else {

      const payments = await paymentRepo.find({
        where: {
          loan: { id: loan.id }
        }
      })

      const totalPrincipalPaid = payments.reduce(
        (sum, p) => sum + Number(p.principal_amount),
        0
      )

      // No permitir modificar total_amount si hay pagos
      if (
        payments.length > 0 &&
        loan.total_amount !== undefined &&
        Number(existingLoan.total_amount) !== Number(loan.total_amount)
      ) {
        fieldErrors.total_amount =
          'No se puede modificar el monto total de un préstamo con pagos registrados'
      }

      // No permitir modificar start_date si hay pagos
      if (
        payments.length > 0 &&
        loan.start_date &&
        new Date(existingLoan.start_date).getTime() !== new Date(loan.start_date).getTime()
      ) {
        fieldErrors.start_date =
          'No se puede modificar la fecha de inicio de un préstamo con pagos registrados'
      }

      // No permitir total_amount menor al capital ya pagado
      if (
        loan.total_amount !== undefined &&
        Number(loan.total_amount) < totalPrincipalPaid
      ) {
        fieldErrors.total_amount =
          'El monto total no puede ser menor al capital ya pagado'
      }

      // Protección: no permitir cambio de usuario
      if (loan.user && loan.user.id !== existingLoan.user.id) {
        fieldErrors.user = 'No se puede cambiar el usuario del préstamo'
      }
    }
  }

  logger.warn('Loan validation', { userId, fieldErrors })

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null
}
