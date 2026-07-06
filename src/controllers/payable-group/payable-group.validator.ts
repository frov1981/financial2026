import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { getPayableGroupByName } from '../../cache/cache-payable-groups.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Payable } from '../../entities/Payable.entity'
import { PayableGroup } from '../../entities/PayableGroup.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validatePayableGroup = async (auth_req: AuthRequest, payable_group: PayableGroup): Promise<Record<string, string> | null> => {
  const payable_group_instance = plainToInstance(PayableGroup, payable_group)
  const errors = await validate(payable_group_instance)
  const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}
  // Nombre único por usuario
  if (payable_group.name) {
    const existing = await getPayableGroupByName(auth_req, payable_group.name)
    if (existing && existing.id !== payable_group.id) {
      field_errors.name = 'Ya existe un grupo de Cuentas por Pagar con este nombre'
    }
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeletePayableGroup = async (auth_req: AuthRequest, payable_group: PayableGroup): Promise<Record<string, string> | null> => {
  const user_id = auth_req.user.id
  const field_errors: Record<string, string> = {}
  const payable_repo = AppDataSource.getRepository(Payable)
  const payables_count = await payable_repo.count({
    where: {
      payable_group: { id: payable_group.id },
      user: { id: user_id }
    }
  })
  if (payables_count > 0) {
    field_errors.general = `No se puede eliminar el grupo porque tiene ${payables_count} cuenta(s) por pagar asociada(s)`
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}
