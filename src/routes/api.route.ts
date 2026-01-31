import { Router } from 'express'
import { recalculateBalancesAPI } from '../controllers/account/account.controller'
import { listTransactionsPaginatedAPI } from '../controllers/transaction/transaction.controller'
import { listPaymentsAPI } from '../controllers/payment/payment.controller'

const router = Router()

router.get('/transactions', listTransactionsPaginatedAPI)
router.get('/payments/:loanId', listPaymentsAPI)
router.post('/accounts/recalculate-balances', recalculateBalancesAPI)

export default router 
