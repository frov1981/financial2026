import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/datasource'
import { Account } from '../../entities/Account.entity'
import { Category } from '../../entities/Category.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/AuthRequest'
import { logger } from '../../utils/logger.util'
import { getNumberFromBody, getStringFromBody } from '../../utils/req.params.util'
import { getSqlErrorMessage } from '../../utils/sql.err.util'
import { calculateTransactionDeltas, getActiveAccountsByUser, getActiveCategoriesByUser, splitCategoriesByType } from './transaction.controller.auxiliar'
import { validateDeleteTransaction, validateSaveTransaction } from './transaction.controller.validator'
import { parseLocalDateToUTC } from '../../utils/date.util'

export const saveTransaction: RequestHandler = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest
  // Como viene desde un POST se busca en el body
  const transactionId = getNumberFromBody(req, 'id')
  const action = getStringFromBody(req, 'action') || 'save'
  const timezone = req.body.timezone || 'UTC'

  logger.info('Transactions data from req', req.body)

  const accounts = await getActiveAccountsByUser(authReq)
  const categories = await getActiveCategoriesByUser(authReq)
  const { incomeCategories, expenseCategories } = splitCategoriesByType(categories)

  const repo = AppDataSource.getRepository(Transaction)
  let tx: Transaction
  let mode
  let prevTx: Transaction | undefined

  const formState = {
    transaction: {
      ...req.body
    },
    mode: action === 'delete' ? 'delete' : transactionId ? 'update' : 'insert'
  }

  const queryRunner = AppDataSource.createQueryRunner()
  await queryRunner.connect()
  await queryRunner.startTransaction()

  try {
    if (action === 'save') {
      if (transactionId) {
        const existing = await repo.findOne({
          where: { id: transactionId, user: { id: authReq.user.id } },
          relations: { account: true, to_account: true, category: true }
        })
        if (!existing) throw new Error('Transacción no encontrada')

        mode = 'update'
        prevTx = Object.assign(new Transaction(), {
          type: existing.type,
          amount: existing.amount,
          account: existing.account,
          to_account: existing.to_account
        })

        existing.type = req.body.type
        if (req.body.account_id) { existing.account = { id: Number(req.body.account_id) } as Account }
        if (req.body.to_account_id) { existing.to_account = { id: Number(req.body.to_account_id) } as Account }
        if (req.body.category_id) { existing.category = { id: Number(req.body.category_id) } as Category }
        if (req.body.date) { existing.date = parseLocalDateToUTC(req.body.date, timezone) }
        existing.amount = Number(req.body.amount)
        existing.description = req.body.description

        tx = existing
      } else {
        mode = 'insert'

        tx = repo.create({
          user: authReq.user,
          type: req.body.type,
          account: req.body.account_id ? { id: Number(req.body.account_id) } : undefined,
          to_account: req.body.to_account_id ? { id: Number(req.body.to_account_id) } : undefined,
          category: req.body.category_id ? { id: Number(req.body.category_id) } : undefined,
          amount: Number(req.body.amount),
          date: req.body.date ? parseLocalDateToUTC(req.body.date, timezone) : undefined,
          description: req.body.description
        })
      }

      if (tx.type === 'transfer') {
        tx.category = null
      }

      const errors = await validateSaveTransaction(tx, authReq)
      if (errors) {
        const account = accounts.find(a => a.id === Number(req.body.account_id))
        const toAccount = accounts.find(a => a.id === Number(req.body.to_account_id))
        const category = categories.find(c => c.id === Number(req.body.category_id))

        return res.render(
          'layouts/main',
          {
            title: mode === 'insert' ? 'Insertar Transacción' : 'Editar Transacción',
            view: 'pages/transactions/form',
            transaction: {
              ...req.body,
              account_name: account?.name || '',
              to_account_name: toAccount?.name || '',
              category_name: category?.name || ''
            },
            errors,
            accounts,
            incomeCategories,
            expenseCategories,
            mode
          })
      }
      const deltas = new Map<number, number>()
      const mergeDeltas = (map: Map<number, number>) => {
        for (const [accId, value] of map) {
          const prev = deltas.get(accId) || 0
          deltas.set(accId, prev + value)
        }
      }

      if (prevTx) {
        mergeDeltas(calculateTransactionDeltas(prevTx, -1))
      }

      const savedTx = await queryRunner.manager.save(Transaction, tx)
      mergeDeltas(calculateTransactionDeltas(savedTx, 1))

      for (const [accId, delta] of deltas) {
        const acc = await queryRunner.manager.findOne(Account, { where: { id: accId } })
        if (!acc) continue
        await queryRunner.manager.update(Account, { id: accId }, {
          balance: Number(acc.balance) + delta
        })
      }

      await queryRunner.commitTransaction()
      await queryRunner.release()
      return res.redirect('/transactions')
    }

    if (action === 'delete') {
      mode = 'delete'
      if (!transactionId) throw new Error('ID de transacción no proporcionado')
      const existing = await repo.findOne({
        where: { id: transactionId, user: { id: authReq.user.id } },
        relations: { account: true, to_account: true, category: true }
      })

      if (!existing) throw new Error('Transacción no encontrada')

      const errors = await validateDeleteTransaction(existing, authReq)
      if (errors) {
        const account = accounts.find(a => a.id === Number(req.body.account_id))
        const toAccount = accounts.find(a => a.id === Number(req.body.to_account_id))
        const category = categories.find(c => c.id === Number(req.body.category_id))

        return res.render(
          'layouts/main',
          {
            title: mode === 'delete' ? 'Eliminar Transacción' : '',
            view: 'pages/transactions/form',
            transaction: {
              ...req.body,
              account_name: account?.name || '',
              to_account_name: toAccount?.name || '',
              category_name: category?.name || ''
            },
            errors,
            accounts,
            incomeCategories,
            expenseCategories,
            mode
          })
      }

      const deltas = calculateTransactionDeltas(existing, -1)
      for (const [accId, delta] of deltas) {
        const acc = await queryRunner.manager.findOne(Account, { where: { id: accId } })
        if (!acc) continue
        await queryRunner.manager.update(Account, { id: accId }, {
          balance: Number(acc.balance) + delta
        })
      }

      await queryRunner.manager.remove(Transaction, existing)
      await queryRunner.commitTransaction()
      await queryRunner.release()
      return res.redirect('/transactions')
    }

    return res.redirect('/transactions')
  } catch (err) {
    await queryRunner.rollbackTransaction()
    logger.error('Error saving transaction', err)

    return res.status(500).render('layouts/main', {
      title: 'Error',
      view: 'pages/transactions/form',
      ...formState,
      accounts,
      incomeCategories,
      expenseCategories,
      errors: { general: 'Ocurrió un error inesperado. Intenta nuevamente.\n' + getSqlErrorMessage(err) }
    })
  }
  finally {
    await queryRunner.release()
  }

}
