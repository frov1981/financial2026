// controllers/category.controller.validator.ts
import { validate } from 'class-validator'
import { AppDataSource } from '../../config/datasource'
import { Category } from '../../entities/Category.entity'
import { AuthRequest } from '../../types/AuthRequest'
import { logger } from '../../utils/logger.util'
import { mapValidationErrors } from '../../validators/mapValidationErrors.validator'
import { Transaction } from '../../entities/Transaction.entity'

export const validateCategory = async (category: Category, authReq: AuthRequest): Promise<Record<string, string> | null> => {

  const userId = authReq.user.id
  const errors = await validate(category)
  const fieldErrors = errors.length > 0 ? mapValidationErrors(errors) : {}

  // Validación: nombre único por usuario
  if (category.name && userId) {
    const repo = AppDataSource.getRepository(Category)

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

  logger.warn(`Category validation`, { userId, fieldErrors })
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null
}

export const validateDeleteCategory = async (category: Category, authReq: AuthRequest): Promise<Record<string, string> | null> => {
  const userId = authReq.user.id
  const fieldErrors: Record<string, string> = {}

  const txRepo = AppDataSource.getRepository(Transaction)

  const txCount = await txRepo.count({
    where: {
      category: { id: category.id },
      user: { id: userId }
    }
  })

  if (txCount > 0) {
    fieldErrors.general = `No se puede eliminar la categoría porque tiene ${txCount} transacción(es) asociada(s)`
  }

  // Si no hay errores
  logger.warn(`Category delete validation`, { userId, categoryId: category.id, txCount, fieldErrors })
  return Object.keys(fieldErrors).length > 0 ? fieldErrors : null
}
