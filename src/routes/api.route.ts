import { Router } from 'express'
import { listAccountsAPI, recalculateBalancesAPI } from '../controllers/account/account.controller'
import { listCategoriesAPI } from '../controllers/category/category.controller'
import { listLoansAPI } from '../controllers/loan/loan.controller'
import { listTransactionsPaginatedAPI } from '../controllers/transaction/transaction.controller'
import { listPaymentsAPI } from '../controllers/payment/payment.controller'

const router = Router()

router.get('/accounts', listAccountsAPI)
router.get('/categories', listCategoriesAPI)
router.get('/transactions', listTransactionsPaginatedAPI)
router.get('/loans', listLoansAPI)
router.get('/payments/:loanId', listPaymentsAPI)
router.post('/accounts/recalculate-balances', recalculateBalancesAPI)

export default router 
