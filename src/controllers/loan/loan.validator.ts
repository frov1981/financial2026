import { validate } from 'class-validator'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Account } from '../../entities/Account.entity'
import { Loan } from '../../entities/Loan.entity'
import { LoanGroup } from '../../entities/LoanGroup.entity'
import { LoanPayment } from '../../entities/LoanPayment.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validateLoan = async (loan: Loan, auth_req: AuthRequest): Promise<Record<string, string> | null> => {

  const user_id = auth_req.user.id
  const field_errors: Record<string, string> = {}

  // ===============================
  // Validaciones class-validator
  // ===============================
  const errors = await validate(loan)
  if (errors.length > 0) {
    Object.assign(field_errors, mapValidationErrors(errors))
  }

  const loan_repo = AppDataSource.getRepository(Loan)
  const payment_repo = AppDataSource.getRepository(LoanPayment)
  const account_repo = AppDataSource.getRepository(Account)
  const loan_group_repo = AppDataSource.getRepository(LoanGroup)


  // ===============================
  // Nombre único por usuario
  // ===============================
  if (loan.name && user_id) {
    const existing_by_name = await loan_repo.findOne({
      where: { name: loan.name, user: { id: user_id } }
    })
    if (existing_by_name && existing_by_name.id !== loan.id) {
      field_errors.name = 'Ya existe un préstamo con este nombre'
    }
  }

  // ===============================
  // Monto total obligatorio y > 0
  // ===============================
  if (loan.total_amount === undefined || loan.total_amount === null || Number(loan.total_amount) <= 0) {
    field_errors.total_amount = 'El monto total del préstamo debe ser mayor a cero'
  }

  // ===============================
  // Cuenta de desembolso obligatoria
  // ===============================
  if (!loan.disbursement_account || !loan.disbursement_account.id) {
    field_errors.disbursement_account = 'Debe seleccionar una cuenta de desembolso'
  } else {
    const account = await account_repo.findOne({
      where: {
        id: loan.disbursement_account.id,
        user: { id: user_id },
        is_active: true
      }
    })
    if (!account) {
      field_errors.disbursement_account = 'La cuenta de desembolso no es válida o no pertenece al usuario'
    }
  }

  // ===============================
  // Grupo de préstamo obligatorio
  // ===============================
  if (!loan.loan_group || !loan.loan_group.id) {
    field_errors.loan_group = 'Debe seleccionar un grupo de préstamo'
  } else {
    const loan_group = await loan_group_repo.findOne({
      where: {
        id: loan.loan_group.id,
        user: { id: user_id },
        is_active: true
      }
    })
    if (!loan_group) {
      field_errors.loan_group = 'El grupo de préstamo no es válido o no pertenece al usuario'
    }
  }

  // ===============================
  // Validaciones solo en edición
  // ===============================
  if (loan.id) {
    const existing_loan = await loan_repo.findOne({
      where: { id: loan.id, user: { id: user_id } },
      relations: { disbursement_account: true }
    })

    if (!existing_loan) {
      field_errors.general = 'Préstamo no encontrado o no pertenece al usuario'
    } else {
      const payments = await payment_repo.find({
        where: { loan: { id: loan.id } }
      })

      const totalPrincipalPaid = payments.reduce(
        (sum, p) => sum + Number(p.principal_amount),
        0
      )

      // No permitir modificar total_amount si hay pagos
      if (
        payments.length > 0 &&
        loan.total_amount !== undefined &&
        Number(existing_loan.total_amount) !== Number(loan.total_amount)
      ) {
        field_errors.total_amount = 'No se puede modificar el monto total de un préstamo con pagos registrados'
      }

      // No permitir modificar start_date si hay pagos
      if (
        payments.length > 0 &&
        loan.start_date &&
        new Date(existing_loan.start_date).getTime() !== new Date(loan.start_date).getTime()
      ) {
        field_errors.start_date = 'No se puede modificar la fecha de inicio de un préstamo con pagos registrados'
      }

      // No permitir total_amount menor al capital ya pagado
      if (
        loan.total_amount !== undefined &&
        Number(loan.total_amount) < totalPrincipalPaid
      ) {
        field_errors.total_amount = 'El monto total no puede ser menor al capital ya pagado'
      }

      // No permitir cambiar usuario
      if (loan.user && loan.user.id !== existing_loan.user.id) {
        field_errors.user = 'No se puede cambiar el usuario del préstamo'
      }

      // No permitir cambiar la cuenta de desembolso si hay pagos
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

export const validateDeleteLoan = async (loan: Loan, auth_req: AuthRequest): Promise<Record<string, string> | null> => {

  const user_id = auth_req.user.id
  const field_errors: Record<string, string> = {}

  const loanPaymentRepo = AppDataSource.getRepository(LoanPayment)

  // ===============================
  // Validación: pagos asociados
  // ===============================
  const paymentsCount = await loanPaymentRepo.count({
    where: { loan: { id: loan.id } }
  })

  if (paymentsCount > 0) {
    field_errors.general = 'No se puede eliminar un préstamo con pagos registrados'
  }

  return Object.keys(field_errors).length > 0 ? field_errors : null
}
