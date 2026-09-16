import { Router } from "express"
import { apiForGettingReceivables, apiForSavingReceivable, routeToFormCloneReceivable, routeToFormDeleteReceivable, routeToFormInsertReceivable, routeToFormUpdateReceivable, routeToPageReceivable } from "../controllers/receivable/receivable.controller"

const router = Router()

/*Eventos de acción */
router.get('/list', apiForGettingReceivables)
router.post('/', apiForSavingReceivable)

/*Eventos de enrutamiento */
router.get('/', routeToPageReceivable)
router.get('/insert', routeToFormInsertReceivable)
router.get('/update/:id', routeToFormUpdateReceivable)
router.get('/clone/:id', routeToFormCloneReceivable)
router.get('/delete/:id', routeToFormDeleteReceivable)
router.get('/:id/payable', routeToPageReceivable)

export default router