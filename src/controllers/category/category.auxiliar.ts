import { AppDataSource } from '../../config/typeorm.datasource'
import { CategoryGroup } from '../../entities/CategoryGroups.entity'
import { AuthRequest } from '../../types/auth-request'

export const getActiveParentCategoriesByUser = async (
  authReq: AuthRequest
): Promise<CategoryGroup[]> => {
  const repo = AppDataSource.getRepository(CategoryGroup)

  return await repo.find({
    where: {
      user: { id: authReq.user.id }
    },
    order: { name: 'ASC' }
  })
}
