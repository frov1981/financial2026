import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Account } from '../../entities/Account.entity'
import { Category } from '../../entities/Category.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { transactionFormMatrix, TransactionFormMode } from '../../policies/transaction-form.policy'
import { getActiveAccountsByUser, getActiveAccountsForTransferByUser, getActiveCategoriesByUser } from '../../services/populate-items.service'
import { AuthRequest } from '../../types/auth-request'
import { parseLocalDateToUTC } from '../../utils/date.util'
import { logger } from '../../utils/logger.util'
import { getSqlErrorMessage } from '../../utils/sql-err.util'
import { calculateTransactionDeltas, splitCategoriesByType } from '../transaction/transaction.auxiliar'
import { validateDeleteTransaction, validateSaveTransaction } from '../transaction/transaction.validator'

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

/* Obtiene una cuenta activa por id desde el arreglo ya cargado */
function getAccountFromActiveList(active_accounts: Account[], account_id: number | null): Account | null {
  if (!account_id) return null
  const account = active_accounts.find(a => a.id === account_id) || null
  return account
}

/* Obtiene una categoría activa por id desde el arreglo ya cargado */
function getCategoryFromActiveList(active_categories: Category[], category_id: number | null): Category | null {
  if (!category_id) return null
  const category = active_categories.find(c => c.id === category_id) || null
  return category
}

export const saveTransaction: RequestHandler = async (req: Request, res: Response) => {
  logger.debug(`${saveTransaction.name}-Start`)
  logger.info('saveTransaction called', { body: req.body, param: req.params })

  const auth_req = req as AuthRequest
  const repo_transaction = AppDataSource.getRepository(Transaction)

  const transaction_id = req.body.id ? Number(req.body.id) : undefined
  const mode: TransactionFormMode = req.body.mode || 'insert'
  const timezone = req.body.timezone || 'UTC'
  logger.debug(`${saveTransaction.name}-Timezone for saving transaction: [${timezone}]`)
  const return_from = req.body.return_from
  const return_category_id = Number(req.body.return_category_id) || null

  const active_accounts_for_transfer = await getActiveAccountsForTransferByUser(auth_req)
  const active_accounts = await getActiveAccountsByUser(auth_req)
  const active_categories = await getActiveCategoriesByUser(auth_req)
  const { active_income_categories, active_expense_categories } = splitCategoriesByType(active_categories)

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

      await query_runner.manager.remove(Transaction, existing)
      await query_runner.commitTransaction()
      await query_runner.release()

      if (return_from === 'categories' && return_category_id) {
        return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
      }

      return res.redirect('/transactions')
    }

    /* ============================
       INSERT / UPDATE
    ============================ */
    let tx: Transaction
    let prev_tx: Transaction | undefined

    if (mode === 'insert') {
      tx = repo_transaction.create({
        user: auth_req.user as any
      })
    } else {
      if (!existing) throw new Error('Transacción no encontrada')

      prev_tx = Object.assign(new Transaction(), {
        type: existing.type,
        amount: existing.amount,
        account: existing.account,
        to_account: existing.to_account
      })

      tx = existing
    }

    const clean = sanitizeByPolicy(mode, req.body)

    if (clean.type !== undefined) {
      tx.type = clean.type
    }

    if (clean.account !== undefined) {
      tx.account = getAccountFromActiveList(active_accounts, clean.account ? Number(clean.account) : null)
    }

    if (clean.to_account !== undefined) {
      tx.to_account = getAccountFromActiveList(active_accounts_for_transfer, clean.to_account ? Number(clean.to_account) : null)
    }

    if (clean.category !== undefined) {
      tx.category = getCategoryFromActiveList(active_categories, clean.category ? Number(clean.category) : null)
    }

    if (clean.date) {
      tx.date = parseLocalDateToUTC(clean.date, timezone)
    }

    if (clean.amount !== undefined) {
      tx.amount = Number(clean.amount)
    }

    if (clean.description !== undefined) {
      tx.description = clean.description
    }

    if (tx.type === 'transfer') {
      tx.category = null
    }

    if (tx.type !== 'transfer') {
      tx.to_account = null
    }

    const errors = await validateSaveTransaction(tx, auth_req)
    if (errors) throw { validationErrors: errors }

    const deltas = new Map<number, number>()

    const mergeDeltas = (map: Map<number, number>) => {
      for (const [acc_id, value] of map) {
        const prev = deltas.get(acc_id) || 0
        deltas.set(acc_id, prev + value)
      }
    }

    if (prev_tx) {
      mergeDeltas(calculateTransactionDeltas(prev_tx, -1))
    }

    const saved_tx = await query_runner.manager.save(Transaction, tx)
    mergeDeltas(calculateTransactionDeltas(saved_tx, 1))

    for (const [acc_id, delta] of deltas) {
      const acc = await query_runner.manager.findOne(Account, { where: { id: acc_id } })
      if (!acc) continue
      await query_runner.manager.update(Account, { id: acc_id }, {
        balance: Number(acc.balance) + delta
      })
    }

    await query_runner.commitTransaction()
    await query_runner.release()

    if (return_from === 'categories' && return_category_id) {
      return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
    }

    return res.redirect('/transactions')

  } catch (err: any) {
    await query_runner.rollbackTransaction()

    logger.error(`${saveTransaction.name}-Error. `, {
      userId: auth_req.user.id,
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
