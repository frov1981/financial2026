import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { getCategoryByName } from '../../cache/cache-categories.service'
import { getCategoryGroupById } from '../../cache/cache-category-group.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Category } from '../../entities/Category.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validateCategory = async (auth_req: AuthRequest, category: Category): Promise<Record<string, string> | null> => {
  const category_instance = plainToInstance(Category, category)
  const errors = await validate(category_instance)
  const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}
  // Nombre único por usuario
  if (category.name) {
    const existing = await getCategoryByName(auth_req, category.name)
    if (existing && existing.id !== category.id) {
      field_errors.name = 'Ya existe una categoría con este nombre'
    }
  }
  // Validación de tipo (SIEMPRE)
  if (!category.type) {
    field_errors.type = 'El tipo es obligatorio'
  }
  // Validación de grupo (OBLIGATORIO)
  if (!category.category_group || !category.category_group.id) {
    field_errors.category_group = 'El grupo de categoría es obligatorio'
  } else {
    const category_group = await getCategoryGroupById(auth_req, category.category_group.id)
    if (!category_group) {
      field_errors.category_group = 'El grupo de categoría seleccionado no es válido'
    }
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeleteCategory = async (auth_req: AuthRequest, category: Category): Promise<Record<string, string> | null> => {
  const user_id = auth_req.user.id
  const field_errors: Record<string, string> = {}
  const tx_repo = AppDataSource.getRepository(Transaction)
  const category_repo = AppDataSource.getRepository(Category)
  // Validación: transacciones asociadas
  const tx_count = await tx_repo.count({
    where: {
      category: { id: category.id },
      user: { id: user_id }
    }
  })
  if (tx_count > 0) {
    field_errors.general = `No se puede eliminar la categoría porque tiene ${tx_count} transacción(es) asociada(s)`
  }
  // Validación: categorías hijas (estructura)
  const children_count = await category_repo.count({
    where: {
      parent: { id: category.id },
      user: { id: user_id }
    }
  })
  if (children_count > 0) {
    field_errors.general = `No se puede eliminar la categoría porque tiene ${children_count} subcategoría(s) asociada(s)`
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}
