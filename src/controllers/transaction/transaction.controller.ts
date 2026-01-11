import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/datasource'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/AuthRequest'
import { formatDateForInputLocal } from '../../utils/date.util'
import { logger } from '../../utils/logger.util'
import { getActiveAccountsByUser, getActiveCategoriesByUser, getNextValidTransactionDate, splitCategoriesByType } from './transaction.controller.auxiliar'
export { saveTransaction } from './transaction.controller.saving'


export const listTransactionsPaginatedAPI: RequestHandler = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthRequest

    const page = Number(authReq.query.page) || 1
    const limit = Number(authReq.query.limit) || 10
    const search = (authReq.query.search as string) || ''
    const skip = (page - 1) * limit
    const userId = authReq.user.id

    const qb = AppDataSource
      .getRepository(Transaction)
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.account', 'account')
      .leftJoinAndSelect('t.to_account', 'to_account')
      .leftJoinAndSelect('t.category', 'category')
      .leftJoinAndSelect('t.loan', 'loan')
      .where('t.user_id = :userId', { userId })

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

    res.json({ items, total, page, limit })
  } catch (error) {
    logger.error('Error al listar transacciones:', error)
    res.status(500).json({ error: 'Error al listar transacciones' })
  }
}

export const insertTransactionFormPage: RequestHandler = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest
  const mode = 'insert'

  const defaultDate = await getNextValidTransactionDate(authReq)

  const accounts = await getActiveAccountsByUser(authReq)
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
      incomeCategories,
      expenseCategories,
      mode
    })
}

export const updateTransactionFormPage: RequestHandler = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest
  const txId = Number(req.params.id)
  const mode = 'update'

  const repo = AppDataSource.getRepository(Transaction)

  const tx = await repo.findOne({
    where: { id: txId, user: { id: authReq.user.id } },
    relations: ['account', 'to_account', 'category']
  })

  if (!tx) {
    return res.redirect('/transactions')
  }

  const accounts = await getActiveAccountsByUser(authReq)
  const categories = await getActiveCategoriesByUser(authReq)
  const { incomeCategories, expenseCategories } = splitCategoriesByType(categories)

  res.render(
    'layouts/main',
    {
      title: 'Editar Transacción',
      view: 'pages/transactions/form',
      transaction: {
        id: tx.id,
        type: tx.type,

        account_id: tx.account ? tx.account.id : '',
        account_name: tx.account ? tx.account.name : '',

        to_account_id: tx.to_account ? tx.to_account.id : '',
        to_account_name: tx.to_account ? tx.to_account.name : '',

        category_id: tx.category ? tx.category.id : '',
        category_name: tx.category ? tx.category.name : '',

        amount: Number(tx.amount),
        date: formatDateForInputLocal(tx.date).slice(0, 16),
        description: tx.description ?? ''
      },
      accounts,
      incomeCategories,
      expenseCategories,
      errors: {},
      mode
    })

}

export const deleteTransactionFormPage: RequestHandler = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest
  const txId = Number(req.params.id)
  const mode = 'delete'

  const repo = AppDataSource.getRepository(Transaction)

  const tx = await repo.findOne({
    where: { id: txId, user: { id: authReq.user.id } },
    relations: ['account', 'to_account', 'category']
  })

  if (!tx) {
    return res.redirect('/transactions')
  }

  const accounts = await getActiveAccountsByUser(authReq)
  const categories = await getActiveCategoriesByUser(authReq)
  const { incomeCategories, expenseCategories } = splitCategoriesByType(categories)

  res.render(
    'layouts/main',
    {
      title: 'Eliminar Transacción',
      view: 'pages/transactions/form',
      transaction: {
        id: tx.id,
        type: tx.type,

        account_id: tx.account ? tx.account.id : '',
        account_name: tx.account ? tx.account.name : '',

        to_account_id: tx.to_account ? tx.to_account.id : '',
        to_account_name: tx.to_account ? tx.to_account.name : '',

        category_id: tx.category ? tx.category.id : '',
        category_name: tx.category ? tx.category.name : '',

        amount: Number(tx.amount),
        date: formatDateForInputLocal(tx.date).slice(0, 16),
        description: tx.description ?? ''
      },
      accounts,
      incomeCategories,
      expenseCategories,
      errors: {},
      mode
    })
}

export const transactionsPage: RequestHandler = (req: Request, res: Response) => {
  const authReq = req as AuthRequest

  res.render(
    'layouts/main',
    {
      title: 'Transacciones',
      view: 'pages/transactions/index',
      incomeCategories: [],
      expenseCategories: [],
      USER_ID: authReq.user?.id || 'guest'
    })
}

