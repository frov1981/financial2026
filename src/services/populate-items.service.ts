import { In, MoreThanOrEqual } from "typeorm"
import { AppDataSource } from "../config/typeorm.datasource"
import { Account } from "../entities/Account.entity"
import { PayableGroup } from "../entities/PayableGroup.entity"
import { AuthRequest } from "../types/auth-request"
import { Category } from "../entities/Category.entity"
import { CategoryGroup } from "../entities/CategoryGroups.entity"

export const getActiveParentPayablesByUser = async (auth_req: AuthRequest): Promise<PayableGroup[]> => {
  const repo = AppDataSource.getRepository(PayableGroup)

  return await repo.find({
    where: {
      user: { id: auth_req.user.id },
      is_active: true
    },
    order: { name: 'ASC' }
  })
}

export const getActiveParentPaymentsByUser = getActiveParentPayablesByUser

export const getActiveParentCategoriesByUser = async (auth_req: AuthRequest): Promise<CategoryGroup[]> => {
  const repo = AppDataSource.getRepository(CategoryGroup)

  return await repo.find({
    where: {
      user: { id: auth_req.user.id },
      is_active: true
    },
    order: { name: 'ASC' }
  })
}

export const getActiveAccountsByUser_Deprecated = async (authReq: AuthRequest): Promise<Account[]> => {
  const repo = AppDataSource.getRepository(Account)
  /* type!: 'cash' | 'bank' | 'card' | 'saving' */
  const accounts = await repo.find({
    where: {
      user: { id: authReq.user.id },
      is_active: true,
      balance: MoreThanOrEqual(0),
      type: In(['cash', 'bank', 'card'])
    },
    order: { name: 'ASC' }
  })
  return accounts
}

export const getActiveAccountsForTransferByUser_Deprecated = async (authReq: AuthRequest): Promise<Account[]> => {
  const repo = AppDataSource.getRepository(Account)
  const accounts = await repo.find({
    where: {
      user: { id: authReq.user.id },
      is_active: true,
      balance: MoreThanOrEqual(0),
    },
    order: { name: 'ASC' }
  })
  return accounts
}

export const getActiveCategoriesByUser_Deprecated = async (authReq: AuthRequest): Promise<Category[]> => {
  const repo = AppDataSource.getRepository(Category)
  const categories = await repo.find({
    where: {
      user: { id: authReq.user.id },
      is_active: true,
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
      type_for_payable: 'payable_payment'
    },
    order: { name: 'ASC' }
  })
  return categories
}

export const getActiveCategoriesForPaymentsByUser = getActiveCategoriesForPayablesByUser