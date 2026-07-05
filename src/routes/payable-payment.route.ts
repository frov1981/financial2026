import { Router } from 'express'
import {
    apiForGettingPayablePayments,
    apiForSavingAccount,
    routeToFormClonePayablePayment,
    routeToFormDeletePayablePayment,
    routeToFormInsertPayablePayment,
    routeToFormUpdatePayablePayment,
    routeToPagePayablePayment
} from '../controllers/payable-payment/payable-payment.controller'

const router = Router()

/*Eventos de acción */
router.get('/list/:payable_id/payable', apiForGettingPayablePayments)
router.post('/', apiForSavingAccount)

/*Eventos de enrutamiento */
router.get('/:id/payable', routeToPagePayablePayment)
router.get('/insert/:payable_id', routeToFormInsertPayablePayment)
router.get('/update/:id', routeToFormUpdatePayablePayment)
router.get('/clone/:id', routeToFormClonePayablePayment)
router.get('/delete/:id', routeToFormDeletePayablePayment)

export default router
