import { IsNull } from 'typeorm'
import { AppDataSource } from '../../config/datasource'
import { Category } from '../../entities/Category.entity'
import { AuthRequest } from '../../types/AuthRequest'

export const getActiveParentCategoriesByUser = async (
  authReq: AuthRequest
): Promise<Category[]> => {
  const repo = AppDataSource.getRepository(Category)

  return await repo.find({
    where: {
      user: { id: authReq.user.id },
      is_active: true,
      parent: IsNull()
    },
    order: { name: 'ASC' }
  })
}
