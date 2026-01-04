import { Router } from 'express'
import { listAccountsAPI, recalculateBalancesAPI } from '../controllers/account/account.controller'
import { listTransactionsPaginatedAPI } from '../controllers/transaction/transaction.controller'
import { listCategoriesAPI } from '../controllers/category/category.controller'

const router = Router()

router.get('/accounts', listAccountsAPI)
router.get('/categories', listCategoriesAPI)
router.get('/transactions', listTransactionsPaginatedAPI)
router.post('/accounts/recalculate-balances', recalculateBalancesAPI)

export default router 
