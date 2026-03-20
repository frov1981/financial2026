import { Request, RequestHandler, Response } from 'express'
import { DateTime } from 'luxon'
import { getAccountById, getActiveAccountById, getActiveAccounts, getActiveAccountsForTransfer } from '../../cache/cache-accounts.service'
import { getActiveCategories, getActiveCategoryById, getActiveExpenseCategories, getActiveIncomeCategories } from '../../cache/cache-categories.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Account } from '../../entities/Account.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { transactionFormMatrix, TransactionFormMode } from '../../policies/transaction-form.policy'
import { KpiCacheService } from '../../services/kpi-cache.service'
import { AuthRequest } from '../../types/auth-request'
import { parseLocalDateToUTC } from '../../utils/date.util'
import { logger } from '../../utils/logger.util'
import { getSqlErrorMessage } from '../../utils/sql-err.util'
import { calculateTransactionDeltas } from '../transaction/transaction.auxiliar'
import { validateDeleteTransaction, validateSaveTransaction } from '../transaction/transaction.validator'
import { deleteAll } from '../../cache/cache-key.service'

/* ============================
   Título según modo
============================ */
const getTitle = (mode: TransactionFormMode) => {
  switch (mode) {
    case 'insert': return 'Insertar Transacción'
    case 'update': return 'Editar Transacción'
    case 'delete': return 'Eliminar Transacción'
    case 'clone': return 'Clonar Transacción'
    default: return 'Indefinido'
  }
}

/* ============================
   Sanitizar payload según policy
============================ */
const sanitizeByPolicy = (mode: TransactionFormMode, body: any) => {
  const policy = transactionFormMatrix[mode]
  const clean: any = {}

  for (const field in policy) {
    if (policy[field] === 'edit' && body[field] !== undefined) {
      clean[field] = body[field]
    }
  }

  return clean
}

/* ============================
   Construir objeto para la vista
============================ */
const buildTransactionView = (body: any) => {
  return {
    ...body
  }
}

const isSavingAccount = (acc: Account | null | undefined): acc is Account & { type: 'saving' } => {
  return acc?.type === 'saving'
}

export const saveTransaction: RequestHandler = async (req: Request, res: Response) => {
  logger.debug(`${saveTransaction.name}-Start`)
  logger.info('saveTransaction called', { body: req.body, param: req.params })

  const auth_req = req as AuthRequest
  const user_id = auth_req.user.id
  const repo_transaction = AppDataSource.getRepository(Transaction)

  const transaction_id = req.body.id ? Number(req.body.id) : undefined
  const mode: TransactionFormMode = req.body.mode || 'insert'
  const timezone = req.body.timezone || 'UTC'
  logger.debug(`${saveTransaction.name}-Timezone for saving transaction: [${timezone}]`)
  const return_from = req.body.return_from
  const return_category_id = Number(req.body.return_category_id) || null

  /*const active_accounts = await getActiveAccountsByUser(auth_req)
  const active_accounts_for_transfer = await getActiveAccountsForTransferByUser(auth_req)*/
  const active_accounts = await getActiveAccounts(auth_req)
  const active_accounts_for_transfer = await getActiveAccountsForTransfer(auth_req)

  /*const active_categories = await getActiveCategoriesByUser(auth_req)
  const { active_income_categories, active_expense_categories } = splitCategoriesByType(active_categories)*/
  const active_categories = await getActiveCategories(auth_req)
  const active_income_categories = await getActiveIncomeCategories(auth_req)
  const active_expense_categories = await getActiveExpenseCategories(auth_req)

  const transaction_view = buildTransactionView(req.body)

  const form_state = {
    transaction: transaction_view,
    transaction_form_policy: transactionFormMatrix[mode],
    mode
  }

  const query_runner = AppDataSource.createQueryRunner()
  await query_runner.connect()
  await query_runner.startTransaction()

  try {
    let existing: Transaction | null = null

    if (transaction_id) {
      existing = await repo_transaction.findOne({
        where: { id: transaction_id, user: { id: auth_req.user.id } },
        relations: { account: true, to_account: true, category: true }
      })
      if (!existing) throw new Error('Transacción no encontrada')
    }

    /* ============================
       DELETE
    ============================ */
    if (mode === 'delete') {
      if (!existing) throw new Error('Transacción no encontrada')

      const errors = await validateDeleteTransaction(existing, auth_req)
      if (errors) throw { validationErrors: errors }

      const deltas = calculateTransactionDeltas(existing, -1)

      for (const [acc_id, delta] of deltas) {
        const acc = await query_runner.manager.findOne(Account, { where: { id: acc_id } })
        if (!acc) continue
        await query_runner.manager.update(Account, { id: acc_id }, {
          balance: Number(acc.balance) + delta
        })
      }

      const local_date = DateTime.fromJSDate(existing.date, { zone: 'utc' }).setZone(timezone)
      const period_year = local_date.year
      const period_month = local_date.month

      await query_runner.manager.remove(Transaction, existing)
      await query_runner.commitTransaction()

      deleteAll(auth_req, 'transaction')
      KpiCacheService.recalcMonthlyKPIs(user_id, period_year, period_month, timezone).catch(err => logger.error(`${saveTransaction.name}-Error. `, { err }))

      if (return_from === 'categories' && return_category_id) {
        return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
      }

      return res.redirect('/transactions')
    }

    /* ============================
       INSERT / UPDATE
    ============================ */
    let transaction: Transaction
    let previous_transaction: Transaction | undefined

    if (mode === 'insert') {
      transaction = repo_transaction.create({
        user: auth_req.user as any
      })
    } else {
      if (!existing) throw new Error('Transacción no encontrada')

      previous_transaction = Object.assign(new Transaction(), {
        type: existing.type,
        amount: existing.amount,
        account: existing.account,
        to_account: existing.to_account
      })

      transaction = existing
    }

    const clean = sanitizeByPolicy(mode, req.body)

    if (clean.type !== undefined) { transaction.type = clean.type }
    if (clean.account !== undefined) { transaction.account = await getAccountById(auth_req, Number(clean.account)) }
    if (clean.to_account !== undefined) { transaction.to_account = await getAccountById(auth_req, Number(clean.to_account)) }
    if (clean.category !== undefined) { transaction.category = await getActiveCategoryById(auth_req, Number(clean.category)) }
    if (clean.date) { transaction.date = parseLocalDateToUTC(clean.date, timezone) }
    if (clean.amount !== undefined) { transaction.amount = Number(clean.amount) }
    if (clean.description !== undefined) { transaction.description = clean.description }
    if (transaction.type === 'transfer') { transaction.category = null }
    if (transaction.type !== 'transfer') { transaction.to_account = null }

    // Clasificación KPI (flow_type)
    if (transaction.type === 'income') {
      transaction.flow_type = 'incomes'
    }

    if (transaction.type === 'expense') {
      transaction.flow_type = 'expenses'
    }

    if (transaction.type === 'transfer') {
      const from = transaction.account
      const to = transaction.to_account

      if (!from || !to) {
        transaction.flow_type = null
      } else if (isSavingAccount(to)) {
        transaction.flow_type = 'savings'
      } else if (isSavingAccount(from) && !isSavingAccount(to)) {
        transaction.flow_type = 'withdrawals'
      } else {
        transaction.flow_type = null
      }
    }

    const errors = await validateSaveTransaction(transaction, auth_req)
    if (errors) throw { validationErrors: errors }

    const deltas = new Map<number, number>()

    const mergeDeltas = (map: Map<number, number>) => {
      for (const [acc_id, value] of map) {
        const prev = deltas.get(acc_id) || 0
        deltas.set(acc_id, prev + value)
      }
    }

    if (previous_transaction) {
      mergeDeltas(calculateTransactionDeltas(previous_transaction, -1))
    }

    const saved_transaction = await query_runner.manager.save(Transaction, transaction)
    mergeDeltas(calculateTransactionDeltas(saved_transaction, 1))

    for (const [acc_id, delta] of deltas) {
      const acc = await query_runner.manager.findOne(Account, { where: { id: acc_id } })
      if (!acc) continue
      await query_runner.manager.update(Account, { id: acc_id }, {
        balance: Number(acc.balance) + delta
      })
    }
    const local_date = DateTime.fromJSDate(saved_transaction.date, { zone: 'utc' }).setZone(timezone)
    const period_year = local_date.year
    const period_month = local_date.month

    await query_runner.commitTransaction()

    deleteAll(auth_req, 'transaction')
    KpiCacheService.recalcMonthlyKPIs(user_id, period_year, period_month, timezone).catch(err => logger.error(`${saveTransaction.name}-Error. `, { err }))


    if (return_from === 'categories' && return_category_id) {
      return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
    }

    return res.redirect('/transactions')

  } catch (err: any) {
    await query_runner.rollbackTransaction()

    logger.error(`${saveTransaction.name}-Error. `, {
      user_id: auth_req.user.id,
      transaction_id,
      mode,
      error: err,
      stack: err?.stack
    })

    const validation_errors = err?.validationErrors || null

    return res.status(500).render('layouts/main', {
      title: getTitle(mode),
      view: 'pages/transactions/form',
      ...form_state,
      active_accounts_for_transfer,
      active_accounts,
      active_income_categories,
      active_expense_categories,
      context: {
        from: return_from || null,
        category_id: return_category_id || null
      },
      errors: validation_errors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.\n' + getSqlErrorMessage(err) }
    })
  } finally {
    await query_runner.release()
    logger.debug(`${saveTransaction.name}-End`)
  }
}
