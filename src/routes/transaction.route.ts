import { Router } from 'express'
import {
  transactionsPage,
  insertTransactionFormPage,
  saveTransaction,
  updateTransactionFormPage
} from '../controllers/transaction.controller'

const router = Router()

router.get('/', transactionsPage)
router.get('/insert', insertTransactionFormPage)
router.get('/update/:id', updateTransactionFormPage)
router.post('/', saveTransaction)

export default router
