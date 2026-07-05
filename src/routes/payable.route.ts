import { Router } from "express"
import {
    apiForGettingPayables,
    apiForSavingPayable,
    routeToFormClonePayable,
    routeToFormDeletePayable,
    routeToFormInsertPayable,
    routeToFormUpdatePayable,
    routeToPagePayable
} from "../controllers/payable/payable.controller"
import { routeToPagePayablePayment } from "../controllers/payable-payment/payable-payment.controller"

const router = Router()

/*Eventos de acción */
router.get('/list', apiForGettingPayables)
router.post('/', apiForSavingPayable)

/*Eventos de enrutamiento */
router.get('/', routeToPagePayable)
router.get('/insert', routeToFormInsertPayable)
router.get('/update/:id', routeToFormUpdatePayable)
router.get('/clone/:id', routeToFormClonePayable)
router.get('/delete/:id', routeToFormDeletePayable)
router.get('/:id/payable', routeToPagePayablePayment)

export default router