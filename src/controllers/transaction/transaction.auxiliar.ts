import { AppDataSource } from '../../config/typeorm.datasource'
import { Category } from '../../entities/Category.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/auth-request'
import { DateTime } from 'luxon'

type SplitCategoriesResult = {
  active_income_categories: Category[]
  active_expense_categories: Category[]
}

export const splitCategoriesByType = (categories: Category[]): SplitCategoriesResult => {
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

export const calculateTransactionDeltas = (transaction: Transaction, factor: 1 | -1): Map<number, number> => {
  const deltas = new Map<number, number>()
  const amount = Number(transaction.amount)

  const addDelta = (accountId?: number, value?: number) => {
    if (!accountId || !value) return
    const prev = deltas.get(accountId) || 0
    deltas.set(accountId, prev + value)
  }

  if (transaction.type === 'income' && transaction.account?.id) {
    addDelta(transaction.account.id, amount * factor)
  }

  if (transaction.type === 'expense' && transaction.account?.id) {
    addDelta(transaction.account.id, -amount * factor)
  }

  if (transaction.type === 'transfer') {
    if (transaction.account?.id) {
      addDelta(transaction.account.id, -amount * factor)
    }
    if (transaction.to_account?.id) {
      addDelta(transaction.to_account.id, amount * factor)
    }
  }
  return deltas
}

export const buildReturnUrl = (from?: string, category_id?: number | null, extraParams?: Record<string, string>) => {
  const params = new URLSearchParams()

  if (from === 'categories' && category_id) {
    params.set('category_id', String(category_id))
    params.set('from', 'categories')
  }

  if (extraParams) {
    for (const key in extraParams) {
      params.set(key, extraParams[key])
    }
  }

  return `/transactions${params.toString() ? `?${params}` : ''}`
}
