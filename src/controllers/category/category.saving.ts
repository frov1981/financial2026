import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Category } from '../../entities/Category.entity'
import { AuthRequest } from '../../types/auth-request'
import { logger } from '../../utils/logger.util'
import { validateCategory, validateDeleteCategory } from './category.validator'
import { categoryFormMatrix, CategoryFormMode } from '../../policies/category-form.policy'
import { CategoryGroup } from '../../entities/CategoryGroups.entity'

const getTitle = (mode: string) => {
  switch (mode) {
    case 'insert': return 'Insertar Categoría'
    case 'update': return 'Editar Categoría'
    case 'status': return 'Editar Estado de la Categoría'
    case 'delete': return 'Eliminar Categoría'
    default: return 'Indefinido'
  }
}

/* ============================
   Sanitizar payload según policy
============================ */
const sanitizeByPolicy = (mode: CategoryFormMode, body: any) => {
  const policy = categoryFormMatrix[mode]
  const clean: any = {}

  for (const field in policy) {
    if (policy[field] === 'edit' && body[field] !== undefined) {
      clean[field] = body[field]
    }
  }

  return clean
}

/* ============================
   Construir objeto para la vista
============================ */
const buildCategoryView = (body: any, category_groups: CategoryGroup[]) => {
  const group_id = body.group_id ? Number(body.group_id) : null
  const group = group_id ? category_groups.find(g => g.id === group_id) || null : null

  return {
    ...body,
    group: group ? { id: group.id, name: group.name } : null
  }
}

export const saveCategory: RequestHandler = async (req: Request, res: Response) => {
  logger.debug('saveCategory called', { body: req.body, param: req.params })

  const auth_req = req as AuthRequest
  const category_id = req.body.id ? Number(req.body.id) : undefined
  const mode: CategoryFormMode = req.body.mode || 'insert'

  const repo_category = AppDataSource.getRepository(Category)
  const repo_group = AppDataSource.getRepository(CategoryGroup)

  const category_groups = await repo_group.find({
    where: { user: { id: auth_req.user.id } },
    order: { name: 'ASC' }
  })

  const category_view = buildCategoryView(req.body, category_groups)

  const form_state = {
    category: category_view,
    category_groups,
    category_form_policy: categoryFormMatrix[mode],
    mode
  }

  try {
    let existing: Category | null = null

    if (category_id) {
      existing = await repo_category.findOne({
        where: { id: category_id, user: { id: auth_req.user.id } },
        relations: { group: true, parent: true }
      })
      if (!existing) throw new Error('Categoría no encontrada')
    }

    /* =========================
       DELETE
    ============================ */
    if (mode === 'delete') {
      if (!existing) throw new Error('Categoría no encontrada')

      const errors = await validateDeleteCategory(existing, auth_req)
      if (errors) throw { validationErrors: errors }

      await repo_category.delete(existing.id)
      return res.redirect('/categories')
    }

    /* =========================
       INSERT / UPDATE / STATUS
    ============================ */
    let category: Category

    if (mode === 'insert') {
      const selectedGroup = req.body.group_id
        ? category_groups.find(g => g.id === Number(req.body.group_id)) || null
        : null

      if (!selectedGroup) throw new Error('Grupo de categoría inválido')

      category = repo_category.create({
        user: { id: auth_req.user.id } as any,
        type: req.body.type,
        name: req.body.name,
        group: selectedGroup,
        is_active: true
      })
    } else {
      if (!existing) throw new Error('Categoría no encontrada')
      category = existing
    }

    const clean = sanitizeByPolicy(mode, req.body)

    if (clean.name !== undefined) category.name = clean.name
    if (clean.type !== undefined) category.type = clean.type

    if (clean.group_id !== undefined) {
      const selectedGroup = category_groups.find(g => g.id === Number(clean.group_id)) || null
      if (!selectedGroup) throw new Error('Grupo de categoría inválido')
      category.group = selectedGroup
    }

    if (clean.is_active !== undefined) {
      category.is_active = clean.is_active === 'true' || clean.is_active === '1'
    }

    const errors = await validateCategory(category, auth_req)
    if (errors) throw { validationErrors: errors }

    await repo_category.save(category)
    return res.redirect('/categories')

  } catch (err: any) {
    logger.error('Error saving category', {
      userId: auth_req.user.id,
      category_id,
      mode,
      error: err,
      stack: err?.stack
    })

    const validationErrors = err?.validationErrors || null

    return res.render('layouts/main', {
      title: getTitle(mode),
      view: 'pages/categories/form',
      ...form_state,
      errors: validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
    })
  }
}
