import { AppDataSource } from '../../config/typeorm.datasource'
import { Category } from '../../entities/Category.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/auth-request'

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

  if (!lastTxToday || !lastTxToday.date) return now
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
  active_income_categories: Category[]
  active_expense_categories: Category[]
} => {
  const active_income_categories: Category[] = []
  const active_expense_categories: Category[] = []

  categories.forEach(category => {
    if (category.type === 'income') {
      active_income_categories.push(category)
    }

    if (category.type === 'expense') {
      active_expense_categories.push(category)
    }
  })

  return {
    active_income_categories,
    active_expense_categories
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



