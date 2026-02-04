import { In, IsNull, MoreThanOrEqual, Not } from 'typeorm'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Account } from '../../entities/Account.entity'
import { Category } from '../../entities/category.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/auth-request'

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

export const getNextValidTransactionDate = async (authReq: AuthRequest): Promise<Date> => {
  const userId = authReq.user.id

  const now = new Date()

  const startOfDay = new Date(now)
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59, 999)

  const lastTxToday = await AppDataSource
    .getRepository(Transaction)
    .createQueryBuilder('t')
    .where('t.user_id = :userId', { userId })
    .andWhere('t.date BETWEEN :start AND :end', {
      start: startOfDay,
      end: endOfDay
    })
    .orderBy('t.date', 'DESC')
    .getOne()

  if (!lastTxToday) return now
  if (lastTxToday.date > now) return now

  const next = new Date(lastTxToday.date)
  const minutes = next.getMinutes()
  const remainder = minutes % 5
  const increment = remainder === 0 ? 5 : 5 - remainder

  next.setMinutes(minutes + increment)
  next.setSeconds(0, 0)

  return next > now ? next : now
}

export const splitCategoriesByType = (categories: Category[]): {
  incomeCategories: Category[]
  expenseCategories: Category[]
} => {
  const incomeCategories: Category[] = []
  const expenseCategories: Category[] = []

  categories.forEach(category => {
    if (category.type === 'income') {
      incomeCategories.push(category)
    }

    if (category.type === 'expense') {
      expenseCategories.push(category)
    }
  })

  return {
    incomeCategories,
    expenseCategories
  }
}

export const calculateTransactionDeltas = (
  tx: Transaction,
  factor: 1 | -1
): Map<number, number> => {
  const deltas = new Map<number, number>()
  const amount = Number(tx.amount)

  const addDelta = (accountId?: number, value?: number) => {
    if (!accountId || !value) return
    const prev = deltas.get(accountId) || 0
    deltas.set(accountId, prev + value)
  }

  if (tx.type === 'income' && tx.account?.id) {
    addDelta(tx.account.id, amount * factor)
  }

  if (tx.type === 'expense' && tx.account?.id) {
    addDelta(tx.account.id, -amount * factor)
  }

  if (tx.type === 'transfer') {
    if (tx.account?.id) {
      addDelta(tx.account.id, -amount * factor)
    }
    if (tx.to_account?.id) {
      addDelta(tx.to_account.id, amount * factor)
    }
  }

  return deltas
}



