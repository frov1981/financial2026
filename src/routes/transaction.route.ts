import { Router } from 'express'
import {
  transactionsPage,
  insertTransactionFormPage,
  saveTransaction,
  updateTransactionFormPage,
  deleteTransactionFormPage,
  cloneTransactionFormPage
} from '../controllers/transaction/transaction.controller'

const router = Router()

router.get('/', transactionsPage)
router.get('/insert', insertTransactionFormPage)
router.get('/update/:id', updateTransactionFormPage)
router.get('/clone/:id', cloneTransactionFormPage)
router.get('/delete/:id', deleteTransactionFormPage)
router.post('/', saveTransaction)

export default router 
