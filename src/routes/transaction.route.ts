import { Router } from 'express'
import {
  apiForBatchCategorize,
  apiForGettingCategorizeTransactions
} from '../controllers/transaction/batch-categorize.controller'
import {
  apiForGettingTransactions,
  apiForSavingTransaction,
  routeToFormCloneTransaction,
  routeToFormDeleteTransaction,
  routeToFormInsertTransaction,
  routeToFormUpdateTransaction,
  routeToPageTransaction
} from '../controllers/transaction/transaction.controller'

const router = Router()

/*Eventos de acción */
router.post('/', apiForSavingTransaction)
router.get('/list', apiForGettingTransactions)
router.get('/batch-categorize', apiForGettingCategorizeTransactions)

/*Eventos de enrutamiento */
router.get('/', routeToPageTransaction)
router.get('/insert', routeToFormInsertTransaction)
router.get('/update/:id', routeToFormUpdateTransaction)
router.get('/clone/:id', routeToFormCloneTransaction)
router.get('/delete/:id', routeToFormDeleteTransaction)
router.post('/batch-categorize', apiForBatchCategorize)

export default router 
