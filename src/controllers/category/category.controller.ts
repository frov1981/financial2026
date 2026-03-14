import { Request, RequestHandler, Response } from 'express'
import { getCategoriesForApi, getCategoryById } from '../../cache/cache-categories.service'
import { categoryFormMatrix } from '../../policies/category-form.policy'
import { getActiveParentCategoriesByUser } from '../../services/populate-items.service'
import { AuthRequest } from '../../types/auth-request'
import { BaseFormViewParams } from '../../types/form-view-params'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'
export { saveCategory as apiForSavingCategory } from './category.saving'

type CategoryFormViewParams = BaseFormViewParams & {
  category: any
}

const renderCategoryForm = async (res: Response, params: CategoryFormViewParams) => {
  const { title, view, category, errors, mode, auth_req } = params
  const category_group_list = await getActiveParentCategoriesByUser(auth_req)
  const category_form_policy = categoryFormMatrix[mode]
  return res.render('layouts/main', {
    title,
    view,
    errors,
    mode,
    auth_req,
    category,
    category_form_policy,
    category_group_list,
  })
}

export const apiForGettingCategories: RequestHandler = async (req: Request, res: Response) => {
  logger.debug(`${apiForGettingCategories.name}-Start`)
  const auth_req = req as AuthRequest
  try {
    const categories = await getCategoriesForApi(auth_req)
    logger.debug(`${apiForGettingCategories.name}-CategoriesRetrieved. Count: ${categories.length}`)
    res.json(categories)
  } catch (error) {
    logger.error(`${apiForGettingCategories.name}-Error. `, parseError(error))
    res.status(500).json({ error: 'Error al listar categorías' })
  } finally {
    logger.debug(`${apiForGettingCategories.name}-End`)
  }
}

export const routeToPageCategory: RequestHandler = (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  res.render('layouts/main', {
    title: 'Categorías',
    view: 'pages/categories/index',
    USER_ID: auth_req.user?.id || 'guest'
  })
}

export const routeToFormInsertCategory: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  return renderCategoryForm(res, {
    title: 'Insertar Categoría',
    view: 'pages/categories/form',
    category: {
      type: null,
      type_for_loan: null,
      category_group: null,
      is_active: true
    },
    errors: {},
    mode,
    auth_req
  })
}

export const routeToFormUpdateCategory: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'update'
  const auth_req = req as AuthRequest
  const category_id = Number(req.params.id)
  const category = await getCategoryById(auth_req, category_id)
  if (!category) {
    return res.redirect('/categories')
  }
  return renderCategoryForm(res, {
    title: 'Editar Categoría',
    view: 'pages/categories/form',
    errors: {},
    mode,
    auth_req,
    category,
  })
}

export const routeToFormDeleteCategory: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'delete'
  const auth_req = req as AuthRequest
  const category_id = Number(req.params.id)
  const category = await getCategoryById(auth_req, category_id)
  if (!category) {
    return res.redirect('/categories')
  }
  return renderCategoryForm(res, {
    title: 'Eliminar Categoría',
    view: 'pages/categories/form',
    errors: {},
    mode,
    auth_req,
    category,
  })
}