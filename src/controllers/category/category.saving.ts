import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Category } from '../../entities/Category.entity'
import { CategoryGroup } from '../../entities/CategoryGroups.entity'
import { categoryFormMatrix, CategoryFormMode } from '../../policies/category-form.policy'
import { getActiveParentCategoriesByUser } from '../../services/populate-items.service'
import { AuthRequest } from '../../types/auth-request'
import { logger } from '../../utils/logger.util'
import { validateCategory, validateDeleteCategory } from './category.validator'

/* ============================
   Obtener título según el modo del formulario
============================ */
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
const buildCategoryView = (body: any, category_group: CategoryGroup[]) => {
  const category_group_id = body.category_group_id ? Number(body.category_group_id) : null
  const group = category_group_id ? category_group.find(g => g.id === category_group_id) || null : null

  return {
    ...body,
    category_group: group ? { id: group.id, name: group.name } : null
  }
}

/* ============================
   Obtener grupo de categoría desde el body y la lista de grupos del usuario
============================ */
const findCategoryGroupByBody = (body: any, category_group: CategoryGroup[]): CategoryGroup | null => {
  const category_group_id = body.category_group_id ? Number(body.category_group_id) : null

  if (!category_group_id) return null

  return category_group.find(g => g.id === category_group_id) || null
}

/* ============================
   Obtener categorías activas del usuario para mostrar en el formulario
============================ */

/* ============================
   Renderizar formulario de categoría para Insertar, Editar, Eliminar o Cambiar Estado
============================ */
export const saveCategory: RequestHandler = async (req: Request, res: Response) => {
  logger.info('saveCategory called', { body: req.body, param: req.params })

  const auth_req = req as AuthRequest
  const category_id = req.body.id ? Number(req.body.id) : undefined
  const mode: CategoryFormMode = req.body.mode || 'insert'

  const repo_category = AppDataSource.getRepository(Category)
  const category_group = await getActiveParentCategoriesByUser(auth_req)
  const category_view = buildCategoryView(req.body, category_group)

  const form_state = {
    category: category_view,
    category_group,
    category_form_policy: categoryFormMatrix[mode],
    mode
  }

  try {
    let existing: Category | null = null

    if (category_id) {
      existing = await repo_category.findOne({
        where: { id: category_id, user: { id: auth_req.user.id } },
        relations: { category_group: true, parent: true }
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
      const selectedGroup = findCategoryGroupByBody(req.body, category_group)
      category = repo_category.create({
        user: { id: auth_req.user.id } as any,
        type: req.body.type,
        name: req.body.name,
        category_group: selectedGroup,
        is_active: true
      })
    } else {
      if (!existing) throw new Error('Categoría no encontrada')
      category = existing
    }

    const clean = sanitizeByPolicy(mode, req.body)

    if (clean.name !== undefined) category.name = clean.name
    if (clean.type !== undefined) category.type = clean.type
    if (clean.category_group !== undefined) { category.category_group = findCategoryGroupByBody(req.body, category_group) }
    if (clean.is_active !== undefined) { category.is_active = clean.is_active === 'true' || clean.is_active === '1' }

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
