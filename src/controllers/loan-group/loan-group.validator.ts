import { validate } from 'class-validator'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Loan } from '../../entities/Loan.entity'
import { LoanGroup } from '../../entities/LoanGroup.entity'
import { AuthRequest } from '../../types/auth-request'
import { logger } from '../../utils/logger.util'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validateLoanGroup = async (loan_group: LoanGroup, auth_req: AuthRequest): Promise<Record<string, string> | null> => {

  const user_id = auth_req.user.id
  const field_errors: Record<string, string> = {}

  /* ===============================
     Validaciones class-validator
  =============================== */

  const errors = await validate(loan_group)
  if (errors.length > 0) {
    Object.assign(field_errors, mapValidationErrors(errors))
  }
  const group_repo = AppDataSource.getRepository(LoanGroup)

  /* ===============================
     Nombre único por usuario
  =============================== */

  if (loan_group.name) {
    const existing = await group_repo.findOne({
      where: {
        name: loan_group.name,
        user: { id: user_id }
      }
    })

    if (existing && existing.id !== loan_group.id) {
      field_errors.name = 'Ya existe un grupo de préstamos con este nombre'
    }
  }

  logger.debug(`${validateLoanGroup.name}-Errors: ${JSON.stringify(field_errors)}`)
  return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeleteLoanGroup = async (loan_group: LoanGroup, auth_req: AuthRequest): Promise<Record<string, string> | null> => {

  const user_id = auth_req.user.id
  const field_errors: Record<string, string> = {}

  const loan_repo = AppDataSource.getRepository(Loan)
  const loans_count = await loan_repo.count({
    where: {
      loan_group: { id: loan_group.id },
      user: { id: user_id }
    }
  })

  if (loans_count > 0) {
    field_errors.general = `No se puede eliminar el grupo porque tiene ${loans_count} préstamo(s) asociado(s)`
  }

  logger.debug(`${validateDeleteLoanGroup.name}-Errors: ${JSON.stringify(field_errors)}`)
  return Object.keys(field_errors).length > 0 ? field_errors : null
}
