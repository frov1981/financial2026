import { Router } from 'express'
import {
    apiForGettingPayments,
    apiForSavingAccount,
    routeToFormClonePayment,
    routeToFormDeletePayment,
    routeToFormInsertPayment,
    routeToFormUpdatePayment,
    routeToPagePayment
} from '../controllers/payment/payment.controller'

const router = Router()

/*Eventos de acción */
router.get('/list/:loanId/loan', apiForGettingPayments)
router.post('/', apiForSavingAccount)

/*Eventos de enrutamiento */
router.get('/:id/loan', routeToPagePayment)
router.get('/insert/:loanId', routeToFormInsertPayment)
router.get('/update/:id', routeToFormUpdatePayment)
router.get('/clone/:id', routeToFormClonePayment)
router.get('/delete/:id', routeToFormDeletePayment)

export default router
