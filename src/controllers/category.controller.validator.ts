// controllers/category.controller.validator.ts
import { validate } from 'class-validator'
import { AppDataSource } from '../config/datasource'
import { Category } from '../entities/Category.entity'
import { AuthRequest } from '../types/AuthRequest'
import { logger } from '../utils/logger.util'
import { mapValidationErrors } from '../validators/mapValidationErrors.validator'

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
