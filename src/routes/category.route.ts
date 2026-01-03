import { Router } from 'express'
import { categoriesPage, insertCategoryFormPage, updateCategoryFormPage, updateCategoryStatusFormPage } from '../controllers/category.controller'
import { saveCategory } from '../controllers/category.controller.saving'

const router = Router()

router.get('/', categoriesPage)
router.get('/insert', insertCategoryFormPage)
router.get('/update/:id', updateCategoryFormPage)
router.get('/status/:id', updateCategoryStatusFormPage)
router.post('/', saveCategory)

export default router