import { Router } from 'express'
import { listAccountsAPI, recalculateBalancesAPI } from '../controllers/account.controller'
import { listTransactionsPaginatedAPI } from '../controllers/transaction.controller'
import { listCategoriesAPI } from '../controllers/category.controller'

const router = Router()

router.get('/accounts', listAccountsAPI)
router.get('/categories', listCategoriesAPI)
router.get('/transactions', listTransactionsPaginatedAPI)
router.post('/accounts/recalculate-balances', recalculateBalancesAPI)

export default router 
