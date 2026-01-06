import { Router } from 'express'
import {
  transactionsPage,
  insertTransactionFormPage,
  saveTransaction,
  updateTransactionFormPage,
  deleteTransactionFormPage
} from '../controllers/transaction/transaction.controller'

const router = Router()

router.get('/', transactionsPage)
router.get('/insert', insertTransactionFormPage)
router.get('/update/:id', updateTransactionFormPage)
router.get('/delete/:id', deleteTransactionFormPage)
router.post('/', saveTransaction)

export default router
