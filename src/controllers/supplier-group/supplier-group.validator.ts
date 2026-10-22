import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { getSupplierGroupByName } from '../../cache/cache-suppliers.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Supplier } from '../../entities/Supplier.entity'
import { SupplierGroup } from '../../entities/SupplierGroup.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validateSupplierGroup = async (
  group: SupplierGroup,
  auth_req: AuthRequest
): Promise<Record<string, string> | null> => {
  const errors = await validate(plainToInstance(SupplierGroup, group))
  const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}
  const existing = group.name ? await getSupplierGroupByName(auth_req, group.name) : null
  if (existing && existing.id !== group.id) {
    field_errors.name = 'Ya existe un grupo con este nombre'
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeleteSupplierGroup = async (
  group: SupplierGroup,
  auth_req: AuthRequest
): Promise<Record<string, string> | null> => {
  const supplier_count = await AppDataSource.getRepository(Supplier).count({
    where: { supplier_group: { id: group.id }, user: { id: auth_req.user.id } }
  })
  if (supplier_count > 0) {
    return { general: `No se puede eliminar el grupo porque tiene ${supplier_count} proveedor(es) asociado(s)` }
  }
  return null
}
