import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { getLoanGroupByName } from '../../cache/cache-loan-group.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Loan } from '../../entities/Loan.entity'
import { LoanGroup } from '../../entities/LoanGroup.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validateLoanGroup = async (auth_req: AuthRequest, loan_group: LoanGroup): Promise<Record<string, string> | null> => {
  const loan_group_instance = plainToInstance(LoanGroup, loan_group)
  const errors = await validate(loan_group_instance)
  const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}
  // Nombre único por usuario
  if (loan_group.name) {
    const existing = await getLoanGroupByName(auth_req, loan_group.name)
    if (existing && existing.id !== loan_group.id) {
      field_errors.name = 'Ya existe un grupo de préstamos con este nombre'
    }
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeleteLoanGroup = async (auth_req: AuthRequest, loan_group: LoanGroup): Promise<Record<string, string> | null> => {
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
  return Object.keys(field_errors).length > 0 ? field_errors : null
}
