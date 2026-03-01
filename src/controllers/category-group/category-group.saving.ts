import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { CategoryGroup } from '../../entities/CategoryGroups.entity'
import { categoryGroupFormMatrix, CategoryGroupFormMode } from '../../policies/category-group-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { logger } from '../../utils/logger.util'
import { validateCategoryGroup, validateDeleteCategoryGroup } from './category-group.validator'

/* ============================
   Obtener título según el modo del formulario
============================ */
const getTitle = (mode: string) => {
  switch (mode) {
    case 'insert': return 'Insertar Categoría'
    case 'update': return 'Editar Categoría'
    case 'delete': return 'Eliminar Categoría'
    default: return 'Indefinido'
  }
}

/* ============================
   Sanitizar payload según policy
============================ */
const sanitizeByPolicy = (mode: CategoryGroupFormMode, body: any) => {
  const policy = categoryGroupFormMatrix[mode]
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
const buildCategoryGroupView = (body: any, mode: CategoryGroupFormMode) => {
  return {
    ...body,
    is_active: body.is_active !== undefined
      ? body.is_active === 'true'
      : mode === 'insert' ? true : false
  }
}

/* ============================
   Renderizar formulario de categoría para Insertar, Editar, Eliminar o Cambiar Estado
============================ */
export const saveCategoryGroup: RequestHandler = async (req: Request, res: Response) => {
  logger.debug(`${saveCategoryGroup.name}-Start`)
  logger.info('saveCategoryGroup called', { body: req.body, param: req.params })

  const auth_req = req as AuthRequest
  const category_group_id = req.body.id ? Number(req.body.id) : undefined
  const mode: CategoryGroupFormMode = req.body.mode || 'insert'

  const repo_category_group = AppDataSource.getRepository(CategoryGroup)
  const category_group_view = buildCategoryGroupView(req.body, mode)

  const form_state = {
    category_group: category_group_view,
    category_group_form_policy: categoryGroupFormMatrix[mode],
    mode
  }

  try {
    let existing: CategoryGroup | null = null

    if (category_group_id) {
      existing = await repo_category_group.findOne({
        where: { id: category_group_id, user: { id: auth_req.user.id } },
      })
      if (!existing) throw new Error('Grupo de Categoría no encontrada')
    }

    /* =========================
       DELETE
    ============================ */
    if (mode === 'delete') {
      if (!existing) throw new Error('Grupo de Categoría no encontrada')

      const errors = await validateDeleteCategoryGroup(existing, auth_req)
      if (errors) throw { validationErrors: errors }

      await repo_category_group.delete(existing.id)
      return res.redirect('/categories')
    }

    /* =========================
       INSERT / UPDATE / STATUS
    ============================ */
    let category_group: CategoryGroup

    if (mode === 'insert') {
      category_group = repo_category_group.create({
        user: { id: auth_req.user.id } as any,
        name: req.body.name,
        is_active: true
      })
    } else {
      if (!existing) throw new Error('Grupo de Categoría no encontrada')
      category_group = existing
    }

    const clean = sanitizeByPolicy(mode, req.body)

    if (clean.name !== undefined) category_group.name = clean.name
    if (clean.is_active !== undefined) { category_group.is_active = clean.is_active === 'true' || clean.is_active === '1' }

    const errors = await validateCategoryGroup(category_group, auth_req)
    if (errors) throw { validationErrors: errors }

    await repo_category_group.save(category_group)
    return res.redirect('/categories')

  } catch (err: any) {
    logger.error(`${saveCategoryGroup.name}-Error. `, {
      user_id: auth_req.user.id,
      category_group_id: category_group_id,
      mode,
      error: err,
      stack: err?.stack
    })

    const validationErrors = err?.validationErrors || null

    return res.render('layouts/main', {
      title: getTitle(mode),
      view: 'pages/category-groups/form',
      ...form_state,
      errors: validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
    })
  } finally {
    logger.debug(`${saveCategoryGroup.name}-End`)
  }
}
