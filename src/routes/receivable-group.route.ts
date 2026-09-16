import { Router } from 'express'
import { apiForSavingReceivableGroup, routeToFormDeleteReceivableGroup, routeToFormInsertReceivableGroup, routeToFormUpdateReceivableGroup } from '../controllers/receivable-group/receivable-group.controller'

const router = Router()

/*Eventos de acción */
router.post('/', apiForSavingReceivableGroup)

/*Eventos de enrutamiento */
router.get('/insert', routeToFormInsertReceivableGroup)
router.get('/update/:id', routeToFormUpdateReceivableGroup)
router.get('/delete/:id', routeToFormDeleteReceivableGroup)

export default router