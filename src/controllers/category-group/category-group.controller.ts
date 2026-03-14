import { Request, RequestHandler, Response } from 'express'
import { getCategoryGroupById } from '../../cache/cache-category-group.service'
import { categoryGroupFormMatrix } from '../../policies/category-group-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { BaseFormViewParams } from '../../types/form-view-params'
export { saveCategoryGroup as apiForSavingCategoryGroup } from './category-group.saving'

type CategoryGroupFormViewParams = BaseFormViewParams & {
  category_group: any
}

const renderCategoryGroupForm = async (res: Response, params: CategoryGroupFormViewParams) => {
  const { title, view, category_group, errors, mode, auth_req } = params
  const category_group_form_policy = categoryGroupFormMatrix[mode]
  return res.render('layouts/main', {
    title,
    view,
    errors,
    mode,
    auth_req,
    category_group,
    category_group_form_policy,
  })
}

export const routeToFormInsertCategoryGroup: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  return renderCategoryGroupForm(res, {
    title: 'Insertar Grupo de Categoría',
    view: 'pages/category-groups/form',
    errors: {},
    mode,
    auth_req,
    category_group: {
      is_active: true
    },
  })
}

export const routeToFormUpdateCategoryGroup: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'update'
  const auth_req = req as AuthRequest
  const category_group_id = Number(req.params.id)
  const category_group = await getCategoryGroupById(auth_req, category_group_id)
  if (!category_group) {
    return res.redirect('/categories')
  }
  return renderCategoryGroupForm(res, {
    title: 'Editar Grupo de Categoría',
    view: 'pages/category-groups/form',
    errors: {},
    mode,
    auth_req,
    category_group,
  })
}

export const routeToFormDeleteCategoryGroup: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'delete'
  const auth_req = req as AuthRequest
  const category_group_id = Number(req.params.id)
  const category_group = await getCategoryGroupById(auth_req, category_group_id)
  if (!category_group) {
    return res.redirect('/categories')
  }
  return renderCategoryGroupForm(res, {
    title: 'Eliminar Grupo de Categoría',
    view: 'pages/category-groups/form',
    errors: {},
    mode,
    auth_req,
    category_group,
  })
}
