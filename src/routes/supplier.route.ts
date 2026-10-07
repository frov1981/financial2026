import { Router } from 'express'
import {
  apiForGettingSuppliers,
  apiForSavingSupplier,
  routeToFormDeleteSupplier,
  routeToFormInsertSupplier,
  routeToFormUpdateSupplier,
  routeToPageSupplier
} from '../controllers/supplier/supplier.controller'

const router = Router()

router.get('/list', apiForGettingSuppliers)
router.post('/', apiForSavingSupplier)

router.get('/', routeToPageSupplier)
router.get('/insert', routeToFormInsertSupplier)
router.get('/update/:id', routeToFormUpdateSupplier)
router.get('/delete/:id', routeToFormDeleteSupplier)

export default router
