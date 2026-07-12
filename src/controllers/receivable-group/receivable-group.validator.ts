import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { AppDataSource } from '../../config/typeorm.datasource'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'
import { ReceivableGroup } from '../../entities/ReceivableGroup.entity'
import { getReceivableGroupByName } from '../../cache/cache-receivable-groups.service'
import { Receivable } from '../../entities/Receivable.entity'

export const validateReceivableGroup = async (auth_req: AuthRequest, receivable_group: ReceivableGroup): Promise<Record<string, string> | null> => {
  const receivable_group_instance = plainToInstance(ReceivableGroup, receivable_group)
  const errors = await validate(receivable_group_instance)
  const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}
  // Nombre único por usuario
  if (receivable_group.name) {
    const existing = await getReceivableGroupByName(auth_req, receivable_group.name)
    if (existing && existing.id !== receivable_group.id) {
      field_errors.name = 'Ya existe un grupo de Cuentas por Cobrar con este nombre'
    }
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeleteReceivableGroup = async (auth_req: AuthRequest, receivable_group: ReceivableGroup): Promise<Record<string, string> | null> => {
  const user_id = auth_req.user.id
  const field_errors: Record<string, string> = {}
  const receivable_repo = AppDataSource.getRepository(Receivable)
  const receivables_count = await receivable_repo.count({
    where: {
      receivable_group: { id: receivable_group.id },
      user: { id: user_id }
    }
  })
  if (receivables_count > 0) {
    field_errors.general = `No se puede eliminar el grupo porque tiene ${receivables_count} cuenta(s) por cobrar asociada(s)`
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}
