import { Request, RequestHandler, Response } from 'express';
import { DateTime } from 'luxon';
import { performance } from 'perf_hooks';
import { getAccountById, getActiveAccounts, getActiveAccountsForTransfer } from '../../cache/cache-accounts.service';
import { getActiveExpenseCategories, getActiveIncomeCategories, getCategoryById } from '../../cache/cache-categories.service';
import { deleteAll } from '../../cache/cache-key.service';
import { AppDataSource } from '../../config/typeorm.datasource';
import { Account } from '../../entities/Account.entity';
import { Transaction } from '../../entities/Transaction.entity';
import { KpiCacheService } from '../../services/kpi-cache.service';
import { AuthRequest } from '../../types/auth-request';
import { parseLocalDateToUTC } from '../../utils/date.util';
import { parseError } from '../../utils/error.util';
import { logger } from '../../utils/logger.util';
import { getSqlErrorMessage } from '../../utils/sql-err.util';
import { calculateTransactionDeltas } from '../transaction/transaction.auxiliar';
import { validateDeleteTransaction, validateSaveTransaction } from '../transaction/transaction.validator';
import { TransactionFormMode } from '../../types/form-view-params';
import { transactionFormMatrix } from '../../policies/transaction-form.policy';

/* ============================
   Título según modo
============================ */
const getTitle = (mode: TransactionFormMode) => {
  switch (mode) {
    case 'insert': return 'Insertar Transacción'
    case 'update': return 'Editar Transacción'
    case 'delete': return 'Eliminar Transacción'
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
    if ((policy[field] === 'editable' || policy[field] === 'readonly') && body[field] !== undefined) {
      clean[field] = body[field]
    }
  }
  return clean
}

/* ============================
   Construir objeto para la vista
============================ */
const buildTransactionView = (auth_req: AuthRequest, body: any) => {
  return {
    ...body
  }
}

const isSavingAccount = (acc: Account | null | undefined): acc is Account & { type: 'saving' } => {
  return acc?.type === 'saving'
}

export const saveTransaction: RequestHandler = async (req: Request, res: Response) => {
  const start = performance.now()
  logger.info(`${saveTransaction.name} called`, { body: req.body, param: req.params })
  const auth_req = req as AuthRequest
  const user_id = auth_req.user.id
  const timezone = req.body.timezone || 'UTC'
  const mode: TransactionFormMode = req.body.mode || 'insert'
  const transaction_id = Number(req.body.id)
  const return_from = req.body.return_from
  const return_category_id = Number(req.body.return_category_id) || null


  const active_accounts = await getActiveAccounts(auth_req)
  const active_accounts_for_transfer = await getActiveAccountsForTransfer(auth_req)
  const active_income_categories = await getActiveIncomeCategories(auth_req)
  const active_expense_categories = await getActiveExpenseCategories(auth_req)

  const form_state = {
    transaction: buildTransactionView(auth_req, req.body),
    transaction_form_policy: transactionFormMatrix[mode],
    active_accounts,
    active_accounts_for_transfer,
    active_income_categories,
    active_expense_categories,
    mode,
    context: { from: return_from, category_id: return_category_id }
  }

  const query_runner = AppDataSource.createQueryRunner()
  await query_runner.connect()
  await query_runner.startTransaction()
  const repo_transaction = AppDataSource.getRepository(Transaction)

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

      await query_runner.manager.remove(Transaction, existing)
      await query_runner.commitTransaction()
      deleteAll(auth_req, 'transaction')

      KpiCacheService
        .recalcKPIsByTransaction(auth_req, existing)
        .catch(error => logger.error(`${saveTransaction.name}-Error. `, parseError(error)))

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
        to_account: existing.to_account,
        category: existing.category
      })
      transaction = existing
    }
    /*=================================
      Aplicar sanitización por policy
    =================================*/
    const clean = sanitizeByPolicy(mode, req.body)
    if (clean.type !== undefined) { transaction.type = clean.type }
    if (clean.account !== undefined) { transaction.account = await getAccountById(auth_req, Number(clean.account)) }
    if (clean.to_account !== undefined) { transaction.to_account = await getAccountById(auth_req, Number(clean.to_account)) }
    if (clean.category !== undefined) { transaction.category = await getCategoryById(auth_req, Number(clean.category)) }
    if (clean.date) { transaction.date = parseLocalDateToUTC(clean.date, timezone) }
    if (clean.amount !== undefined) { transaction.amount = Number(clean.amount) }
    if (clean.description !== undefined) { transaction.description = clean.description }
    if (transaction.type === 'transfer') { transaction.category = null }
    if (transaction.type !== 'transfer') { transaction.to_account = null }

    const errors = await validateSaveTransaction(transaction, auth_req, previous_transaction)
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

    /*=================================
      Guardar en base de datos y limpiar cache
    =================================*/
    await query_runner.commitTransaction()
    deleteAll(auth_req, 'transaction')

    KpiCacheService
      .recalcKPIsByTransaction(auth_req, saved_transaction)
      .catch(error => logger.error(`${saveTransaction.name}-Error. `, parseError(error)))

    if (return_from === 'categories' && return_category_id) {
      return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
    }
    return res.redirect('/transactions')

  } catch (error: any) {
    /* ============================
       Manejo de errores
    ============================ */
    await query_runner.rollbackTransaction()
    logger.error(`${saveTransaction.name}-Error. `, { user_id: auth_req.user.id, transaction_id, mode, error: parseError(error), })

    const validation_errors = error?.validationErrors || null
    return res.status(500).render('layouts/main', {
      title: getTitle(mode),
      view: 'pages/transactions/form',
      ...form_state,
      active_accounts_for_transfer,
      active_accounts,
      active_income_categories,
      active_expense_categories,
      context: { from: return_from, category_id: return_category_id },
      errors: validation_errors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.\n' + getSqlErrorMessage(error) }
    })
  } finally {
    await query_runner.release()
    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`${saveTransaction.name}. user=[${user_id}], elapsedTime=[${duration_sec.toFixed(4)}]`)
  }
}
