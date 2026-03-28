import { Request, RequestHandler, Response } from 'express'
import { getActiveAccounts, getActiveAccountsForTransfer, getActiveAccountsForTransferIncludeCurrentAccount, getActiveAccountsIncludeCurrentAccount } from '../../cache/cache-accounts.service'
import { getActiveCategoryById, getActiveExpenseCategories, getActiveExpenseCategoriesIncludeCurrentCategory, getActiveIncomeCategories, getActiveIncomeCategoriesIncludeCurrentCategory, getCategoryById } from '../../cache/cache-categories.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Transaction } from '../../entities/Transaction.entity'
import { transactionFormMatrix } from '../../policies/transaction-form.policy'
import { getNextValidTransactionDate } from '../../services/next-valid-trx-date.service'
import { AuthRequest } from '../../types/auth-request'
import { BaseFormViewParams } from '../../types/form-view-params'
import { formatDateForInputLocal } from '../../utils/date.util'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'
import { validateActiveCategoryTransaction } from './transaction.validator'
export { saveTransaction as apiForSavingTransaction } from './transaction.saving'

type TransactionFormViewParams = BaseFormViewParams & {
  transaction: any
}

const renderTransactionForm = async (res: Response, params: TransactionFormViewParams) => {
  const { title, view, transaction, errors, mode, auth_req } = params

  const transaction_form_policy = transactionFormMatrix[mode]
  const active_accounts = await getActiveAccountsIncludeCurrentAccount(auth_req, transaction?.account?.id)
  const active_accounts_for_transfer = await getActiveAccountsForTransferIncludeCurrentAccount(auth_req, transaction?.account?.id)
  const active_income_categories = await getActiveIncomeCategoriesIncludeCurrentCategory(auth_req, transaction?.category?.id)
  const active_expense_categories = await getActiveExpenseCategoriesIncludeCurrentCategory(auth_req, transaction?.category?.id)

  const category_id = auth_req.query.category_id || null
  const from = auth_req.query.from || null

  return res.render(
    'layouts/main',
    {
      title,
      view,
      errors,
      mode,
      auth_req,
      transaction,
      transaction_form_policy,
      active_accounts,
      active_accounts_for_transfer,
      active_income_categories,
      active_expense_categories,
      context: { category_id, from },
    }
  )
}

export const apiForGettingTransactions: RequestHandler = async (req: Request, res: Response) => {
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
      .leftJoinAndSelect('loan_payment.loan', 'paymentLoan')
      .leftJoinAndSelect('paymentLoan.category', 'paymentLoanCategory')
      .where('t.user_id = :user_id', { user_id })

    if (category_id) {
      qb.andWhere('category.id = :category_id', { category_id })
    }

    if (search) {
      qb.andWhere(
        `(
          t.type LIKE :search OR
          account.name LIKE :search OR
          to_account.name LIKE :search OR
          category.name LIKE :search OR
          t.description LIKE :search 
        )`,
        { search: `%${search.toLowerCase()}%` }
      )
    }

    const [items, total] = await qb
      .orderBy('t.date', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount()

    res.json({ items, total, page, limit, category_id: category_id })
  } catch (error) {
    logger.error(`${apiForGettingTransactions.name}-Error. `, parseError(error))
    res.status(500).json({ error: 'Error al listar transacciones' })
  } finally {
  }
}

export const routeToPageTransaction: RequestHandler = (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const category_id = req.query.category_id || null
  const from = req.query.from || null
  const saved_batch = req.query.saved_batch === 'true'
  const timezone = auth_req.timezone || 'UTC'
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
  const timezone = auth_req.timezone || 'UTC'

  const default_date = await getNextValidTransactionDate(auth_req)
  return renderTransactionForm(res, {
    title: 'Insertar Transacción',
    view: 'pages/transactions/form',
    errors: {},
    mode,
    auth_req,
    transaction: {
      date: formatDateForInputLocal(default_date, timezone),
      amount: '0.00',
    },
  })
}

export const routeToFormUpdateTransaction: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'update'
  const auth_req = req as AuthRequest
  const transaction_id = Number(req.params.id)
  const timezone = auth_req.timezone || 'UTC'
  const repo_transaction = AppDataSource.getRepository(Transaction)
  const transaction = await repo_transaction.findOne({
    where: { id: transaction_id, user: { id: auth_req.user.id } },
    relations: { account: true, to_account: true, category: true }
  })
  if (!transaction) {
    return res.redirect('/transactions')
  }
  return renderTransactionForm(res, {
    title: 'Editar Transacción',
    view: 'pages/transactions/form',
    errors: {},
    mode,
    auth_req,
    transaction: {
      ...transaction,
      date: formatDateForInputLocal(transaction.date, timezone),
    },
  })
}

export const routeToFormCloneTransaction: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  const transaction_id = Number(req.params.id)
  const timezone = auth_req.timezone || 'UTC'
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
  return renderTransactionForm(res, {
    title: 'Insertar Transacción',
    view: 'pages/transactions/form',
    errors,
    mode,
    auth_req,
    transaction: {
      ...transaction,
      date: formatDateForInputLocal(default_date, timezone),
      description: transaction.description ?? ''
    },
  })
}

export const routeToFormDeleteTransaction: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'delete'
  const auth_req = req as AuthRequest
  const transaction_id = Number(req.params.id)
  const timezone = auth_req.timezone || 'UTC'
  const repo_transaction = AppDataSource.getRepository(Transaction)
  const transaction = await repo_transaction.findOne({
    where: { id: transaction_id, user: { id: auth_req.user.id } },
    relations: { account: true, to_account: true, category: true }
  })
  if (!transaction) {
    return res.redirect('/transactions')
  }
  return renderTransactionForm(res, {
    title: 'Eliminar Transacción',
    view: 'pages/transactions/form',
    errors: {},
    mode,
    auth_req: auth_req,
    transaction: {
      ...transaction,
      date: formatDateForInputLocal(transaction.date, timezone),
    },
  })
}
