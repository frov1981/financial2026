import { Router } from 'express'
import {
    apiForSavingCategoryGroup,
    routeToFormDeleteCategoryGroup,
    routeToFormInsertCategoryGroup,
    routeToFormUpdateCategoryGroup
} from '../controllers/category-group/category-group.controller'

const router = Router()

/*Eventos de acción */
router.post('/', apiForSavingCategoryGroup)

/*Eventos de enrutamiento */
router.get('/insert', routeToFormInsertCategoryGroup)
router.get('/update/:id', routeToFormUpdateCategoryGroup)
router.get('/delete/:id', routeToFormDeleteCategoryGroup)

export default router