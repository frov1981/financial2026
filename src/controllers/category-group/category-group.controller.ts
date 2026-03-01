import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { categoryGroupFormMatrix } from '../../policies/category-group-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { CategoryGroup } from '../../entities/CategoryGroups.entity'
export { saveCategoryGroup as apiForSavingCategoryGroup } from './category-group.saving'

type CategoryGroupFormViewParams = {
  title: string
  view: string
  category_group: any
  errors: any
  mode: 'insert' | 'update' | 'delete'
  auth_req: AuthRequest
}

const renderCategoryGroupForm = async (res: Response, params: CategoryGroupFormViewParams) => {
  const { title, view, category_group, errors, mode, auth_req } = params
  const category_group_form_policy = categoryGroupFormMatrix[mode]
  return res.render('layouts/main', {
    title,
    view,
    category_group,
    errors,
    category_group_form_policy,
    mode
  })
}

export const routeToFormInsertCategoryGroup: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  return renderCategoryGroupForm(res, {
    title: 'Insertar Categoría',
    view: 'pages/category-groups/form',
    category_group: {
      is_active: true
    },
    errors: {},
    mode: 'insert',
    auth_req
  })
}

export const routeToFormUpdateCategoryGroup: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const category_group_id = Number(req.params.id)
  if (!Number.isInteger(category_group_id) || category_group_id <= 0) {
    return res.redirect('/categories')
  }
  const repo_category_group = AppDataSource.getRepository(CategoryGroup)
  const category_group = await repo_category_group.findOne({
    where: { id: category_group_id, user: { id: auth_req.user.id } },
  })
  if (!category_group) {
    return res.redirect('/categories')
  }
  return renderCategoryGroupForm(res, {
    title: 'Editar Categoría',
    view: 'pages/category-groups/form',
    category_group: {
      id: category_group.id,
      name: category_group.name,
      is_active: category_group.is_active,
    },
    errors: {},
    mode: 'update',
    auth_req
  })
}

export const routeToFormDeleteCategoryGroup: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const category_group_id = Number(req.params.id)
  if (!Number.isInteger(category_group_id) || category_group_id <= 0) {
    return res.redirect('/category-groups')
  }
  const repo_category_group = AppDataSource.getRepository(CategoryGroup)
  const category_group = await repo_category_group.findOne({
    where: { id: category_group_id, user: { id: auth_req.user.id } },
  })
  if (!category_group) {
    return res.redirect('/category-groups')
  }
  return renderCategoryGroupForm(res, {
    title: 'Eliminar Categoría',
    view: 'pages/category-groups/form',
    category_group: {
      id: category_group.id,
      name: category_group.name,
      is_active: category_group.is_active,
    },
    errors: {},
    mode: 'delete',
    auth_req
  })
}
