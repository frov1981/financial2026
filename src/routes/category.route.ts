import { Router } from 'express'
import {
    apiForGettingCategories,
    apiForSavingCatgory,
    routeToFormDeleteCategory,
    routeToFormInsertCategory,
    routeToFormUpdateCategory,
    routeToFormUpdateStatusCategory,
    routeToPageCategory
} from '../controllers/category/category.controller'

const router = Router()

/*Eventos de acción */
router.get('/list', apiForGettingCategories)
router.post('/', apiForSavingCatgory)

/*Eventos de enrutamiento */
router.get('/', routeToPageCategory)
router.get('/insert', routeToFormInsertCategory)
router.get('/update/:id', routeToFormUpdateCategory)
router.get('/delete/:id', routeToFormDeleteCategory)
router.get('/status/:id', routeToFormUpdateStatusCategory)


export default router