import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { CategoryGroup } from '../../entities/CategoryGroups.entity'
import { AuthRequest } from '../../types/auth-request'
import { logger } from '../../utils/logger.util'
import { validateCategoryGroup, validateDeleteCategoryGroup } from './category-group.validator'
import { CategoryGroupFormMode } from '../../types/form-view-params'
import { categoryGroupFormMatrix } from '../../policies/category-group-form.policy'
import { parseBoolean } from '../../utils/bool.util'
import { getCategoryGroupById } from '../../cache/cache-category-group.service'
import { parseError } from '../../utils/error.util'
import { deleteAll } from '../../cache/cache-key.service'

/* ============================
   Obtener título según el modo del formulario
============================ */
const getTitle = (mode: string) => {
  switch (mode) {
    case 'insert': return 'Insertar Grupo de Categoría'
    case 'update': return 'Editar Grupo de Categoría'
    case 'delete': return 'Eliminar Grupo de Categoría'
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
    if ((policy[field] === 'editable' || policy[field] === 'readonly') && body[field] !== undefined) {
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
    is_active: parseBoolean(body.is_active),
  }
}

/* ============================
   Renderizar formulario de categoría para Insertar, Editar, Eliminar o Cambiar Estado
============================ */
export const saveCategoryGroup: RequestHandler = async (req: Request, res: Response) => {
  logger.debug(`${saveCategoryGroup.name}-Start`)
  logger.info('saveCategoryGroup called', { body: req.body, param: req.params })
  const auth_req = req as AuthRequest
  const category_group_id = Number(req.body.id)
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
      existing = await getCategoryGroupById(auth_req, category_group_id)
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
      deleteAll(auth_req)
      return res.redirect('/categories')
    }
    /* =========================
       INSERT / UPDATE
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
    /*=================================
      Aplicar sanitización por policy
    =================================*/
    const clean = sanitizeByPolicy(mode, req.body)
    if (clean.name !== undefined) category_group.name = clean.name
    if (clean.is_active !== undefined) { category_group.is_active = parseBoolean(clean.is_active) }
    const errors = await validateCategoryGroup(category_group, auth_req)
    if (errors) throw { validationErrors: errors }
    /*=================================
      Guardar en base de datos y limpiar cache
    =================================*/
    await repo_category_group.save(category_group)
    deleteAll(auth_req)
    return res.redirect('/categories')
  } catch (err: any) {
    /* ============================
       Manejo de errores
    ============================ */
    logger.error(`${saveCategoryGroup.name}-Error. `, {
      user_id: auth_req.user.id,
      category_group_id,
      mode,
      error: parseError(err),
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
