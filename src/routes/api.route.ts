import { Router } from 'express'
import { listTransactionsPaginatedAPI } from '../controllers/transaction/transaction.controller'

const router = Router()

router.get('/transactions', listTransactionsPaginatedAPI)

export default router 
