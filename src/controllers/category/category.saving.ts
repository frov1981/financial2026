import { Request, RequestHandler, Response } from 'express';
import { performance } from 'perf_hooks';
import { getCategoryById } from '../../cache/cache-categories.service';
import { getActiveCategoryGroup, getCategoryGroupById } from '../../cache/cache-category-group.service';
import { deleteAll } from '../../cache/cache-key.service';
import { AppDataSource } from '../../config/typeorm.datasource';
import { Category } from '../../entities/Category.entity';
import { categoryFormMatrix } from '../../policies/category-form.policy';
import { AuthRequest } from '../../types/auth-request';
import { CategoryFormMode } from '../../types/form-view-params';
import { parseBoolean } from '../../utils/bool.util';
import { parseError } from '../../utils/error.util';
import { logger } from '../../utils/logger.util';
import { validateCategory, validateDeleteCategory } from './category.validator';

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
const sanitizeByPolicy = (mode: CategoryFormMode, body: any) => {
  const policy = categoryFormMatrix[mode]
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
const buildCategoryView = async (auth_req: AuthRequest, body: any) => {
  const category_group_id = Number(body.category_group_id)
  const category_group = await getCategoryGroupById(auth_req, category_group_id)
  return {
    ...body,
    is_active: parseBoolean(body.is_active),
    category_group,
  }
}

/* ============================
   Renderizar formulario de categoría para Insertar, Editar, Eliminar o Cambiar Estado
============================ */
export const saveCategory: RequestHandler = async (req: Request, res: Response) => {
  const start = performance.now()
  logger.info(`${saveCategory.name} called`, { body: req.body, param: req.params })
  const auth_req = req as AuthRequest
  const user_id = auth_req.user.id
  const mode: CategoryFormMode = req.body.mode || 'insert'
  const category_id = Number(req.body.id)
  const category_group_id = Number(req.body.category_group_id)
  const repo_category = AppDataSource.getRepository(Category)
  const form_state = {
    category: await buildCategoryView(auth_req, req.body),
    category_group_list: await getActiveCategoryGroup(auth_req),
    category_form_policy: categoryFormMatrix[mode],
    mode
  }
  try {
    let existing: Category | null = null
    if (category_id) {
      existing = await getCategoryById(auth_req, category_id)
      if (!existing) throw new Error('Categoría no encontrada')
    }
    /* =========================
       DELETE
    ============================ */
    if (mode === 'delete') {
      if (!existing) throw new Error('Categoría no encontrada')
      const errors = await validateDeleteCategory(auth_req, existing)
      if (errors) throw { validationErrors: errors }
      await repo_category.delete(existing.id)
      deleteAll(auth_req, 'category')
      return res.redirect('/categories')
    }
    /* =========================
       INSERT / UPDATE
    ============================ */
    let category: Category
    if (mode === 'insert') {
      const selected_group = await getCategoryGroupById(auth_req, category_group_id)
      category = repo_category.create({
        user: { id: auth_req.user.id } as any,
        type: req.body.type,
        type_for_loan: req.body.type_for_loan,
        name: req.body.name,
        category_group: selected_group,
        is_active: true
      })
    } else {
      if (!existing) throw new Error('Categoría no encontrada')
      category = existing
    }
    /*=================================
      Aplicar sanitización por policy
    =================================*/
    const clean = sanitizeByPolicy(mode, req.body)
    if (clean.name !== undefined) category.name = clean.name
    if (clean.type !== undefined) category.type = clean.type
    if (clean.type_for_loan !== undefined) { category.type_for_loan = clean.type_for_loan === '' ? null : clean.type_for_loan }
    if (clean.category_group_id !== undefined) { category.category_group = await getCategoryGroupById(auth_req, Number(clean.category_group_id)) }
    if (clean.is_active !== undefined) { category.is_active = parseBoolean(clean.is_active) }
    const errors = await validateCategory(auth_req, category)
    if (errors) throw { validationErrors: errors }
    /*=================================
      Guardar en base de datos y limpiar cache
    =================================*/
    await repo_category.save(category)
    deleteAll(auth_req, 'category')
    return res.redirect('/categories')
  } catch (error: any) {
    /* ============================
       Manejo de errores
    ============================ */
    logger.error(`${saveCategory.name}-Error. `, { user_id: auth_req.user.id, category_id, mode, error: parseError(error), })
    const validationErrors = error?.validationErrors || null
    return res.render('layouts/main', {
      title: getTitle(mode),
      view: 'pages/categories/form',
      ...form_state,
      errors: validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
    })
  } finally {
    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`${saveCategory.name}. user=[${user_id}], elapsedTime=[${duration_sec.toFixed(4)}]`)
  }
}
