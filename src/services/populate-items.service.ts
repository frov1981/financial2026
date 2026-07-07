import { AppDataSource } from "../config/typeorm.datasource"
import { Category } from "../entities/Category.entity"
import { CategoryGroup } from "../entities/CategoryGroups.entity"
import { PayableGroup } from "../entities/PayableGroup.entity"
import { AuthRequest } from "../types/auth-request"

export const getActiveParentPayablesByUser = async (auth_req: AuthRequest): Promise<PayableGroup[]> => {
  const repo = AppDataSource.getRepository(PayableGroup)

  const parentPayables = await repo.find({
    where: {
      user: { id: auth_req.user.id },
      is_active: true
    },
    order: { name: 'ASC' }
  })
  return parentPayables
}


export const getActiveParentCategoriesByUser = async (auth_req: AuthRequest): Promise<CategoryGroup[]> => {
  const repo = AppDataSource.getRepository(CategoryGroup)
  const parentCategories =  await repo.find({
    where: {
      user: { id: auth_req.user.id },
      is_active: true
    },
    order: { name: 'ASC' }
  })
  return parentCategories
}

export const getActiveCategoriesForPayablePaymentsByUser = async (authReq: AuthRequest): Promise<Category[]> => {
  const repo = AppDataSource.getRepository(Category)
  const categories = await repo.find({
    where: {
      user: { id: authReq.user.id },
      is_active: true,
      type_for_payable: 'payable_payment'
    },
    order: { name: 'ASC' }
  })
  return categories
}

export const getActiveCategoriesForPayablesByUser = async (authReq: AuthRequest): Promise<Category[]> => {
  const repo = AppDataSource.getRepository(Category)
  const categories = await repo.find({
    where: {
      user: { id: authReq.user.id },
      is_active: true,
      type_for_payable: 'payable'
    },
    order: { name: 'ASC' }
  })
  return categories
}