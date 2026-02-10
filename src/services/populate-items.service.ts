import { In, IsNull, MoreThanOrEqual, Not } from "typeorm"
import { AppDataSource } from "../config/typeorm.datasource"
import { Account } from "../entities/Account.entity"
import { LoanGroup } from "../entities/LoanGroup.entity"
import { AuthRequest } from "../types/auth-request"
import { Category } from "../entities/Category.entity"
import { CategoryGroup } from "../entities/CategoryGroups.entity"

export const getActiveParentLoansByUser = async (auth_req: AuthRequest): Promise<LoanGroup[]> => {
  const repo = AppDataSource.getRepository(LoanGroup)

  return await repo.find({
    where: {
      user: { id: auth_req.user.id },
      is_active: true
    },
    order: { name: 'ASC' }
  })
}

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

export const getActiveAccountsByUser = async (authReq: AuthRequest): Promise<Account[]> => {
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

export const getActiveAccountsForTransferByUser = async (authReq: AuthRequest): Promise<Account[]> => {
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

export const getActiveCategoriesByUser = async (authReq: AuthRequest): Promise<Category[]> => {
  const repo = AppDataSource.getRepository(Category)
  const categories = await repo.find({
    where: {
      user: { id: authReq.user.id },
      is_active: true,
      parent: Not(IsNull())
    },
    order: { name: 'ASC' }
  })
  return categories
}