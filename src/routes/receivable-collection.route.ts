import { Router } from 'express'
import { apiForGettingReceivableCollections, apiForSavingAccount, routeToFormCloneReceivableCollection, routeToFormDeleteReceivableCollection, routeToFormInsertReceivableCollection, routeToFormUpdateReceivableCollection, routeToPageReceivableCollection } from '../controllers/receivable-collection/receivable-collection.controller'

const router = Router()

/*Eventos de acción */
router.get('/list/:payable_id/payable', apiForGettingReceivableCollections)
router.post('/', apiForSavingAccount)

/*Eventos de enrutamiento */
router.get('/:id/payable', routeToPageReceivableCollection)
router.get('/insert/:payable_id', routeToFormInsertReceivableCollection)
router.get('/update/:id', routeToFormUpdateReceivableCollection)
router.get('/clone/:id', routeToFormCloneReceivableCollection)
router.get('/delete/:id', routeToFormDeleteReceivableCollection)

export default router
