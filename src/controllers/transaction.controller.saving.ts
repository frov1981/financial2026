import { RequestHandler } from 'express'
import { AppDataSource } from '../config/datasource'
import { Account } from '../entities/Account.entity'
import { Category } from '../entities/Category.entity'
import { Transaction } from '../entities/Transaction.entity'
import { AuthRequest } from '../types/AuthRequest'
import { logger } from '../utils/logger.util'
import { getActiveAccountsByUser, getActiveCategoriesByUser, splitCategoriesByType } from './transaction.controller.auxiliar'
import { validateTransaction } from './transaction.controller.validator'

export const saveTransaction: RequestHandler = async (req, res) => {
  const authReq = req as AuthRequest
  const repo = AppDataSource.getRepository(Transaction)
  const txId = req.body.id ? Number(req.body.id) : req.params.id ? Number(req.params.id) : undefined

  const accounts = await getActiveAccountsByUser(authReq)
  const categories = await getActiveCategoriesByUser(authReq)

  const { incomeCategories, expenseCategories } = splitCategoriesByType(categories)

  let tx: Transaction
  let mode
  let prevType: string | undefined
  let prevAmount: number | undefined
  let prevAccountId: number | undefined
  let prevToAccountId: number | undefined

  if (txId) {
    mode = 'update'

    const existing = await repo.findOne({ where: { id: txId, user: { id: authReq.user.id } }, relations: ['account', 'to_account'] })
    if (!existing) return res.redirect('/transactions')

    // guardar valores previos para ajustar balances en caso de actualización
    prevType = existing.type
    prevAmount = Number(existing.amount)
    prevAccountId = existing.account?.id
    prevToAccountId = existing.to_account?.id

    existing.type = req.body.type
    if (req.body.account_id) { existing.account = { id: Number(req.body.account_id) } as Account }
    if (req.body.to_account_id) { existing.to_account = { id: Number(req.body.to_account_id) } as Account }
    if (req.body.category_id) { existing.category = { id: Number(req.body.category_id) } as Category }
    if (req.body.date) { existing.date = new Date(req.body.date) }
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
      date: req.body.date ? new Date(req.body.date) : undefined,
      description: req.body.description
    })
  }

  /*Si es transferencia no debe enviar categoria*/
  if (tx.type === 'transfer') {
    tx.category = null
  }

  logger.info(`Before transaction for user ${authReq.user.id}: mode: ${mode}`)
  const errors = await validateTransaction(tx, authReq)

  if (errors) {
    const account = accounts.find(a => a.id === Number(req.body.account_id))
    const toAccount = accounts.find(a => a.id === Number(req.body.to_account_id))
    const category = categories.find(c => c.id === Number(req.body.category_id))

    return res.render('layouts/main', {
      title: mode === 'update' ? 'Editar Transacción' : 'Nueva Transacción',
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

  // Persistir transacción y ajustar balances dentro de una transacción DB
  const queryRunner = AppDataSource.createQueryRunner()
  await queryRunner.connect()
  await queryRunner.startTransaction()

  try {
    // Calcular deltas por cuenta: nuevo efecto - efecto previo
    const deltas = new Map<number, number>()

    const addDelta = (accId?: number, value?: number) => {
      if (!accId || !value) return
      const prev = deltas.get(accId) || 0
      deltas.set(accId, prev + value)
    }

    if (mode === 'update') {
      const pAmt = prevAmount ?? 0

      // efectos previos
      if (prevType === 'income' && prevAccountId) addDelta(prevAccountId, -pAmt)
      if (prevType === 'expense' && prevAccountId) addDelta(prevAccountId, +pAmt)
      if (prevType === 'transfer') {
        if (prevAccountId) addDelta(prevAccountId, +pAmt)
        if (prevToAccountId) addDelta(prevToAccountId, -pAmt)
      }
    }

    // Guardar la transacción (insert/update)
    const savedTx = await queryRunner.manager.save(Transaction, tx)

    // efectos nuevos
    const amt = Number(savedTx.amount)
    if (savedTx.type === 'income' && savedTx.account?.id) addDelta(savedTx.account.id, +amt)
    if (savedTx.type === 'expense' && savedTx.account?.id) addDelta(savedTx.account.id, -amt)
    if (savedTx.type === 'transfer') {
      if (savedTx.account?.id) addDelta(savedTx.account.id, -amt)
      if (savedTx.to_account?.id) addDelta(savedTx.to_account.id, +amt)
    }

    // Aplicar todos los deltas calculados
    for (const [accId, delta] of deltas) {
      const acc = await queryRunner.manager.findOne(Account, { where: { id: accId } })
      if (!acc) continue
      const newBalance = Number(acc.balance) + delta
      await queryRunner.manager.update(Account, { id: accId }, { balance: newBalance })
    }

    await queryRunner.commitTransaction()
    logger.info(`Transaction data is valid for user ${authReq.user.id}, saved and balances updated.`)
    await queryRunner.release()

    return res.redirect('/transactions')
  } catch (error) {
    await queryRunner.rollbackTransaction()
    await queryRunner.release()
    logger.error('Error saving transaction and updating balances', error)
    return res.status(500).render('layouts/main', {
      title: '',
      view: 'pages/transactions/form',
      transaction: { ...req.body },
      errors: { _form: 'Error al guardar transacción' },
      accounts,
      incomeCategories,
      expenseCategories,
      mode
    })
  }
}
