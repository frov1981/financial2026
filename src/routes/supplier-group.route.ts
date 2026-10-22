import { Router } from 'express'
import {
  apiForGettingSupplierGroups,
  apiForSavingSupplierGroup,
  routeToFormDeleteSupplierGroup,
  routeToFormInsertSupplierGroup,
  routeToFormUpdateSupplierGroup
} from '../controllers/supplier-group/supplier-group.controller'

const router = Router()

router.get('/list', apiForGettingSupplierGroups)
router.post('/', apiForSavingSupplierGroup)
router.get('/insert', routeToFormInsertSupplierGroup)
router.get('/update/:id', routeToFormUpdateSupplierGroup)
router.get('/delete/:id', routeToFormDeleteSupplierGroup)

export default router
