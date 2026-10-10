import { LOGGER_EVENTS } from '../../utils/logger-events'
import { Request, RequestHandler, Response } from 'express'
import { getCategoriesForApi, getCategoryById, getCategoryNameList } from '../../cache/cache-categories.service'
import type { DTOCategoriesResponse } from '../../dto/dto'
import { getActiveCategoryGroup } from '../../cache/cache-category-groups.service'
import { categoryFormMatrix } from '../../policies/category-form.policy'
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
  const category_group_list = await getActiveCategoryGroup(auth_req)
  const category_name_list = await getCategoryNameList(auth_req)
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
    category_name_list,
  })
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
    errors: {},
    mode,
    auth_req,
    category: {
      type: null,
      type_for_payable_or_receivable: null,
      category_group: null,
      is_active: true
    },
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

/*=================================================
Api para devolver el DTO Category en JSON
==================================================*/
export const apiForGettingCategories: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const apiForGettingCategories_logger = logger.forMethod(apiForGettingCategories.name, LOGGER_EVENTS.CATEGORY, auth_req.user.id)
  const started_at = performance.now()
  try {
    apiForGettingCategories_logger.debug('Obteniendo categorías para el usuario')
    const response: DTOCategoriesResponse = await getCategoriesForApi(auth_req)
    apiForGettingCategories_logger.info(`Categorías obtenidas desde: ${response.metadata.source}`, { number_of_rows: response.metadata.number_of_rows })
    res.json(response.categories)
  } catch (error) {
    apiForGettingCategories_logger.error('Error al listar categorías', parseError(error))
    res.status(500).json({ error: 'Error al listar categorías' })
  } finally {
    const ended_at = performance.now()
    const elapsed_ms = ended_at - started_at
    apiForGettingCategories_logger.elapsedTime('Elapsed time', { elapsed_ms })
    apiForGettingCategories_logger.debug('Fin de la operación de listado de categorías')
  }
}