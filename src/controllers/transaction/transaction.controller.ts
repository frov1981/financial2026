import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Transaction } from '../../entities/Transaction.entity'
import { transactionFormMatrix } from '../../policies/transaction-form.policy'
import { getActiveAccountsByUser, getActiveAccountsForTransferByUser, getActiveCategoriesByUser } from '../../services/populate-items.service'
import { AuthRequest } from '../../types/auth-request'
import { formatDateForInputLocal } from '../../utils/date.util'
import { logger } from '../../utils/logger.util'
import { splitCategoriesByType } from './transaction.auxiliar'
import { validateActiveCategoryTransaction } from './transaction.validator'
import { getNextValidTransactionDate } from '../../services/next-valid-trx-date.service'
export { saveTransaction as apiForSavingTransaction } from './transaction.saving'


/* =========================================================
   Helper de render para formulario (igual patrón que loans)
========================================================= */
type TransactionFormViewParams = {
  title: string
  view: string
  transaction: any
  errors: any
  mode: 'insert' | 'update' | 'delete'
  auth_req: AuthRequest
  context: {
    category_id: any
    from: any
  }
}

const renderTransactionForm = async (res: Response, params: TransactionFormViewParams) => {
  const { title, view, transaction, errors, mode, auth_req, context } = params

  const active_accounts = await getActiveAccountsByUser(auth_req)
  const active_accounts_for_transfer = await getActiveAccountsForTransferByUser(auth_req)
  const active_categories = await getActiveCategoriesByUser(auth_req)
  const transaction_form_policy = transactionFormMatrix[mode]
  const { active_income_categories, active_expense_categories } = splitCategoriesByType(active_categories)

  return res.render(
    'layouts/main',
    {
      title,
      view,
      transaction,
      active_accounts,
      active_accounts_for_transfer,
      active_income_categories,
      active_expense_categories,
      transaction_form_policy,
      errors,
      mode,
      context,
    }
  )
}

export const apiForGettingTransactions: RequestHandler = async (req: Request, res: Response) => {
  logger.debug(`${apiForGettingTransactions.name}-Start`)
  try {
    const auth_req = req as AuthRequest
    const page = Number(auth_req.query.page) || 1
    const limit = Number(auth_req.query.limit) || 10
    const search = (auth_req.query.search as string) || ''
    const skip = (page - 1) * limit
    const user_id = auth_req.user.id
    const category_id = Number(auth_req.query.category_id) || null

    const qb = AppDataSource
      .getRepository(Transaction)
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.account', 'account')
      .leftJoinAndSelect('t.to_account', 'to_account')
      .leftJoinAndSelect('t.category', 'category')
      .leftJoinAndSelect('t.loan', 'loan')
      .leftJoinAndSelect('t.loan_payment', 'loan_payment')
      .where('t.user_id = :user_id', { user_id })

    if (category_id) {
      qb.andWhere('category.id = :category_id', { category_id })
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

    logger.debug(`${apiForGettingTransactions.name}-Transactions found: [${items.length}], Total: [${total}], Page: [${page}], Limit: [${limit}], Search: [${search}], Category ID: [${category_id}]`)
    res.json({ items, total, page, limit, category_id: category_id })
  } catch (error) {
    logger.error(`${apiForGettingTransactions.name}-Error. `, error)
    res.status(500).json({ error: 'Error al listar transacciones' })
  } finally {
    logger.debug(`${apiForGettingTransactions.name}-End`)
  }
}

export const routeToPageTransaction: RequestHandler = (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const category_id = req.query.category_id || null
  const from = req.query.from || null
  const saved_batch = req.query.saved_batch === 'true'
  const timezone = auth_req.timezone || 'UTC'
  logger.debug(`${routeToPageTransaction.name}-Routing to transactions page with timezone: ${timezone}`)
  res.render(
    'layouts/main',
    {
      title: 'Transacciones',
      view: 'pages/transactions/index',
      active_income_categories: [],
      active_expense_categories: [],
      USER_ID: auth_req.user?.id || 'guest',
      TIMEZONE: timezone,
      context: {
        from,
        category_id: category_id,
        saved_batch
      },
    })
}

export const routeToFormInsertTransaction: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  const category_id = req.query.category_id || null
  const from = req.query.from || null
  const timezone = auth_req.timezone || 'UTC'

  const default_date = await getNextValidTransactionDate(auth_req)
  logger.debug(`${routeToFormInsertTransaction.name}-Routing for inserting transaction form with timezone: [${timezone}]`)
  return renderTransactionForm(res, {
    title: 'Insertar Transacción',
    view: 'pages/transactions/form',
    transaction: {
      date: formatDateForInputLocal(default_date, timezone),
      amount: '0.00',
    },
    errors: {},
    mode,
    auth_req: auth_req,
    context: {
      category_id: category_id,
      from
    }
  })
}

export const routeToFormUpdateTransaction: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'update'
  const auth_req = req as AuthRequest
  const transaction_id = Number(req.params.id)
  const category_id = req.query.category_id || null
  const from = req.query.from || null
  const timezone = auth_req.timezone || 'UTC'
  if (!Number.isInteger(transaction_id) || transaction_id <= 0) {
    return res.redirect('/transactions')
  }
  const repo_transaction = AppDataSource.getRepository(Transaction)
  const transaction = await repo_transaction.findOne({
    where: { id: transaction_id, user: { id: auth_req.user.id } },
    relations: { account: true, to_account: true, category: true }
  })
  if (!transaction) {
    return res.redirect('/transactions')
  }
  logger.debug(`${routeToFormUpdateTransaction.name}-Routing for updating transaction form with timezone: [${timezone}]`)
  return renderTransactionForm(res, {
    title: 'Editar Transacción',
    view: 'pages/transactions/form',
    transaction: {
      id: transaction.id,
      type: transaction.type,
      account: transaction.account,
      to_account: transaction.to_account,
      category: transaction.category,
      amount: Number(transaction.amount),
      date: formatDateForInputLocal(transaction.date, timezone),
      description: transaction.description ?? ''
    },
    errors: {},
    mode,
    auth_req: auth_req,
    context: {
      category_id: category_id,
      from
    }
  })
}

export const routeToFormCloneTransaction: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  const transaction_id = Number(req.params.id)
  const category_id = req.query.category_id || null
  const from = req.query.from || null
  const timezone = auth_req.timezone || 'UTC'
  if (!Number.isInteger(transaction_id) || transaction_id <= 0) {
    return res.redirect('/transactions')
  }
  const repo_transaction = AppDataSource.getRepository(Transaction)
  const transaction = await repo_transaction.findOne({
    where: { id: transaction_id, user: { id: auth_req.user.id } },
    relations: { account: true, to_account: true, category: true }
  })
  if (!transaction) {
    return res.redirect('/transactions')
  }
  const default_date = await getNextValidTransactionDate(auth_req)
  const category_errors = await validateActiveCategoryTransaction(transaction, auth_req)
  const errors = category_errors ? category_errors : {}  
  logger.debug(`${routeToFormCloneTransaction.name}-Routing for cloning transaction form with timezone: [${timezone}]`)
  return renderTransactionForm(res, {
    title: 'Clonar Transacción',
    view: 'pages/transactions/form',
    transaction: {
      type: transaction.type,
      account: transaction.account,
      to_account: transaction.to_account,
      category: transaction.category,
      amount: Number(transaction.amount),
      date: formatDateForInputLocal(default_date, timezone),
      description: transaction.description ?? ''
    },
    errors: errors,
    mode,
    auth_req: auth_req,
    context: {
      category_id: category_id,
      from
    }
  })
}

export const routeToFormDeleteTransaction: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'delete'
  const auth_req = req as AuthRequest
  const transaction_id = Number(req.params.id)
  const category_id = req.query.category_id || null
  const from = req.query.from || null
  const timezone = auth_req.timezone || 'UTC'
  if (!Number.isInteger(transaction_id) || transaction_id <= 0) {
    return res.redirect('/transactions')
  }
  const repo_transaction = AppDataSource.getRepository(Transaction)
  const transaction = await repo_transaction.findOne({
    where: { id: transaction_id, user: { id: auth_req.user.id } },
    relations: { account: true, to_account: true, category: true }
  })
  if (!transaction) {
    return res.redirect('/transactions')
  }
  logger.debug(`${routeToFormDeleteTransaction.name}-Routing for deleting transaction form with timezone: [${timezone}]`)
  return renderTransactionForm(res, {
    title: 'Eliminar Transacción',
    view: 'pages/transactions/form',
    transaction: {
      id: transaction.id,
      type: transaction.type,
      account: transaction.account,
      to_account: transaction.to_account,
      category: transaction.category,
      amount: Number(transaction.amount),
      date: formatDateForInputLocal(transaction.date, timezone),
      description: transaction.description ?? ''
    },
    errors: {},
    mode,
    auth_req: auth_req,
    context: {
      category_id: category_id,
      from
    }
  })
}
