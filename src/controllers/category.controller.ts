// controllers/category.controller.ts
import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../config/datasource'
import { Category } from '../entities/Category.entity'
import { AuthRequest } from '../types/AuthRequest'
import { logger } from '../utils/logger.util'

export const listCategoriesAPI: RequestHandler = async (req: Request, res: Response) => {
  const authReq = req as AuthRequest

  try {
    const categories = await AppDataSource.getRepository(Category).find({
      where: { user: { id: authReq.user.id } },
      order: { name: 'ASC' }
    })

    res.json(categories)
  } catch (error) {
    logger.error('Error al listar categorías', error)
    res.status(500).json({ error: 'Error al listar categorías' })
  }
}

export const insertCategoryFormPage: RequestHandler = async (req, res) => {
  const mode = 'insert'

  res.render('layouts/main', {
    title: 'Nueva Categoría',
    view: 'pages/categories/form',
    category: {},
    errors: {},
    mode
  })
}

export const updateCategoryFormPage: RequestHandler = async (req, res) => {
  const authReq = req as AuthRequest
  const categoryId = Number(req.params.id)
  const mode = 'update'

  const repo = AppDataSource.getRepository(Category)

  const category = await repo.findOne({
    where: { id: categoryId, user: { id: authReq.user.id } }
  })

  if (!category) {
    return res.redirect('/categories')
  }

  res.render('layouts/main', {
    title: 'Editar Categoría',
    view: 'pages/categories/form',
    category: {
      id: category.id,
      name: category.name,
      type: category.type
    },
    errors: {},
    mode
  })
}

export const updateCategoryStatusFormPage: RequestHandler = async (req, res) => {
  const authReq = req as AuthRequest
  const categoryId = Number(req.params.id)
  const mode = 'status'

  const repo = AppDataSource.getRepository(Category)

  const category = await repo.findOne({
    where: { id: categoryId, user: { id: authReq.user.id } }
  })

  if (!category) {
    return res.redirect('/categories')
  }

  res.render('layouts/main', {
    title: 'Editar Estado Categoría',
    view: 'pages/categories/form',
    category: {
      id: category.id,
      name: category.name,
      type: category.type,
      is_active: category.is_active
    },
    errors: {},
    mode
  })
} 

export const categoriesPage: RequestHandler = (req: Request, res: Response) => {
  const authReq = req as AuthRequest

  res.render('layouts/main', {
    title: 'Categorías',
    view: 'pages/categories/index',
    USER_ID: authReq.user?.id || 'guest'
  })
}
