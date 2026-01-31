import { Router } from 'express'
import {
    apiForGettingAccounts,
    apiForSavingAccount,
    routeToFormDeleteAccount,
    routeToFormInsertAccount,
    routeToFormUpdateAccount,
    routeToFormUpdateStatusAccount,
    routeToPageAccount
} from '../controllers/account/account.controller'

const router = Router()

/*Eventos de acción */
router.get('/list', apiForGettingAccounts)
router.post('/', apiForSavingAccount)

/*Eventos de enrutamiento */
router.get('/', routeToPageAccount)
router.get('/insert', routeToFormInsertAccount)
router.get('/update/:id', routeToFormUpdateAccount)
router.get('/delete/:id', routeToFormDeleteAccount)
router.get('/status/:id', routeToFormUpdateStatusAccount)


export default router
