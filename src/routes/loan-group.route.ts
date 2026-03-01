import { Router } from 'express'
import {
    apiForSavingLoanGroup,
    routeToFormDeleteLoanGroup,
    routeToFormInsertLoanGroup,
    routeToFormUpdateLoanGroup
}
    from '../controllers/loan-group/loan-group.controller'

const router = Router()

/*Eventos de acción */
router.post('/', apiForSavingLoanGroup)

/*Eventos de enrutamiento */
router.get('/insert', routeToFormInsertLoanGroup)
router.get('/update/:id', routeToFormUpdateLoanGroup)
router.get('/delete/:id', routeToFormDeleteLoanGroup)

export default router