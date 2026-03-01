import { validate } from 'class-validator'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Category } from '../../entities/Category.entity'
import { CategoryGroup } from '../../entities/CategoryGroups.entity'
import { AuthRequest } from '../../types/auth-request'
import { logger } from '../../utils/logger.util'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validateCategoryGroup = async (category_group: CategoryGroup, auth_req: AuthRequest): Promise<Record<string, string> | null> => {

  const user_id = auth_req.user.id
  const field_errors: Record<string, string> = {}

  /* ===============================
     Validaciones class-validator
  =============================== */

  const errors = await validate(category_group)
  if (errors.length > 0) {
    Object.assign(field_errors, mapValidationErrors(errors))
  }
  const group_repo = AppDataSource.getRepository(CategoryGroup)

  /* ===============================
     Nombre único por usuario
  =============================== */

  if (category_group.name) {
    const existing = await group_repo.findOne({
      where: {
        name: category_group.name,
        user: { id: user_id }
      }
    })

    if (existing && existing.id !== category_group.id) {
      field_errors.name = 'Ya existe un grupo de categoría con este nombre'
    }
  }

  logger.debug(`${validateCategoryGroup.name}-Errors: ${JSON.stringify(field_errors)}`)
  return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeleteCategoryGroup = async (category_group: CategoryGroup, auth_req: AuthRequest): Promise<Record<string, string> | null> => {

  const user_id = auth_req.user.id
  const field_errors: Record<string, string> = {}

  const category_repo = AppDataSource.getRepository(Category)
  const categories_count = await category_repo.count({
    where: {
      category_group: { id: category_group.id },
      user: { id: user_id }
    }
  })

  if (categories_count > 0) {
    field_errors.general = `No se puede eliminar el grupo porque tiene ${categories_count} categoría(s) asociada(s)`
  }

  logger.debug(`${validateDeleteCategoryGroup.name}-Errors: ${JSON.stringify(field_errors)}`)
  return Object.keys(field_errors).length > 0 ? field_errors : null
}
