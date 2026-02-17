import { validate } from 'class-validator'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Category } from '../../entities/Category.entity'
import { CategoryGroup } from '../../entities/CategoryGroups.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/auth-request'
import { logger } from '../../utils/logger.util'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validateCategory = async (category: Category, auth_req: AuthRequest): Promise<Record<string, string> | null> => {

  const user_id = auth_req.user.id
  const field_errors: Record<string, string> = {}

  /* ===============================
     Validaciones class-validator
  =============================== */

  const errors = await validate(category)
  if (errors.length > 0) {
    Object.assign(field_errors, mapValidationErrors(errors))
  }

  const repo = AppDataSource.getRepository(Category)
  const group_repo = AppDataSource.getRepository(CategoryGroup)

  /* ===============================
     Nombre único por usuario
  =============================== */

  if (category.name) {
    const existing = await repo.findOne({
      where: {
        name: category.name,
        user: { id: user_id }
      }
    })

    if (existing && existing.id !== category.id) {
      field_errors.name = 'Ya existe una categoría con este nombre'
    }
  }

  /* ===============================
     Validación de tipo (SIEMPRE)
  =============================== */

  if (!category.type) {
    field_errors.type = 'El tipo es obligatorio'
  }

  /* ===============================
     Validación de grupo (OBLIGATORIO)
  =============================== */

  if (!category.category_group || !category.category_group.id) {
    field_errors.category_group = 'El grupo de categoría es obligatorio'
  } else {
    const category_group = await group_repo.findOne({
      where: {
        id: category.category_group.id,
        user: { id: user_id }
      }
    })

    if (!category_group) {
      field_errors.category_group = 'El grupo de categoría seleccionado no es válido'
    }
  }

  logger.debug(`${validateCategory.name}-Errors: ${JSON.stringify(field_errors)}`)
  return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeleteCategory = async (category: Category, auth_req: AuthRequest): Promise<Record<string, string> | null> => {

  const user_id = auth_req.user.id
  const field_errors: Record<string, string> = {}

  const tx_repo = AppDataSource.getRepository(Transaction)
  const category_repo = AppDataSource.getRepository(Category)

  /* ===============================
     Validación: transacciones asociadas
  =============================== */

  const tx_count = await tx_repo.count({
    where: {
      category: { id: category.id },
      user: { id: user_id }
    }
  })

  if (tx_count > 0) {
    field_errors.general = `No se puede eliminar la categoría porque tiene ${tx_count} transacción(es) asociada(s)`
  }

  /* ===============================
     Validación: categorías hijas (estructura)
     Esto es SOLO para integridad de datos, no negocio
  =============================== */

  const children_count = await category_repo.count({
    where: {
      parent: { id: category.id },
      user: { id: user_id }
    }
  })

  if (children_count > 0) {
    field_errors.general = `No se puede eliminar la categoría porque tiene ${children_count} subcategoría(s) asociada(s)`
  }

  logger.debug(`${validateDeleteCategory.name}-Errors: ${JSON.stringify(field_errors)}`)
  return Object.keys(field_errors).length > 0 ? field_errors : null
}
