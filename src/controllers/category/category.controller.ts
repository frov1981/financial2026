import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Category } from '../../entities/Category.entity'
import { categoryFormMatrix } from '../../policies/category-form.policy'
import { getActiveParentCategoriesByUser } from '../../services/populate-items.service'
import { AuthRequest } from '../../types/auth-request'
import { logger } from '../../utils/logger.util'
import { BaseFormViewParams } from '../../types/form-view-params'
export { saveCategory as apiForSavingCategory } from './category.saving'

type CategoryFormViewParams = BaseFormViewParams & {
  category: any
}

const renderCategoryForm = async (res: Response, params: CategoryFormViewParams) => {
  const { title, view, category, errors, mode, auth_req } = params
  const category_group_list = await getActiveParentCategoriesByUser(auth_req)
  const category_form_policy = categoryFormMatrix[mode]
  return res.render('layouts/main', {
    mode,
    title,
    view,
    category,
    errors,
    category_form_policy,
    category_group_list,
  })
}

export const apiForGettingCategories: RequestHandler = async (req: Request, res: Response) => {
  logger.debug(`${apiForGettingCategories.name}-Start`)
  const auth_req = req as AuthRequest

  try {
    const repository = AppDataSource.getRepository(Category)

    const result = await repository
      .createQueryBuilder('category')
      .innerJoin('category.user', 'user')
      .innerJoinAndSelect('category.category_group', 'group')
      .where('user.id = :user_id', { user_id: auth_req.user.id })
      .addSelect(subQuery =>
        subQuery
          .select('COUNT(t.id)')
          .from('transactions', 't')
          .where('t.category_id = category.id'),
        'transactions_count'
      )
      .orderBy('group.name', 'ASC')
      .addOrderBy('category.name', 'ASC')
      .getRawAndEntities()

    const categories = result.entities.map((category, index) => ({
      id: category.id,
      name: category.name,
      type: category.type,
      type_for_loan: category.type_for_loan,
      is_active: category.is_active,
      category_group: category.category_group ? { id: category.category_group.id, name: category.category_group.name } : null,
      transactions_count: Number(result.raw[index].transactions_count)
    }))

    res.json(categories)
  } catch (error) {
    logger.error(`${apiForGettingCategories.name}-Error. `, error)
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
  if (!Number.isInteger(category_id) || category_id <= 0) {
    return res.redirect('/categories')
  }
  const repo_category = AppDataSource.getRepository(Category)
  const category = await repo_category.findOne({
    where: { id: category_id, user: { id: auth_req.user.id } },
    relations: { category_group: true }
  })
  if (!category) {
    return res.redirect('/categories')
  }
  return renderCategoryForm(res, {
    title: 'Editar Categoría',
    view: 'pages/categories/form',
    category: {
      id: category.id,
      name: category.name,
      type: category.type,
      type_for_loan: category.type_for_loan,
      is_active: category.is_active,
      category_group: category.category_group,
    },
    errors: {},
    mode,
    auth_req
  })
}

export const routeToFormDeleteCategory: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'delete'
  const auth_req = req as AuthRequest
  const category_id = Number(req.params.id)
  if (!Number.isInteger(category_id) || category_id <= 0) {
    return res.redirect('/categories')
  }
  const repo_category = AppDataSource.getRepository(Category)
  const category = await repo_category.findOne({
    where: { id: category_id, user: { id: auth_req.user.id } },
    relations: { category_group: true }
  })
  if (!category) {
    return res.redirect('/categories')
  }
  return renderCategoryForm(res, {
    title: 'Eliminar Categoría',
    view: 'pages/categories/form',
    category: {
      id: category.id,
      name: category.name,
      type: category.type,
      type_for_loan: category.type_for_loan,
      is_active: category.is_active,
      category_group: category.category_group,
    },
    errors: {},
    mode,
    auth_req
  })
}

export const routeToFormUpdateStatusCategory: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'update'
  const auth_req = req as AuthRequest
  const category_id = Number(req.params.id)
  if (!Number.isInteger(category_id) || category_id <= 0) {
    return res.redirect('/categories')
  }
  const repo_category = AppDataSource.getRepository(Category)
  const category = await repo_category.findOne({
    where: { id: category_id, user: { id: auth_req.user.id } },
    relations: { category_group: true }
  })
  if (!category) {
    return res.redirect('/categories')
  }
  return renderCategoryForm(res, {
    title: 'Cambiar Estado de Categoría',
    view: 'pages/categories/form',
    category: {
      id: category.id,
      name: category.name,
      type: category.type,
      is_active: category.is_active,
      category_group: category.category_group,
    },
    errors: {},
    mode,
    auth_req
  })
}
