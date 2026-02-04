import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Category } from '../../entities/Category.entity'
import { AuthRequest } from '../../types/auth-request'
import { logger } from '../../utils/logger.util'
import { getActiveParentCategoriesByUser } from './category.auxiliar'
import { categoryFormMatrix } from '../../policies/category-form.policy'
export { saveCategory as apiForSavingCatgory } from './category.saving'

export const apiForGettingCategories: RequestHandler = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest

  try {
    const repository = AppDataSource.getRepository(Category)

    const result = await repository
      .createQueryBuilder('category')
      .leftJoinAndSelect('category.parent', 'parent')
      .where('category.user_id = :userId', { userId: authReq.user.id })
      .addSelect(subQuery =>
        subQuery
          .select('COUNT(t.id)')
          .from('transactions', 't')
          .where('t.category_id = category.id'),
        'transactions_count'
      )
      .orderBy('parent.name', 'ASC')
      .addOrderBy('category.name', 'ASC')
      .getRawAndEntities()

    const categories = result.entities.map((category, index) => ({
      id: category.id,
      name: category.name,
      type: category.type,
      is_active: category.is_active,

      parent: category.parent
        ? {
          id: category.parent.id,
          name: category.parent.name,
        }
        : null,

      transactions_count: Number(result.raw[index].transactions_count)
    }))

    res.json(categories)
  } catch (error) {
    logger.error('Error al listar categorías', error)
    res.status(500).json({ error: 'Error al listar categorías' })
  }
}

export const routeToPageCategory: RequestHandler = (req: Request, res: Response) => {
  const authReq = req as AuthRequest

  res.render(
    'layouts/main',
    {
      title: 'Categorías',
      view: 'pages/categories/index',
      USER_ID: authReq.user?.id || 'guest'
    })
}


export const routeToFormInsertCategory: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'insert'
  const authReq = req as AuthRequest
  const parentCategories = await getActiveParentCategoriesByUser(authReq)
  const formPolicy = categoryFormMatrix[mode]['child']

  res.render(
    'layouts/main',
    {
      title: 'Insertar Categoría',
      view: 'pages/categories/form',
      category: {
        parent: null,
        type: null,
        is_active: true,
      },
      errors: {},
      formPolicy,
      parentCategories,
      mode,
    })
}

export const routeToFormUpdateCategory: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'update'
  const authReq = req as AuthRequest
  const categoryId = Number(req.params.id)

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return res.redirect('/categories')
  }

  const repoCategory = AppDataSource.getRepository(Category)
  const category = await repoCategory.findOne({
    where: { id: categoryId, user: { id: authReq.user.id } },
    relations: { parent: true }
  })

  if (!category) {
    return res.redirect('/categories')
  }

  const parentCategories = await getActiveParentCategoriesByUser(authReq)
  const is_parent = !category.parent
  const formPolicy = categoryFormMatrix[mode][is_parent ? 'parent' : 'child']
  res.render('layouts/main', {
    title: 'Editar Categoría',
    view: 'pages/categories/form',
    category: {
      id: category.id,
      name: category.name,
      type: category.type,
      is_active: category.is_active,
      parent: category.parent || null,
      is_parent: is_parent
    },
    errors: {},
    formPolicy,
    parentCategories,
    mode,
  })
}

export const routeToFormDeleteCategory: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'delete'
  const authReq = req as AuthRequest
  const categoryId = Number(req.params.id)

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return res.redirect('/categories')
  }

  const repoCategory = AppDataSource.getRepository(Category)
  const category = await repoCategory.findOne({
    where: { id: categoryId, user: { id: authReq.user.id } },
    relations: { parent: true }
  })

  if (!category) {
    return res.redirect('/categories')
  }

  const parentCategories = await getActiveParentCategoriesByUser(authReq)
  const is_parent = !category.parent
  const formPolicy = categoryFormMatrix[mode][is_parent ? 'parent' : 'child']
  res.render('layouts/main', {
    title: 'Eliminar Categoría',
    view: 'pages/categories/form',
    category: {
      id: category.id,
      name: category.name,
      type: category.type,
      is_active: category.is_active,
      parent: category.parent || null,
      is_parent: is_parent
    },
    errors: {},
    formPolicy,
    parentCategories,
    mode,
  })
}

export const routeToFormUpdateStatusCategory: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'status'
  const authReq = req as AuthRequest
  const categoryId = Number(req.params.id)

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return res.redirect('/categories')
  }

  const repoCategory = AppDataSource.getRepository(Category)
  const category = await repoCategory.findOne({
    where: { id: categoryId, user: { id: authReq.user.id } },
    relations: { parent: true }
  })

  if (!category) {
    return res.redirect('/categories')
  }

  const parentCategories = await getActiveParentCategoriesByUser(authReq)
  const is_parent = !category.parent
  const formPolicy = categoryFormMatrix[mode][is_parent ? 'parent' : 'child']
  res.render(
    'layouts/main',
    {
      title: 'Cambiar Estado de Categoría',
      view: 'pages/categories/form',
      category: {
        id: category.id,
        name: category.name,
        type: category.type,
        is_active: category.is_active,
        parent: category.parent || null,
        is_parent: is_parent
      },
      errors: {},
      formPolicy,
      parentCategories,
      mode
    })
}
