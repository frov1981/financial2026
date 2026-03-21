import { Router } from "express"
import {
    apiForGettingLoans,
    apiForSavingLoan,
    routeToFormCloneLoan,
    routeToFormDeleteLoan,
    routeToFormInsertLoan,
    routeToFormUpdateLoan,
    routeToPageLoan
} from "../controllers/loan/loan.controller"
import { routeToPagePayment } from "../controllers/payment/payment.controller"

const router = Router()

/*Eventos de acción */
router.get('/list', apiForGettingLoans) 
router.post('/', apiForSavingLoan)

/*Eventos de enrutamiento */
router.get('/', routeToPageLoan)
router.get('/insert', routeToFormInsertLoan)
router.get('/update/:id', routeToFormUpdateLoan)
router.get('/clone/:id', routeToFormCloneLoan)
router.get('/delete/:id', routeToFormDeleteLoan)
router.get('/:id/loan', routeToPagePayment)

export default router