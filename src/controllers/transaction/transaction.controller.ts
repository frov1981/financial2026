import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/auth-request'
import { formatDateForInputLocal } from '../../utils/date.util'
import { logger } from '../../utils/logger.util'
import { getActiveAccountsByUser, getActiveAccountsForTransferByUser, getActiveCategoriesByUser, getNextValidTransactionDate, splitCategoriesByType } from './transaction.auxiliar'
export { saveTransaction as apiForSavingTransaction } from './transaction.saving'

export const apiForGettingTransactions: RequestHandler = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest

    const page = Number(authReq.query.page) || 1
    const limit = Number(authReq.query.limit) || 10
    const search = (authReq.query.search as string) || ''
    const skip = (page - 1) * limit
    const userId = authReq.user.id

    const categoryId = Number(authReq.query.category_id) || null

    const qb = AppDataSource
      .getRepository(Transaction)
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.account', 'account')
      .leftJoinAndSelect('t.to_account', 'to_account')
      .leftJoinAndSelect('t.category', 'category')
      .leftJoinAndSelect('t.loan', 'loan')
      .leftJoinAndSelect('t.loan_payment', 'loan_payment')
      .where('t.user_id = :userId', { userId })

    if (categoryId) {
      qb.andWhere('category.id = :categoryId', { categoryId })
    }

    if (search) {
      qb.andWhere(
        `(
          CASE LOWER(t.type) WHEN 'income' THEN 'ingresos' WHEN 'expense' THEN 'egresos' WHEN 'transfer' THEN 'transferencias' END LIKE :search OR
          CAST(t.amount AS CHAR) LIKE :search OR
          LOWER(account.name) LIKE :search OR
          LOWER(to_account.name) LIKE :search OR
          LOWER(category.name) LIKE :search OR
          LOWER(t.description) LIKE :search OR
          DATE_FORMAT(t.date, '%d/%m/%Y') LIKE :search OR
          DATE_FORMAT(t.date, '%Y-%m-%d') LIKE :search
        )`,
        { search: `%${search.toLowerCase()}%` }
      )
    }

    const [items, total] = await qb
      .orderBy('t.date', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount()

    res.json({ items, total, page, limit, category_id: categoryId })
  } catch (error) {
    logger.error('Error al listar transacciones:', error)
    res.status(500).json({ error: 'Error al listar transacciones' })
  }
}

export const routeToPageTransaction: RequestHandler = (req: Request, res: Response) => {
  const authReq = req as AuthRequest
  const categoryId = req.query.category_id || null
  const from = req.query.from || null

  res.render(
    'layouts/main',
    {
      title: 'Transacciones',
      view: 'pages/transactions/index',
      incomeCategories: [],
      expenseCategories: [],
      USER_ID: authReq.user?.id || 'guest',
      context: {
        from,
        category_id: categoryId
      },
    })
}

export const routeToFormInsertTransaction: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'insert'
  const authReq = req as AuthRequest
  const categoryId = req.query.category_id || null
  const from = req.query.from || null

  const defaultDate = await getNextValidTransactionDate(authReq)
  const accounts = await getActiveAccountsByUser(authReq)
  const accountsForTransfer = await getActiveAccountsForTransferByUser(authReq)
  const categories = await getActiveCategoriesByUser(authReq)
  const { incomeCategories, expenseCategories } = splitCategoriesByType(categories)
  res.render(
    'layouts/main',
    {
      title: 'Insertar Transacción',
      view: 'pages/transactions/form',
      transaction: {
        date: formatDateForInputLocal(defaultDate).slice(0, 16),
        amount: '0.00',
      },
      errors: {},
      accounts,
      accountsForTransfer,
      incomeCategories,
      expenseCategories,
      mode,
      context: {
        category_id: categoryId,
        from
      }
    })
}

export const routeToFormUpdateTransaction: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'update'
  const authReq = req as AuthRequest
  const transactionId = Number(req.params.id)
  const categoryId = req.query.category_id || null
  const from = req.query.from || null

  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    return res.redirect('/transactions')
  }

  const repoTransaction = AppDataSource.getRepository(Transaction)
  const transaction = await repoTransaction.findOne({
    where: { id: transactionId, user: { id: authReq.user.id } },
    relations: { account: true, to_account: true, category: true }
  })

  if (!transaction) {
    return res.redirect('/transactions')
  }

  const accounts = await getActiveAccountsByUser(authReq)
  const accountsForTransfer = await getActiveAccountsForTransferByUser(authReq)
  const categories = await getActiveCategoriesByUser(authReq)
  const { incomeCategories, expenseCategories } = splitCategoriesByType(categories)
  res.render(
    'layouts/main',
    {
      title: 'Editar Transacción',
      view: 'pages/transactions/form',
      transaction: {
        id: transaction.id,
        type: transaction.type,
        account_id: transaction.account ? transaction.account.id : '',
        account_name: transaction.account ? transaction.account.name : '',
        to_account_id: transaction.to_account ? transaction.to_account.id : '',
        to_account_name: transaction.to_account ? transaction.to_account.name : '',
        category_id: transaction.category ? transaction.category.id : '',
        category_name: transaction.category ? transaction.category.name : '',
        amount: Number(transaction.amount),
        date: formatDateForInputLocal(transaction.date).slice(0, 16),
        description: transaction.description ?? ''
      },
      accounts,
      accountsForTransfer,
      incomeCategories,
      expenseCategories,
      errors: {},
      mode,
      context: {
        category_id: categoryId,
        from
      }
    })

}

export const routeToFormCloneTransaction: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'insert'
  const authReq = req as AuthRequest
  const transactionId = Number(req.params.id)
  const categoryId = req.query.category_id || null
  const from = req.query.from || null

  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    return res.redirect('/transactions')
  }

  const repoTransaction = AppDataSource.getRepository(Transaction)
  const transaction = await repoTransaction.findOne({
    where: { id: transactionId, user: { id: authReq.user.id } },
    relations: { account: true, to_account: true, category: true }
  })

  if (!transaction) {
    return res.redirect('/transactions')
  }

  const defaultDate = await getNextValidTransactionDate(authReq)
  const accounts = await getActiveAccountsByUser(authReq)
  const accountsForTransfer = await getActiveAccountsForTransferByUser(authReq)
  const categories = await getActiveCategoriesByUser(authReq)
  const { incomeCategories, expenseCategories } = splitCategoriesByType(categories)

  res.render(
    'layouts/main',
    {
      title: 'Clonar Transacción',
      view: 'pages/transactions/form',
      transaction: {
        type: transaction.type,
        account_id: transaction.account ? transaction.account.id : '',
        account_name: transaction.account ? transaction.account.name : '',
        to_account_id: transaction.to_account ? transaction.to_account.id : '',
        to_account_name: transaction.to_account ? transaction.to_account.name : '',
        category_id: transaction.category ? transaction.category.id : '',
        category_name: transaction.category ? transaction.category.name : '',
        amount: Number(transaction.amount),
        date: formatDateForInputLocal(defaultDate).slice(0, 16),
        description: transaction.description ?? ''
      },
      accounts,
      accountsForTransfer,
      incomeCategories,
      expenseCategories,
      errors: {},
      mode,
      context: {
        category_id: categoryId,
        from
      }
    }
  )
}

export const routeToFormDeleteTransaction: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'delete'
  const authReq = req as AuthRequest
  const transactionId = Number(req.params.id)
  const categoryId = req.query.category_id || null
  const from = req.query.from || null

  if (!Number.isInteger(transactionId) || transactionId <= 0) {
    return res.redirect('/transactions')
  }

  const repoTransaction = AppDataSource.getRepository(Transaction)
  const transaction = await repoTransaction.findOne({
    where: { id: transactionId, user: { id: authReq.user.id } },
    relations: { account: true, to_account: true, category: true }
  })

  if (!transaction) {
    return res.redirect('/transactions')
  }

  const accounts = await getActiveAccountsByUser(authReq)
  const accountsForTransfer = await getActiveAccountsForTransferByUser(authReq)
  const categories = await getActiveCategoriesByUser(authReq)
  const { incomeCategories, expenseCategories } = splitCategoriesByType(categories)
  res.render(
    'layouts/main',
    {
      title: 'Eliminar Transacción',
      view: 'pages/transactions/form',
      transaction: {
        id: transaction.id,
        type: transaction.type,
        account_id: transaction.account ? transaction.account.id : '',
        account_name: transaction.account ? transaction.account.name : '',
        to_account_id: transaction.to_account ? transaction.to_account.id : '',
        to_account_name: transaction.to_account ? transaction.to_account.name : '',
        category_id: transaction.category ? transaction.category.id : '',
        category_name: transaction.category ? transaction.category.name : '',
        amount: Number(transaction.amount),
        date: formatDateForInputLocal(transaction.date).slice(0, 16),
        description: transaction.description ?? ''
      },
      accounts,
      accountsForTransfer,
      incomeCategories,
      expenseCategories,
      errors: {},
      mode,
      context: {
        category_id: categoryId,
        from
      }
    })
}


