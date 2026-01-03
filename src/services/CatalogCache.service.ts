import { AppDataSource } from '../config/datasource'
import { Account } from '../entities/Account.entity'
import { Category } from '../entities/Category.entity'

const activeAccountsCache = new Map<number, Account[]>()
const activeCategoriesCache = new Map<number, Category[]>()

const allAccountsCache = new Map<number, Account[]>()
const allCategoriesCache = new Map<number, Category[]>()

/* =======================
   Accounts activas
======================= */
export const getActiveAccountsByUser1 = async (userId: number) => {
  if (!activeAccountsCache.has(userId)) {
    const accounts = await AppDataSource
      .getRepository(Account)
      .find({
        where: {
          user: { id: userId },
          is_active: true
        },
        order: { name: 'ASC' }
      })

    activeAccountsCache.set(userId, accounts)
  }

  return activeAccountsCache.get(userId)!
}

/* =======================
   Categories activas (solo hijas)
======================= */
export const getActiveCategoriesByUser1 = async (userId: number) => {
  if (!activeCategoriesCache.has(userId)) {
    const qb = AppDataSource
      .getRepository(Category)
      .createQueryBuilder('c')
      .where('c.user_id = :userId', { userId })
      .andWhere('c.is_active = true')
      .andWhere(qb => {
        const sub = qb.subQuery()
          .select('1')
          .from(Category, 'c2')
          .where('c2.parent_id = c.id')
          .getQuery()

        return `NOT EXISTS ${sub}`
      })
      .orderBy('c.name', 'ASC')

    activeCategoriesCache.set(userId, await qb.getMany())
  }

  return activeCategoriesCache.get(userId)!
}

export const getAllAccountsByUser1 = async (userId: number) => {
  if (!allAccountsCache.has(userId)) {
    const accounts = await AppDataSource
      .getRepository(Account)
      .find({ where: { user: { id: userId } }, order: { name: 'ASC' } })
    allAccountsCache.set(userId, accounts)
  }
  return allAccountsCache.get(userId)!
}

export const getAllCategoriesByUser1 = async (userId: number) => {
  if (!allCategoriesCache.has(userId)) {
    const categories = await AppDataSource
      .getRepository(Category)
      .find({ where: { user: { id: userId } }, order: { name: 'ASC' } })
    allCategoriesCache.set(userId, categories)
  }
  return allCategoriesCache.get(userId)!
}


/* =======================
   Limpieza selectiva
======================= */
export const clearActiveCatalogCacheByUser = (userId: number) => {
  activeAccountsCache.delete(userId)
  activeCategoriesCache.delete(userId)
}

/* =======================
   Limpieza total (opcional)
======================= */
export const clearAllCatalogCache = () => {
  allAccountsCache.clear()
  allCategoriesCache.clear()
}
