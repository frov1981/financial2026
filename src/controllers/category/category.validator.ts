import { validate } from 'class-validator'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Category } from '../../entities/Category.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'
import { Transaction } from '../../entities/Transaction.entity'

export const validateCategory = async (
  category: Category,
  authReq: AuthRequest
): Promise<Record<string, string> | null> => {

  const userId = authReq.user.id
  const fieldErrors: Record<string, string> = {}

  /* ===============================
     Validaciones class-validator
  =============================== */

  const errors = await validate(category)
  if (errors.length > 0) {
    Object.assign(fieldErrors, mapValidationErrors(errors))
  }

  const repo = AppDataSource.getRepository(Category)

  /* ===============================
     Nombre único por usuario
  =============================== */

  if (category.name) {
    const existing = await repo.findOne({
      where: {
        name: category.name,
        user: { id: userId }
      }
    })

    if (existing && existing.id !== category.id) {
      fieldErrors.name = 'Ya existe una categoría con este nombre'
    }
  }

  /* ===============================
     Validación de tipo (SIEMPRE)
  =============================== */

  if (!category.type) {
    fieldErrors.type = 'El tipo es obligatorio'
  }

  /* ===============================
     Validación parent / child
  =============================== */

  if (category.parent) {

    // Evitar self-reference
    if (category.id && category.parent.id === category.id) {
      fieldErrors.parent = 'Una categoría no puede ser padre de sí misma'
    }

    // Validar parent real
    const parent = await repo.findOne({
      where: {
        id: category.parent.id,
        user: { id: userId },
        is_active: true
      }
    })

    if (!parent) {
      fieldErrors.parent = 'La categoría padre seleccionada no es válida'
    }
  }

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null
}

export const validateDeleteCategory = async (
  category: Category,
  authReq: AuthRequest
): Promise<Record<string, string> | null> => {

  const userId = authReq.user.id
  const fieldErrors: Record<string, string> = {}

  const txRepo = AppDataSource.getRepository(Transaction)
  const categoryRepo = AppDataSource.getRepository(Category)

  /* ===============================
     Validación: transacciones asociadas
  =============================== */

  const txCount = await txRepo.count({
    where: {
      category: { id: category.id },
      user: { id: userId }
    }
  })

  if (txCount > 0) {
    fieldErrors.general = `No se puede eliminar la categoría porque tiene ${txCount} transacción(es) asociada(s)`
  }

  /* ===============================
     Validación: categorías hijas
  =============================== */

  const childrenCount = await categoryRepo.count({
    where: {
      parent: { id: category.id },
      user: { id: userId }
    }
  })

  if (childrenCount > 0) {
    fieldErrors.general = `No se puede eliminar la categoría porque tiene ${childrenCount} subcategoría(s) asociada(s)`
  }

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null
}
