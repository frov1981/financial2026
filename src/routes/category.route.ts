import { Router } from 'express'
import {
    apiForGettingCategories,
    apiForSavingCategory,
    routeToFormDeleteCategory,
    routeToFormInsertCategory,
    routeToFormUpdateCategory,
    routeToPageCategory
} from '../controllers/category/category.controller'

const router = Router()

/*Eventos de acción */
router.get('/list', apiForGettingCategories)
router.post('/', apiForSavingCategory)

/*Eventos de enrutamiento */
router.get('/', routeToPageCategory)
router.get('/insert', routeToFormInsertCategory)
router.get('/update/:id', routeToFormUpdateCategory)
router.get('/delete/:id', routeToFormDeleteCategory)

export default router