import { LOGGER_EVENTS } from '../../utils/logger-events'
import { Request, RequestHandler, Response } from 'express';
import { performance } from 'perf_hooks';
import { getCategoryById, getCategoryNameList } from '../../cache/cache-categories.service';
import { getActiveCategoryGroup, getCategoryGroupById } from '../../cache/cache-category-groups.service';
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
  const started_at = performance.now()
  const auth_req = req as AuthRequest
  const user_id = auth_req.user.id
  const saveCategory_logger = logger.forMethod(saveCategory.name, LOGGER_EVENTS.CATEGORY, user_id)
  saveCategory_logger.debug('Inicio proceso de guardado de categoría')
  saveCategory_logger.info('Parametros recibidos', { body: req.body, param: req.params })
  const mode: CategoryFormMode = req.body.mode || 'insert'
  const category_id = Number(req.body.id)
  const category_group_id = Number(req.body.category_group_id)
  const repo_category = AppDataSource.getRepository(Category)
  const form_state = {
    category: await buildCategoryView(auth_req, req.body),
    category_group_list: await getActiveCategoryGroup(auth_req),
    category_name_list: await getCategoryNameList(auth_req),
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
        type_for_payable_or_receivable: req.body.type_for_payable_or_receivable,
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
    if (clean.type_for_payable_or_receivable !== undefined) { category.type_for_payable_or_receivable = clean.type_for_payable_or_receivable === '' ? null : clean.type_for_payable_or_receivable }
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
    saveCategory_logger.error(`Error al guardar la categoria`, { category_id, mode, error: parseError(error), })
    const validationErrors = error?.validationErrors || null
    return res.render('layouts/main', {
      title: getTitle(mode),
      view: 'pages/categories/form',
      ...form_state,
      errors: validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
    })
  } finally {
    const ended_at = performance.now()
    const elapsed_ms = (ended_at - started_at) / 1000
    saveCategory_logger.elapsedTime('Elapsed time', { elapsed_ms })
    saveCategory_logger.debug('Fin de la operación de guardado de categoría')
  }
}
