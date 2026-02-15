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
router.get('/list/:loan_id/loan', apiForGettingPayments)
router.post('/', apiForSavingAccount)

/*Eventos de enrutamiento */
router.get('/:id/loan', routeToPagePayment)
router.get('/insert/:loan_id', routeToFormInsertPayment)
router.get('/update/:id', routeToFormUpdatePayment)
router.get('/clone/:id', routeToFormClonePayment)
router.get('/delete/:id', routeToFormDeletePayment)

export default router
