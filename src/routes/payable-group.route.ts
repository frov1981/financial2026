import { Router } from 'express'
import {
    apiForSavingPayableGroup,
    routeToFormDeletePayableGroup,
    routeToFormInsertPayableGroup,
    routeToFormUpdatePayableGroup
}
    from '../controllers/payable-group/payable-group.controller'

const router = Router()

/*Eventos de acción */
router.post('/', apiForSavingPayableGroup)

/*Eventos de enrutamiento */
router.get('/insert', routeToFormInsertPayableGroup)
router.get('/update/:id', routeToFormUpdatePayableGroup)
router.get('/delete/:id', routeToFormDeletePayableGroup)

export default router