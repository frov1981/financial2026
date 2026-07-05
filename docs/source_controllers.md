# Codigo Fuente Consolidado 
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\account\account.controller.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express'
import { DTOAccount, getAccountById, getAccountsForApi } from '../../cache/cache-accounts.service'
import { accountFormMatrix } from '../../policies/account-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { BaseFormViewParams } from '../../types/form-view-params'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'
export { saveAccount as apiForSavingAccount } from './account.saving'

type AccountFormViewParams = BaseFormViewParams & {
  account: any
}

const renderAccountForm = async (res: Response, params: AccountFormViewParams) => {
  const { title, view, account, errors, mode, auth_req } = params
  const account_form_policy = accountFormMatrix[mode]
  return res.render('layouts/main', {
    title,
    view,
    errors,
    mode,
    auth_req,
    account,
    account_form_policy,
  })
}

export const routeToPageAccount: RequestHandler = (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  res.render('layouts/main', {
    title: 'Cuentas',
    view: 'pages/accounts/index',
    USER_ID: auth_req.user?.id || 'guest'
  })
}

export const routeToFormInsertAccount: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  return renderAccountForm(res, {
    title: 'Insertar Cuenta',
    view: 'pages/accounts/form',
    errors: {},
    mode,
    auth_req,
    account: {
      type: null,
      is_active: true
    },
  })
}

export const routeToFormUpdateAccount: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'update'
  const auth_req = req as AuthRequest
  const account_id = Number(req.params.id)
  const account = await getAccountById(auth_req, account_id)
  if (!account) {
    return res.redirect('/accounts')
  }
  return renderAccountForm(res, {
    title: 'Editar Cuenta',
    view: 'pages/accounts/form',
    errors: {},
    mode,
    auth_req,
    account,
  })
}

export const routeToFormDeleteAccount: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'delete'
  const auth_req = req as AuthRequest
  const account_id = Number(req.params.id)
  const account = await getAccountById(auth_req, account_id)
  if (!account) {
    return res.redirect('/accounts')
  }
  return renderAccountForm(res, {
    title: 'Eliminar Cuenta',
    view: 'pages/accounts/form',
    errors: {},
    mode,
    auth_req,
    account,
  })
}

/*=================================================
Api para devolver el DTO Account en JSON
==================================================*/
export const apiForGettingAccounts: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  try {
    const accounts: DTOAccount[] = await getAccountsForApi(auth_req)
    res.json(accounts)
  } catch (error) {
    logger.error(`${apiForGettingAccounts.name}-Error. `, parseError(error))
    res.status(500).json({ error: 'Error al listar cuentas' })
  } finally {
  }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\account\account.saving.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express';
import { performance } from 'perf_hooks';
import { getAccountById } from '../../cache/cache-accounts.service';
import { deleteAll } from '../../cache/cache-key.service';
import { AppDataSource } from '../../config/typeorm.datasource';
import { Account } from '../../entities/Account.entity';
import { accountFormMatrix } from '../../policies/account-form.policy';
import { AuthRequest } from '../../types/auth-request';
import { AccountFormMode } from '../../types/form-view-params';
import { parseBoolean } from '../../utils/bool.util';
import { parseError } from '../../utils/error.util';
import { logger } from '../../utils/logger.util';
import { validateDeleteAccount, validateSaveAccount } from './account.validator';

/* ============================
   Título según modo
============================ */
const getTitle = (mode: AccountFormMode) => {
  switch (mode) {
    case 'insert': return 'Insertar Cuenta'
    case 'update': return 'Editar Cuenta'
    case 'delete': return 'Eliminar Cuenta'
    default: return 'Indefinido'
  }
}

/* ============================
   Sanitizar payload según policy
============================ */
const sanitizeByPolicy = (mode: AccountFormMode, body: any) => {
  const policy = accountFormMatrix[mode]
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
const buildAccountView = (body: any) => {
  return {
    ...body,
    is_active: parseBoolean(body.is_active)
  }
}

export const saveAccount: RequestHandler = async (req: Request, res: Response) => {
  const start = performance.now()
  logger.info(`${saveAccount.name} called`, { body: req.body, param: req.params })
  const auth_req = req as AuthRequest
  const user_id = auth_req.user.id
  const account_id = req.body.id ? Number(req.body.id) : undefined
  const mode: AccountFormMode = req.body.mode || 'insert'
  const repo_account = AppDataSource.getRepository(Account)

  const form_state = {
    account: buildAccountView(req.body),
    account_form_policy: accountFormMatrix[mode],
    mode
  }
  try {
    let existing: Account | null = null
    if (account_id) {
      existing = await getAccountById(auth_req, account_id)
      if (!existing) throw new Error('Cuenta no encontrada')
    }
    /* ============================
       DELETE
    ============================ */
    if (mode === 'delete') {
      if (!existing) throw new Error('Cuenta no encontrada')
      const errors = await validateDeleteAccount(auth_req, existing)
      if (errors) throw { validationErrors: errors }
      await repo_account.delete(existing.id)
      deleteAll(auth_req, 'account')
      return res.redirect('/accounts')
    }
    /* ============================
       INSERT / UPDATE
    ============================ */
    let account: Account
    if (mode === 'insert') {
      account = repo_account.create({
        user: { id: auth_req.user.id } as any,
        type: req.body.type,
        name: req.body.name,
        is_active: true,
        balance: 0
      })
    } else {
      if (!existing) throw new Error('Cuenta no encontrada')
      account = existing
    }
    /*=================================
      Aplicar sanitización por policy
    =================================*/
    const clean = sanitizeByPolicy(mode, req.body)
    if (clean.type !== undefined) { account.type = clean.type }
    if (clean.name !== undefined) { account.name = clean.name }
    if (clean.is_active !== undefined) { account.is_active = parseBoolean(clean.is_active) }
    const errors = await validateSaveAccount(auth_req, account)
    if (errors) throw { validationErrors: errors }
    /*=================================
      Guardar en base de datos y limpiar cache
    =================================*/
    await repo_account.save(account)
    deleteAll(auth_req, 'account')
    return res.redirect('/accounts')
  } catch (error: any) {
    /* ============================
       Manejo de errores
    ============================ */
    logger.error('Error saving account', { user_id: auth_req.user.id, account_id, mode, error: parseError(error) })
    const validation_errors = error?.validationErrors || null
    return res.render('layouts/main', {
      title: getTitle(mode),
      view: 'pages/accounts/form',
      ...form_state,
      errors: validation_errors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
    })
  } finally {
    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`${saveAccount.name}. user=[${user_id}], elapsedTime=[${duration_sec.toFixed(4)}]`)
  }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\account\account.validator.ts
```
 
```ts
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Account } from '../../entities/Account.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'
import { getAccountByName } from '../../cache/cache-accounts.service'

export const validateSaveAccount = async (auth_req: AuthRequest, account: Account): Promise<Record<string, string> | null> => {
    const user_id = auth_req.user.id
    const account_instance = plainToInstance(Account, account)
    const errors = await validate(account_instance)
    const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}
    // BALANCE VALIDATION
    if (account.id && account.is_active === false && account.balance !== 0) {
        field_errors.is_active = 'No se puede desactivar la cuenta si tiene un balance mayor a cero'
    }
    // NAME UNIQUENESS VALIDATION
    if (account.name && user_id) {
        const existing = await getAccountByName(auth_req, account.name)
        if (existing && existing.id !== account.id) {
            field_errors.name = 'Ya existe una cuenta con este nombre'
        }
    }
    return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeleteAccount = async (auth_req: AuthRequest, account: Account): Promise<Record<string, string> | null> => {
    const user_id = auth_req.user.id
    const field_errors: Record<string, string> = {}
    // BALANCE VALIDATION
    if (account.balance !== 0) {
        field_errors.general = 'No se puede eliminar la cuenta porque tiene balance distinto de cero'
    }
    // TRANSACTION REFERENCE VALIDATION
    const transaction_repo = AppDataSource.getRepository(Transaction)
    const used_in_transactions = await transaction_repo.existsBy([
        { user: { id: user_id }, account: { id: account.id } },
        { user: { id: user_id }, to_account: { id: account.id } }
    ])
    if (used_in_transactions) {
        if (field_errors.general) {
            field_errors.general += ' y tiene transacciones asociadas'
        } else {
            field_errors.general = 'No se puede eliminar la cuenta porque tiene transacciones asociadas'
        }
    }
    return Object.keys(field_errors).length > 0 ? field_errors : null
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\category\category.controller.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express'
import { DTOCategory, getCategoriesForApi, getCategoryById } from '../../cache/cache-categories.service'
import { categoryFormMatrix } from '../../policies/category-form.policy'
import { getActiveParentCategoriesByUser } from '../../services/populate-items.service'
import { AuthRequest } from '../../types/auth-request'
import { BaseFormViewParams } from '../../types/form-view-params'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'
export { saveCategory as apiForSavingCategory } from './category.saving'

type CategoryFormViewParams = BaseFormViewParams & {
  category: any
}

const renderCategoryForm = async (res: Response, params: CategoryFormViewParams) => {
  const { title, view, category, errors, mode, auth_req } = params
  const category_group_list = await getActiveParentCategoriesByUser(auth_req)
  const category_form_policy = categoryFormMatrix[mode]
  return res.render('layouts/main', {
    title,
    view,
    errors,
    mode,
    auth_req,
    category,
    category_form_policy,
    category_group_list,
  })
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
    errors: {},
    mode,
    auth_req,
    category: {
      type: null,
      type_for_loan: null,
      category_group: null,
      is_active: true
    },
  })
}

export const routeToFormUpdateCategory: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'update'
  const auth_req = req as AuthRequest
  const category_id = Number(req.params.id)
  const category = await getCategoryById(auth_req, category_id)
  if (!category) {
    return res.redirect('/categories')
  }
  return renderCategoryForm(res, {
    title: 'Editar Categoría',
    view: 'pages/categories/form',
    errors: {},
    mode,
    auth_req,
    category,
  })
}

export const routeToFormDeleteCategory: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'delete'
  const auth_req = req as AuthRequest
  const category_id = Number(req.params.id)
  const category = await getCategoryById(auth_req, category_id)
  if (!category) {
    return res.redirect('/categories')
  }
  return renderCategoryForm(res, {
    title: 'Eliminar Categoría',
    view: 'pages/categories/form',
    errors: {},
    mode,
    auth_req,
    category,
  })
}

/*=================================================
Api para devolver el DTO Category en JSON
==================================================*/
export const apiForGettingCategories: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  try {
    const categories: DTOCategory[] = await getCategoriesForApi(auth_req)
    res.json(categories)
  } catch (error) {
    logger.error(`${apiForGettingCategories.name}-Error. `, parseError(error))
    res.status(500).json({ error: 'Error al listar categorías' })
  } finally {
  }
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\category\category.saving.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express';
import { performance } from 'perf_hooks';
import { getCategoryById } from '../../cache/cache-categories.service';
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
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\category\category.validator.ts
```
 
```ts
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { getCategoryByName } from '../../cache/cache-categories.service'
import { getCategoryGroupById } from '../../cache/cache-category-groups.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Category } from '../../entities/Category.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validateCategory = async (auth_req: AuthRequest, category: Category): Promise<Record<string, string> | null> => {
  const category_instance = plainToInstance(Category, category)
  const errors = await validate(category_instance)
  const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}
  // Nombre único por usuario
  if (category.name) {
    const existing = await getCategoryByName(auth_req, category.name)
    if (existing && existing.id !== category.id) {
      field_errors.name = 'Ya existe una categoría con este nombre'
    }
  }
  // Validación de tipo (SIEMPRE)
  if (!category.type) {
    field_errors.type = 'El tipo es obligatorio'
  }
  // Validación de grupo (OBLIGATORIO)
  if (!category.category_group || !category.category_group.id) {
    field_errors.category_group = 'El grupo de categoría es obligatorio'
  } else {
    const category_group = await getCategoryGroupById(auth_req, category.category_group.id)
    if (!category_group) {
      field_errors.category_group = 'El grupo de categoría seleccionado no es válido'
    }
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeleteCategory = async (auth_req: AuthRequest, category: Category): Promise<Record<string, string> | null> => {
  const user_id = auth_req.user.id
  const field_errors: Record<string, string> = {}
  const tx_repo = AppDataSource.getRepository(Transaction)
  const category_repo = AppDataSource.getRepository(Category)
  // Validación: transacciones asociadas
  const tx_count = await tx_repo.count({
    where: {
      category: { id: category.id },
      user: { id: user_id }
    }
  })
  if (tx_count > 0) {
    field_errors.general = `No se puede eliminar la categoría porque tiene ${tx_count} transacción(es) asociada(s)`
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\category-group\category-group.controller.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express'
import { getCategoryGroupById } from '../../cache/cache-category-groups.service'
import { categoryGroupFormMatrix } from '../../policies/category-group-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { BaseFormViewParams } from '../../types/form-view-params'
export { saveCategoryGroup as apiForSavingCategoryGroup } from './category-group.saving'

type CategoryGroupFormViewParams = BaseFormViewParams & {
  category_group: any
}

const renderCategoryGroupForm = async (res: Response, params: CategoryGroupFormViewParams) => {
  const { title, view, category_group, errors, mode, auth_req } = params
  const category_group_form_policy = categoryGroupFormMatrix[mode]
  return res.render('layouts/main', {
    title,
    view,
    errors,
    mode,
    auth_req,
    category_group,
    category_group_form_policy,
  })
}

export const routeToFormInsertCategoryGroup: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  return renderCategoryGroupForm(res, {
    title: 'Insertar Grupo de Categoría',
    view: 'pages/category-groups/form',
    errors: {},
    mode,
    auth_req,
    category_group: {
      is_active: true
    },
  })
}

export const routeToFormUpdateCategoryGroup: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'update'
  const auth_req = req as AuthRequest
  const category_group_id = Number(req.params.id)
  const category_group = await getCategoryGroupById(auth_req, category_group_id)
  if (!category_group) {
    return res.redirect('/categories')
  }
  return renderCategoryGroupForm(res, {
    title: 'Editar Grupo de Categoría',
    view: 'pages/category-groups/form',
    errors: {},
    mode,
    auth_req,
    category_group,
  })
}

export const routeToFormDeleteCategoryGroup: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'delete'
  const auth_req = req as AuthRequest
  const category_group_id = Number(req.params.id)
  const category_group = await getCategoryGroupById(auth_req, category_group_id)
  if (!category_group) {
    return res.redirect('/categories')
  }
  return renderCategoryGroupForm(res, {
    title: 'Eliminar Grupo de Categoría',
    view: 'pages/category-groups/form',
    errors: {},
    mode,
    auth_req,
    category_group,
  })
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\category-group\category-group.saving.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express';
import { performance } from 'perf_hooks';
import { getCategoryGroupById } from '../../cache/cache-category-groups.service';
import { deleteAll } from '../../cache/cache-key.service';
import { AppDataSource } from '../../config/typeorm.datasource';
import { CategoryGroup } from '../../entities/CategoryGroups.entity';
import { categoryGroupFormMatrix } from '../../policies/category-group-form.policy';
import { AuthRequest } from '../../types/auth-request';
import { CategoryGroupFormMode } from '../../types/form-view-params';
import { parseBoolean } from '../../utils/bool.util';
import { parseError } from '../../utils/error.util';
import { logger } from '../../utils/logger.util';
import { validateCategoryGroup, validateDeleteCategoryGroup } from './category-group.validator';

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
  const start = performance.now()
  logger.info(`${saveCategoryGroup.name} called`, { body: req.body, param: req.params })
  const auth_req = req as AuthRequest
  const user_id = auth_req.user.id
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
      deleteAll(auth_req, 'category_group')
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
    deleteAll(auth_req, 'category_group')
    return res.redirect('/categories')
  } catch (error: any) {
    /* ============================
       Manejo de errores
    ============================ */
    logger.error(`${saveCategoryGroup.name}-Error. `, { user_id: auth_req.user.id, category_group_id, mode, error: parseError(error), })
    const validationErrors = error?.validationErrors || null
    return res.render('layouts/main', {
      title: getTitle(mode),
      view: 'pages/category-groups/form',
      ...form_state,
      errors: validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
    })
  } finally {
    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`${saveCategoryGroup.name}. user=[${user_id}], elapsedTime=[${duration_sec.toFixed(4)}]`)
  }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\category-group\category-group.validator.ts
```
 
```ts
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { getCategoryGroupByName } from '../../cache/cache-category-groups.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Category } from '../../entities/Category.entity'
import { CategoryGroup } from '../../entities/CategoryGroups.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validateCategoryGroup = async (category_group: CategoryGroup, auth_req: AuthRequest): Promise<Record<string, string> | null> => {
  const category_group_instance = plainToInstance(CategoryGroup, category_group)
  const errors = await validate(category_group_instance)
  const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}
  // Nombre único por usuario
  if (category_group.name) {
    const existing = await getCategoryGroupByName(auth_req, category_group.name)
    if (existing && existing.id !== category_group.id) {
      field_errors.name = 'Ya existe un grupo de categoría con este nombre'
    }
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeleteCategoryGroup = async (category_group: CategoryGroup, auth_req: AuthRequest): Promise<Record<string, string> | null> => {
  const user_id = auth_req.user.id
  const field_errors: Record<string, string> = {}
  const category_repo = AppDataSource.getRepository(Category)
  const categories_count = await category_repo.count({
    where: {
      category_group: { id: category_group.id },
      user: { id: user_id }
    }
  })
  if (categories_count > 0) {
    field_errors.general = `No se puede eliminar el grupo porque tiene ${categories_count} categoría(s) asociada(s)`
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\home\2fa.controller.ts
```
 
```ts
import { Request, Response } from 'express'
import { IsNull, MoreThan } from 'typeorm'
import { AppDataSource } from '../../config/typeorm.datasource'
import { AuthCode } from '../../entities/AuthCode.entity'
import { compareCode } from '../../utils/auth-code.util'
import { logger } from '../../utils/logger.util'
import { parseError } from '../../utils/error.util'

export const show2FA = (req: Request, res: Response) => {
  if (!(req.session as any)?.pending2FAUserId) {
    return res.redirect('/login')
  }

  res.render(
    'pages/2fa',
    {
      error: null
    })
}

export const verify2FA = async (req: Request, res: Response) => {
  try {
    const { code } = req.body
    const pendingUserId = (req.session as any)?.pending2FAUserId

    if (!pendingUserId) return res.redirect('/login')

    const repo = AppDataSource.getRepository(AuthCode)

    const authCode = await repo.findOne({
      where: {
        user: { id: pendingUserId },
        used_at: IsNull(),
        expires_at: MoreThan(new Date())
      },
      relations: ['user']
    })

    if (!authCode) {
      return res.render(
        'pages/2fa',
        {
          error: 'Código inválido o expirado'
        })
    }

    const isValid = await compareCode(code, authCode.code_hash)
    if (!isValid) {
      authCode.attempts += 1
      await repo.save(authCode)
      return res.render(
        'pages/2fa',
        {
          error: 'Código incorrecto'
        })
    }

    authCode.used_at = new Date()
    await repo.save(authCode)

    // preserve timezone across session regeneration (otherwise it's lost)
    const preservedTimezone = (req.session as any).timezone

    delete (req.session as any).pending2FAUserId

    req.session.regenerate(err => {
      if (err) {
        logger.error(err)
        return res.redirect('/login')
      }

      ; (req.session as any).user_id = pendingUserId
      ; (req.session as any).timezone = preservedTimezone

      req.session.save(err2 => {
        if (err2) {
          logger.error(err2)
          return res.redirect('/login')
        }

        res.redirect('/home')
      })
    })

  } catch (error: any) {
    logger.error('verify2FA error', parseError(error))
    res.render(
      'pages/2fa',
      {
        error: 'Error validando el código'
      })
  }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\home\home.auxiliar.ts
```
 
```ts
import { DateTime } from 'luxon'
import { getHomeAvailableYearsKpiCache, getHomeBalanceKpiCache, getHomeCashFlowSummaryCache, getHomeLoanFlowSummaryCache, getHomeTrendKpiCache } from '../../cache/cache-home.service'
import { AppDataSource } from "../../config/typeorm.datasource"
import { Account } from "../../entities/Account.entity"
import { Loan } from "../../entities/Payable.entity"
import { LoanPayment } from "../../entities/PayablePayment.entity"
import { Transaction } from "../../entities/Transaction.entity"
import { AuthRequest } from "../../types/auth-request"

/* ============================================================================
   Servicio: Resumen últimos 6 meses (ingresos / egresos / balance)
============================================================================ */
export const getChartDataLast6MonthsBalance = async (auth_req: AuthRequest) => {
  const user_id = auth_req.user.id
  const transaction_repo = AppDataSource.getRepository(Transaction)

  /* ============================
     Rango de fechas
  ============================ */
  const end_date = new Date()
  const start_date = new Date()
  start_date.setMonth(start_date.getMonth() - 5)
  start_date.setDate(1)

  /* ============================
     Query agregada por mes (MySQL)
  ============================ */
  const rows = await transaction_repo
    .createQueryBuilder('t')
    .select([
      "DATE_FORMAT(t.date, '%Y-%m') AS month",
      "SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) AS income",
      "SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) AS expense"
    ])
    .where('t.user_id = :user_id', { user_id })
    .andWhere('t.type IN (:...types)', { types: ['income', 'expense'] })
    .andWhere('t.date BETWEEN :start AND :end', {
      start: start_date,
      end: end_date
    })
    .groupBy("DATE_FORMAT(t.date, '%Y-%m')")
    .orderBy("DATE_FORMAT(t.date, '%Y-%m')", 'ASC')
    .getRawMany()

  /* ============================
     Normalización de meses
  ============================ */
  const labels: string[] = []
  const income: number[] = []
  const expense: number[] = []
  const balance: number[] = []

  const cursor = new Date(start_date)

  while (cursor <= end_date) {

    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    const row = rows.find(r => r.month === key)

    const inc = row ? Number(row.income) : 0
    const exp = row ? Number(row.expense) : 0

    labels.push(cursor.toLocaleString('es', { month: 'short' }))
    income.push(inc)
    expense.push(exp)
    balance.push(inc - exp)

    cursor.setMonth(cursor.getMonth() + 1)
  }

  return {
    labels,
    income,
    expense,
    balance
  }
}

/* ============================================================================
   Servicio: Resumen últimos 6 años (ingresos / egresos / balance)
============================================================================ */
export const getChartDataLast6YearsBalance = async (auth_req: AuthRequest) => {
  const user_id = auth_req.user.id
  const transaction_repo = AppDataSource.getRepository(Transaction)

  /* ============================
     Rango de fechas
  ============================ */
  const end_date = new Date()
  const start_date = new Date()
  start_date.setFullYear(start_date.getFullYear() - 5)
  start_date.setMonth(0)
  start_date.setDate(1)

  /* ============================
     Query agregada por año (MySQL)
  ============================ */
  const rows = await transaction_repo
    .createQueryBuilder('t')
    .select([
      "YEAR(t.date) AS year",
      "SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) AS income",
      "SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) AS expense"
    ])
    .where('t.user_id = :user_id', { user_id })
    .andWhere('t.type IN (:...types)', { types: ['income', 'expense'] })
    .andWhere('t.date BETWEEN :start AND :end', {
      start: start_date,
      end: end_date
    })
    .groupBy('YEAR(t.date)')
    .orderBy('YEAR(t.date)', 'ASC')
    .getRawMany()

  /* ============================
     Normalización de años
  ============================ */
  const labels: string[] = []
  const income: number[] = []
  const expense: number[] = []
  const balance: number[] = []

  const cursor = new Date(start_date)

  while (cursor <= end_date) {

    const key = cursor.getFullYear()
    const row = rows.find(r => Number(r.year) === key)

    const inc = row ? Number(row.income) : 0
    const exp = row ? Number(row.expense) : 0

    labels.push(String(key))
    income.push(inc)
    expense.push(exp)
    balance.push(inc - exp)

    cursor.setFullYear(cursor.getFullYear() + 1)
  }

  return {
    labels,
    income,
    expense,
    balance
  }
}

/* ============================================================================
   KPIs últimos 6 meses
============================================================================ */
export const getKpisLast6MonthsBalance = async (auth_req: AuthRequest) => {
  const user_id = auth_req.user.id
  const transaction_repo = AppDataSource.getRepository(Transaction)

  /* ============================
     Rango fechas
  ============================ */
  const end_date = new Date()
  const start_date = new Date()
  start_date.setMonth(start_date.getMonth() - 5)
  start_date.setDate(1)

  /* ============================
     Query agregada mensual
  ============================ */
  const rows = await transaction_repo
    .createQueryBuilder('t')
    .select([
      "DATE_FORMAT(t.date, '%Y-%m') AS month",
      "SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) AS income",
      "SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) AS expense"
    ])
    .where('t.user_id = :user_id', { user_id })
    .andWhere('t.type IN (:...types)', { types: ['income', 'expense'] })
    .andWhere('t.date BETWEEN :start AND :end', {
      start: start_date,
      end: end_date
    })
    .groupBy("DATE_FORMAT(t.date, '%Y-%m')")
    .orderBy("DATE_FORMAT(t.date, '%Y-%m')", 'ASC')
    .getRawMany()

  /* ============================
     Normalización
  ============================ */
  const income: number[] = []
  const expense: number[] = []

  const cursor = new Date(start_date)

  while (cursor <= end_date) {

    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    const row = rows.find(r => r.month === key)

    income.push(row ? Number(row.income) : 0)
    expense.push(row ? Number(row.expense) : 0)

    cursor.setMonth(cursor.getMonth() + 1)
  }

  /* ============================
     KPIs
  ============================ */
  const total_income = income.reduce((a, b) => a + b, 0)
  const total_expense = expense.reduce((a, b) => a + b, 0)
  const balance = total_income - total_expense
  const avg_expense = total_expense / income.length

  const last_balance = income[income.length - 1] - expense[expense.length - 1]
  const prevBalance = income[income.length - 2] - expense[expense.length - 2]
  const trend = last_balance - prevBalance

  return {
    total_income,
    total_expense,
    balance,
    avg_expense,
    trend
  }
}

/* ============================================================================
   Servicio: Resumen anual de préstamos (total prestado, pagado, intereses, saldo)
============================================================================ */
export const getChartDataLast6YearsLoan = async (auth_req: AuthRequest) => {
  const user_id = auth_req.user.id
  const loan_repo = AppDataSource.getRepository(Loan)
  const payment_repo = AppDataSource.getRepository(LoanPayment)
  const last_years = 5

  /* ============================
     Determinar años a consultar
  ============================ */
  const current_year = new Date().getFullYear()
  const years = Array.from({ length: last_years }, (_, i) => current_year - (last_years - 1 - i))

  /* ============================
     Total prestado y saldo por año
  ============================ */
  const loan_rows = await loan_repo
    .createQueryBuilder('l')
    .select([
      "YEAR(l.start_date) AS year",
      "SUM(l.total_amount) AS total_loan",
      "SUM(l.balance) AS balance"
    ])
    .where("l.user_id = :user_id", { user_id })
    .andWhere("l.is_active = 1")
    .groupBy("YEAR(l.start_date)")
    .orderBy("YEAR(l.start_date)", "ASC")
    .getRawMany<{ year: string, total_loan: string, balance: string }>()

  /* ============================
     Total pagado e intereses por año
  ============================ */
  const payment_rows = await payment_repo
    .createQueryBuilder('p')
    .innerJoin('p.loan', 'l')
    .select([
      "YEAR(l.start_date) AS year",
      "SUM(p.principal_paid) AS total_paid",
      "SUM(p.interest_paid) AS total_interest"
    ])
    .where("l.user_id = :user_id", { user_id })
    .andWhere("l.is_active = 1")
    .groupBy("YEAR(l.start_date)")
    .orderBy("YEAR(l.start_date)", "ASC")
    .getRawMany<{ year: string, total_paid: string, total_interest: string }>()

  /* ============================
     Normalización: asegurar todos los años
  ============================ */
  const labels: string[] = []
  const total_loan: number[] = []
  const total_paid: number[] = []
  const total_interest: number[] = []
  const balance: number[] = []

  years.forEach(y => {
    const loanRow = loan_rows.find(r => Number(r.year) === y)
    const payRow = payment_rows.find(r => Number(r.year) === y)

    labels.push(String(y))
    total_loan.push(loanRow ? Number(loanRow.total_loan) : 0)
    balance.push(loanRow ? Number(loanRow.balance) : 0)
    total_paid.push(payRow ? Number(payRow.total_paid) : 0)
    total_interest.push(payRow ? Number(payRow.total_interest) : 0)
  })

  return {
    labels,
    total_loan,
    total_paid,
    total_interest,
    balance
  }
}

/* ============================================================================
   KPIs globales (solo Transactions + Accounts)
============================================================================ */
export const getKpisGlobalBalance = async (auth_req: AuthRequest) => {
  const user_id = auth_req.user.id
  const transaction_repo = AppDataSource.getRepository(Transaction)
  const account_repo = AppDataSource.getRepository(Account)

  /* ============================
     Ingresos y egresos
  ============================ */
  const income_expense = await transaction_repo
    .createQueryBuilder('t')
    .select([
      "SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) AS income",
      "SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) AS expense"
    ])
    .where('t.user_id = :user_id', { user_id })
    .getRawOne()

  const total_income = Number(income_expense?.income || 0)
  const total_expense = Number(income_expense?.expense || 0)

  /* ============================
     Ahorros y retiros (TRANSFER)
     ahorro  = entra a saving
     retiro  = sale de saving
  ============================ */
  const savings_data = await transaction_repo
    .createQueryBuilder('t')
    .innerJoin('t.account', 'fromAcc')
    .leftJoin('t.to_account', 'toAcc')
    .select([
      "SUM(CASE WHEN t.type = 'transfer' AND toAcc.type = 'saving' THEN t.amount ELSE 0 END) AS savings",
      "SUM(CASE WHEN t.type = 'transfer' AND fromAcc.type = 'saving' THEN t.amount ELSE 0 END) AS withdrawals"
    ])
    .where('t.user_id = :user_id', { user_id })
    .getRawOne()

  const total_savings = Number(savings_data?.savings || 0)
  const total_withdrawals = Number(savings_data?.withdrawals || 0)

  /* ============================
     Cuentas activas
  ============================ */
  const accounts = await account_repo.find({
    where: { user: { id: user_id }, is_active: true }
  })

  const net_worth = accounts.reduce(
    (sum, acc) => sum + Number(acc.balance),
    0
  )

  const available_savings = accounts
    .filter(a => a.type === 'saving')
    .reduce((sum, a) => sum + Number(a.balance), 0)

  /* ============================
     KPIs finales (7)
  ============================ */
  const net_balance = net_worth - available_savings

  const loan_repo = AppDataSource.getRepository(Loan)

  /* ============================
     KPIs Préstamos
  ============================ */
  const loan_data = await loan_repo
    .createQueryBuilder('l')
    .select([
      "SUM(l.total_amount) AS total_loan",
      "SUM(l.principal_paid) AS total_principal_paid",
      "SUM(l.interest_paid) AS total_interest_paid",
      "SUM(l.balance) AS total_loan_balance"
    ])
    .where('l.user_id = :user_id', { user_id })
    .getRawOne()

  const total_loan = Number(loan_data?.total_loan || 0)
  const total_principal_paid = Number(loan_data?.total_principal_paid || 0)
  const total_interest_paid = Number(loan_data?.total_interest_paid || 0)
  const total_loan_balance = Number(loan_data?.total_loan_balance || 0)

  return {
    total_income,
    total_expense,
    total_savings,
    total_withdrawals,
    net_worth,
    available_savings,
    net_balance,
    total_loan,
    total_principal_paid,
    total_interest_paid,
    total_loan_balance
  }
}

export const getKpisLastYearBalance = async (auth_req: AuthRequest) => {
  const user_id = auth_req.user.id
  const timezone = auth_req.timezone ?? 'UTC'
  const transaction_repo = AppDataSource.getRepository(Transaction)
  const account_repo = AppDataSource.getRepository(Account)
  const loan_repo = AppDataSource.getRepository(Loan)

  const fromDateUTC = DateTime.now()
    .setZone(timezone)
    .minus({ months: 12 })
    .toUTC()
    .toJSDate()

  /* ============================
     Ingresos y egresos
  ============================ */
  const income_expense = await transaction_repo
    .createQueryBuilder('t')
    .select([
      "SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) AS income",
      "SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) AS expense"
    ])
    .where('t.user_id = :user_id', { user_id })
    .andWhere('t.created_at >= :fromDate', { fromDate: fromDateUTC })
    .getRawOne()

  const total_income = Number(income_expense?.income || 0)
  const total_expense = Number(income_expense?.expense || 0)

  /* ============================
     Ahorros y retiros
  ============================ */
  const savings_data = await transaction_repo
    .createQueryBuilder('t')
    .innerJoin('t.account', 'fromAcc')
    .leftJoin('t.to_account', 'toAcc')
    .select([
      "SUM(CASE WHEN t.type = 'transfer' AND toAcc.type = 'saving' THEN t.amount ELSE 0 END) AS savings",
      "SUM(CASE WHEN t.type = 'transfer' AND fromAcc.type = 'saving' THEN t.amount ELSE 0 END) AS withdrawals"
    ])
    .where('t.user_id = :user_id', { user_id })
    .andWhere('t.created_at >= :fromDate', { fromDate: fromDateUTC })
    .getRawOne()

  const total_savings = Number(savings_data?.savings || 0)
  const total_withdrawals = Number(savings_data?.withdrawals || 0)

  /* ============================
     Cuentas activas (balance actual)
  ============================ */
  const accounts = await account_repo.find({
    where: { user: { id: user_id }, is_active: true }
  })

  const net_worth = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0)
  const available_savings = accounts.filter(a => a.type === 'saving').reduce((sum, a) => sum + Number(a.balance), 0)
  const net_balance = net_worth - available_savings

  /* ============================
     Préstamos
  ============================ */
  const loan_data = await loan_repo
    .createQueryBuilder('l')
    .select([
      "SUM(l.total_amount) AS total_loan",
      "SUM(l.principal_paid) AS total_principal_paid",
      "SUM(l.interest_paid) AS total_interest_paid",
      "SUM(l.balance) AS total_loan_balance"
    ])
    .where('l.user_id = :user_id', { user_id })
    .andWhere('l.created_at >= :fromDate', { fromDate: fromDateUTC })
    .getRawOne()

  const total_loan = Number(loan_data?.total_loan || 0)
  const total_principal_paid = Number(loan_data?.total_principal_paid || 0)
  const total_interest_paid = Number(loan_data?.total_interest_paid || 0)
  const total_loan_balance = Number(loan_data?.total_loan_balance || 0)

  return {
    total_income,
    total_expense,
    total_savings,
    total_withdrawals,
    net_worth,
    available_savings,
    net_balance,
    total_loan,
    total_principal_paid,
    total_interest_paid,
    total_loan_balance
  }
}


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/* ============================================================================
   Obtener todos los años disponibles
============================================================================ */
export const getAvailableYearsKpi = async (auth_req: AuthRequest): Promise<number[]> => {
  const years = await getHomeAvailableYearsKpiCache(auth_req)
  return years
}

export const getBalanceKpi = async (auth_req: AuthRequest) => {
  const rows = await getHomeBalanceKpiCache(auth_req)
  return rows
}

export const getTrendKpi = async (auth_req: AuthRequest) => {
  const rows = await getHomeTrendKpiCache(auth_req)
  return rows
}

export const getCashSummary = async (auth_req: AuthRequest) => {
  const rows = await getHomeCashFlowSummaryCache(auth_req)
  return rows
}

export const getLoanSummary = async (auth_req: AuthRequest) => {
  const rows = await getHomeLoanFlowSummaryCache(auth_req)
  return rows
}


 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\home\home.controller.ts
```
 
```ts
import bcrypt from 'bcryptjs'
import { Request, RequestHandler, Response } from 'express'
import { deleteAll } from '../../cache/cache-key.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { User } from '../../entities/User.entity'
import { send2FACode } from '../../services/send-2fa.service'
import { AuthRequest } from '../../types/auth-request'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'
import { getAvailableYearsKpi, getBalanceKpi, getCashSummary, getChartDataLast6MonthsBalance, getChartDataLast6YearsBalance, getChartDataLast6YearsLoan, getKpisGlobalBalance, getKpisLast6MonthsBalance, getLoanSummary, getTrendKpi } from './home.auxiliar'

export const routeToPageRoot = (req: Request, res: Response) => {
  if ((req.session as any)?.user_id) {
    return res.redirect('/home')
  }
  res.redirect('/login')
}

export const routeToPageLogin = (req: Request, res: Response) => {
  res.render('pages/login', { error: null })
}

export const routeToPageHome = async (req: Request, res: Response) => {
  const skip_login = process.env.NODE_SKIP_LOGIN === 'true'
  const user_id = skip_login ? 1 : (req.session as any)?.user_id
  if (!user_id) {
    return res.redirect('/login')
  }
  const user_repo = AppDataSource.getRepository(User)
  const user = await user_repo.findOneBy({ id: user_id })
  if (!user) {
    return res.redirect('/login')
  }
  res.render(
    'layouts/main',
    {
      title: 'Inicio',
      view: 'pages/home',
      USER_ID: user?.id || 'guest',
      user,
    })
}

export const apiForValidatingLogin = async (req: Request, res: Response) => {
  try {
    const selected_fields: (keyof User)[] = ['id', 'email', 'password_hash', 'name', 'created_at']
    const timezone = String(req.body.timezone || 'UTC')
    /* ============================
       Modo Skip Login (Desarrollo)
       Si existe la variable de entorno NODE_SKIP_LOGIN=true, se omite la validación de usuario y contraseña.
       Se busca un usuario de desarrollo por ID (definido en DEV_USER_ID) y se inicia sesión con ese usuario.
       Esto permite a los desarrolladores saltarse el proceso de login durante el desarrollo.
    ============================ */
    if (process.env.NODE_SKIP_LOGIN === 'true') {
      const user_repo = AppDataSource.getRepository(User)
      const dev_user = await user_repo.findOne({
        where: { id: Number(process.env.DEV_USER_ID) || 1 },
        select: selected_fields
      })
      if (dev_user) {
        (req.session as any).user_id = dev_user.id;
        (req.session as any).timezone = timezone
        return res.redirect('/home')
      }
    }
    /* ============================
       Login Produccion
    ============================ */
    const { username, password } = req.body
    const user_repo = AppDataSource.getRepository(User)
    const user = await user_repo.findOne({
      where: { name: username },
      select: selected_fields
    })
    if (!user) {
      return res.render('pages/login', { error: 'Usuario no encontrado' })
    }
    const valid_password = await bcrypt.compare(password, user.password_hash)
    if (!valid_password) {
      return res.render('pages/login', { error: 'Contraseña incorrecta' })
    }
    /* ============================
       Guardar timezone en sesión
    ============================ */
    (req.session as any).timezone = timezone
    /* ============================
       Enviar código 2FA y guardar usuario pendiente
    ============================ */
    await send2FACode(user);
    (req.session as any).pending2FAUserId = user.id
    /* ============================
       Persistir sesión
    ============================ */
    await new Promise<void>((resolve, reject) => {
      req.session.save(err => {
        if (err) reject(err)
        else resolve()
      })
    })
    return res.redirect('/2fa')
  } catch (error: any) {
    logger.error(`${apiForValidatingLogin.name}-Error.`, parseError(error))
    return res.render('pages/login', { error: 'Error interno, intenta de nuevo' })
  } finally {
  }
}

export const apiForGettingKpis: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  try {
    const availableYearsKpi = await getAvailableYearsKpi(auth_req)
    const balanceKpi = await getBalanceKpi(auth_req)
    const trendKpi = await getTrendKpi(auth_req)
    res.json({
      availableYearsKpi,
      balanceKpi,
      trendKpi,
    })
  } catch (error) {
    logger.error('Error en apiForGettingKpis:', parseError(error))
    res.json({ message: 'Error' })
  }
}

export const apiForGettingCashSummary: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  try {
    const availableYearsKpi = await getAvailableYearsKpi(auth_req)
    const cashSummary = await getCashSummary(auth_req)
    res.json({
      availableYearsKpi,
      cashSummary,
    })
  } catch (error) {
    logger.error('Error en apiForGettingCashSummary:', parseError(error))
    res.json({ message: 'Error' })
  }
}

export const apiForGettingLoanSummary: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  try {
    const availableYearsKpi = await getAvailableYearsKpi(auth_req)
    const loanSummary = await getLoanSummary(auth_req)
    res.json({
      availableYearsKpi,
      loanSummary,
    })
  } catch (error) {
    logger.error('Error en apiForGettingLoanSummary:', parseError(error))
    res.json({ message: 'Error' })
  }
}

export const apiForLogout: RequestHandler = async (req: Request, res: Response) => {
  try {
    req.session.destroy(err => {
      if (err) {
        logger.error('Error destroying session:', err)
        return res.redirect('/home')
      }

      deleteAll(req as AuthRequest, 'home')
      res.clearCookie('connect.sid')
      return res.redirect('/login')
    })
  } catch (error) {
    logger.error('Logout error:', parseError(error))
    return res.redirect('/login')
  }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\payable\payable.controller.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express'
import { getActiveAccounts } from '../../cache/cache-accounts.service'
import { getPayableById, getPayablesForApi } from '../../cache/cache-payables.service'
import { loanFormMatrix } from '../../policies/loan-form.policy'
import { getNextValidTransactionDate } from '../../services/next-valid-trx-date.service'
import { getActiveCategoriesForLoansByUser, getActiveParentLoansByUser } from '../../services/populate-items.service'
import { AuthRequest } from "../../types/auth-request"
import { BaseFormViewParams } from '../../types/form-view-params'
import { formatDateForInputLocal } from '../../utils/date.util'
import { logger } from "../../utils/logger.util"
import { parseError } from '../../utils/error.util'
export { saveLoan as apiForSavingLoan } from './payable.saving'

type PayableFormViewParams = BaseFormViewParams & {
  payable: any
}

const renderPayableForm = async (res: Response, params: PayableFormViewParams) => {
  const { title, view, payable, errors, mode, auth_req } = params
  const loan_form_policy = loanFormMatrix[mode]
  const disbursement_account_list = await getActiveAccounts(auth_req)
  const loan_group_list = await getActiveParentLoansByUser(auth_req)
  const active_income_category_list = await getActiveCategoriesForLoansByUser(auth_req)
  const category_id = auth_req.query.category_id || null
  const from = auth_req.query.from || null
  return res.render('layouts/main', {
    title,
    view,
    errors,
    mode,
    auth_req,
    payable,
    loan_form_policy,
    disbursement_account_list,
    active_income_category_list,
    loan_group_list,
    context: { category_id, from },
  })
}

export const routeToPagePayable: RequestHandler = (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  res.render(
    'layouts/main', {
    title: 'Cuentas por Pagar',
    view: 'pages/loans/index',
    disbursement_account: [],
    USER_ID: auth_req.user?.id || 'guest'
  })
}

export const routeToFormInsertPayable: RequestHandler = async (req, res) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const default_date = await getNextValidTransactionDate(auth_req)
  return renderPayableForm(res, {
    title: 'Insertar Cuenta por Pagar',
    view: 'pages/loans/form',
    errors: {},
    auth_req,
    mode,
    payable: {
      start_date: formatDateForInputLocal(default_date, timezone),
      total_amount: '0.00',
      transaction: null,
      disbursement_account: null,
      category: null,
      loan_group: null,
      is_active: true,
    },
  })
}

export const routeToFormUpdatePayable: RequestHandler = async (req, res) => {
  const mode = 'update'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const payable_id = Number(req.params.id)
  const payable = await getPayableById(auth_req, payable_id)
  if (!payable) {
    return res.redirect('/payables')
  }
  return renderPayableForm(res, {
    title: 'Editar Cuenta por Pagar',
    view: 'pages/loans/form',
    errors: {},
    mode,
    auth_req,
    payable: {
      ...payable,
      start_date: formatDateForInputLocal(payable.start_date, timezone),
    },
  })
}

export const routeToFormClonePayable: RequestHandler = async (req, res) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const payable_id = Number(req.params.id)
  const payable = await getPayableById(auth_req, payable_id)
  if (!payable) {
    return res.redirect('/payables')
  }
  const default_date = await getNextValidTransactionDate(auth_req)
  return renderPayableForm(res, {
    title: 'Insertar Cuenta por Pagar',
    view: 'pages/loans/form',
    errors: {},
    mode,
    auth_req,
    payable: {
      ...payable,
      start_date: formatDateForInputLocal(default_date, timezone),
    },
  })
}

export const routeToFormDeletePayable: RequestHandler = async (req, res) => {
  const mode = 'delete'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const payable_id = Number(req.params.id)
  const payable = await getPayableById(auth_req, payable_id)
  if (!payable) {
    return res.redirect('/payables')
  }
  return renderPayableForm(res, {
    title: 'Eliminar Cuenta por Pagar',
    view: 'pages/loans/form',
    errors: {},
    mode,
    auth_req,
    payable: {
      ...payable,
      start_date: formatDateForInputLocal(payable.start_date, timezone),
    },
  })
}

/*=================================================
Api para devolver el DTO Payable en JSON
==================================================*/
export const apiForGettingPayables: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  try {
    const result = await getPayablesForApi(auth_req)
    res.json(result)
  } catch (error) {
    logger.error(`${apiForGettingPayables.name}-Error. `, parseError(error))
    res.status(500).json({ error: 'Error al listar cuentas por pagar' })
  } finally {
  }
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\payable\payable.saving.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express';
import { DateTime } from 'luxon';
import { performance } from 'perf_hooks';
import { getAccountById, getActiveAccountsForDisbursement } from '../../cache/cache-accounts.service';
import { getActiveIncomeCategories, getCategoryById } from '../../cache/cache-categories.service';
import { deleteAll } from '../../cache/cache-key.service';
import { getActivePayableGroup, getPayableGroupById } from '../../cache/cache-payable-groups.service';
import { getPayableById } from '../../cache/cache-payables.service';
import { AppDataSource } from '../../config/typeorm.datasource';
import { Account } from '../../entities/Account.entity';
import { Category } from '../../entities/Category.entity';
import { Payable } from '../../entities/Payable.entity';
import { Transaction } from '../../entities/Transaction.entity';
import { loanFormMatrix } from '../../policies/loan-form.policy';
import { KpiCacheService } from '../../services/kpi-cache.service';
import { AuthRequest } from '../../types/auth-request';
import { LoanFormMode } from '../../types/form-view-params';
import { parseBoolean } from '../../utils/bool.util';
import { parseLocalDateToUTC } from '../../utils/date.util';
import { parseError } from '../../utils/error.util';
import { logger } from '../../utils/logger.util';
import { validateDeletePayable, validatePayable } from './payable.validator';

/* ============================
   Obtener título según el modo del formulario
============================ */
const getTitle = (mode: string) => {
  switch (mode) {
    case 'insert': return 'Insertar Cuenta por Pagar'
    case 'update': return 'Editar Cuenta por Pagar'
    case 'delete': return 'Eliminar Cuenta por Pagar'
    default: return 'Indefinido'
  }
}

/* ============================
   Sanitizar payload según policy
============================ */
const sanitizeByPolicy = (mode: LoanFormMode, body: any) => {
  const policy = loanFormMatrix[mode]
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
const buildPayableView = async (auth_req: AuthRequest, body: any) => {
  const loan_group_id = Number(body.loan_group_id)
  const disbursement_id = Number(body.disbursement_account_id)
  const category_id = Number(body.category_id)
  const loan_group = await getPayableGroupById(auth_req, loan_group_id)
  const disbursement = await getAccountById(auth_req, disbursement_id)
  const category = await getCategoryById(auth_req, category_id)

  return {
    ...body,
    is_active: parseBoolean(body.is_active),
    loan_group,
    disbursement,
    category
  }
}

/* ============================
    Obtener cuentas activas del usuario para mostrar en el formulario 
============================ */
export const saveLoan: RequestHandler = async (req: Request, res: Response) => {
  const start = performance.now()
  logger.info(`${saveLoan.name} called`, { body: req.body, param: req.params })
  const auth_req = req as AuthRequest
  const user_id = auth_req.user.id
  const mode: LoanFormMode = req.body.mode || 'insert'
  const timezone = auth_req.timezone || 'UTC'
  const loan_id = Number(req.body.id)
  const loan_group_id = Number(req.body.loan_group_id)
  const disbursement_id = Number(req.body.disbursement_account_id)
  const category_id = Number(req.body.category_id)
  const return_from = req.body.return_from
  const return_category_id = Number(req.body.return_category_id) || null

  const form_state = {
    payable: await buildPayableView(auth_req, req.body),
    loan_group_list: await getActivePayableGroup(auth_req),
    disbursement_account_list: await getActiveAccountsForDisbursement(auth_req),
    active_income_category_list: await getActiveIncomeCategories(auth_req),
    loan_form_policy: loanFormMatrix[mode],
    mode,
    context: { from: return_from, category_id: return_category_id }
  }

  const queryRunner = AppDataSource.createQueryRunner()
  await queryRunner.connect()
  await queryRunner.startTransaction()

  try {
    let existing: Payable | null = null
    if (loan_id) {
      existing = await getPayableById(auth_req, loan_id)
      if (!existing) throw new Error('Cuenta por Pagar no encontrada')
    }
    /* =========================
       DELETE
    ============================ */
    if (mode === 'delete') {
      if (!existing) throw new Error('Cuenta por Pagar no encontrada')
      const errors = await validateDeletePayable(auth_req, existing)
      if (errors) throw { validationErrors: errors }
      if (existing.disbursement_account) {
        const account = await getAccountById(auth_req, disbursement_id)
        if (!account) throw new Error('Cuenta de desembolso no encontrado')
        account.balance -= existing.total_amount
        await queryRunner.manager.save(account)
      }
      const transaction_id = existing.transaction?.id || null
      await queryRunner.manager.delete(Payable, existing.id)
      if (transaction_id) {
        await queryRunner.manager.delete(Transaction, transaction_id)
      }
      await queryRunner.commitTransaction()
      deleteAll(auth_req, 'payable')

      KpiCacheService
        .recalculateBalanceKPIByTransaction(auth_req, existing)
        .catch(error => logger.error(`${saveLoan.name}-Error recalculando KPI Balances`, parseError(error)))

      KpiCacheService
        .recalculateCategoryKPIByTransaction(auth_req, existing)
        .catch(error => logger.error(`${saveLoan.name}-Error recalculando KPI Categorías`, parseError(error)))

      if (return_from === 'categories' && return_category_id) {
        return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
      }
      return res.redirect('/payables')
    }
    /* =========================
       INSERT / UPDATE
    ============================ */
    let payable: Payable
    if (mode === 'insert') {
      const loan_group = await getPayableGroupById(auth_req, loan_group_id)
      const disbursement = await getAccountById(auth_req, disbursement_id)
      const category = await getCategoryById(auth_req, category_id)
      payable = queryRunner.manager.create(Payable, {
        user: { id: auth_req.user.id } as any,
        name: req.body.name,
        note: req.body.note,
        total_amount: 0,
        interest_paid: 0,
        balance: 0,
        start_date: parseLocalDateToUTC(req.body.start_date, timezone),
        loan_group: loan_group,
        disbursement_account: disbursement,
        category: category,
        is_active: true
      })
    } else {
      if (!existing) throw new Error('Cuenta por Pagar no encontrada')
      payable = existing
    }
    /*=================================
      Aplicar sanitización por policy
    =================================*/
    const clean = sanitizeByPolicy(mode, req.body)
    if (clean.name !== undefined) payable.name = clean.name
    if (clean.start_date !== undefined) payable.start_date = parseLocalDateToUTC(clean.start_date, timezone)
    if (clean.is_active !== undefined) payable.is_active = parseBoolean(clean.is_active)
    if (clean.note !== undefined) payable.note = clean.note
    if (clean.loan_group_id !== undefined) { payable.payable_group = await getPayableGroupById(auth_req, loan_group_id) }
    if (clean.disbursement_account_id !== undefined) { payable.disbursement_account = await getAccountById(auth_req, disbursement_id) }
    if (clean.category_id !== undefined) { payable.category = await getCategoryById(auth_req, category_id) }
    let new_account: Account | null = payable.disbursement_account || null
    let new_category: Category | null = payable.category || null
    let previous_amount = payable.total_amount
    let previous_balance = payable.balance
    if (clean.total_amount !== undefined) {
      const new_amount = Number(clean.total_amount)
      if (mode === 'insert') {
        payable.total_amount = new_amount
        payable.balance = new_amount
      } else {
        const paidAmount = previous_amount - previous_balance
        payable.total_amount = new_amount
        payable.balance = new_amount - paidAmount
      }
    }
    if (payable.balance === 0) {
      payable.is_active = false
    } else {
      payable.is_active = true
    }
    if (mode === 'insert') {
      if (!new_account) throw { code: 'DISBURSEMENT_REQUIRED' }
      if (!new_category) { throw { code: 'CATEGORY_NOT_FOUND' } }
      new_account.balance += payable.total_amount
      await queryRunner.manager.save(new_account)
      payable.disbursement_account = new_account
      payable.category = new_category
      const transaction = queryRunner.manager.create(Transaction, {
        user: { id: auth_req.user.id } as any,
        type: 'income',
        detailed_type: 'income_for_payable',
        amount: payable.total_amount,
        account: new_account,
        category: new_category,
        date: payable.start_date,
        description: payable.note || payable.name
      })
      await queryRunner.manager.save(transaction)
      payable.transaction = transaction
    } else {
      if (!payable.disbursement_account) { throw { code: 'DISBURSEMENT_NOT_FOUND' } }
      if (!new_account) throw { code: 'DISBURSEMENT_REQUIRED' }
      if (!new_category) { throw { code: 'CATEGORY_NOT_FOUND' } }
      const old_account = await getAccountById(auth_req, payable.disbursement_account.id)
      if (!old_account) throw { code: 'DISBURSEMENT_REQUIRED' }
      if (old_account.id === new_account.id) {
        const delta = payable.total_amount - previous_amount
        old_account.balance += delta
        await queryRunner.manager.save(old_account)
      } else {
        old_account.balance -= previous_amount
        new_account.balance += payable.total_amount
        await queryRunner.manager.save([old_account, new_account])
      }
      payable.disbursement_account = new_account
      if (payable.transaction?.id) {
        payable.transaction.amount = payable.total_amount
        payable.transaction.date = payable.start_date
        payable.transaction.description = payable.note || payable.name
        payable.transaction.account = new_account
        payable.transaction.category = new_category
        await queryRunner.manager.save(payable.transaction)
      }
    }
    const errors = await validatePayable(auth_req, payable)
    if (errors) throw { validationErrors: errors }
    /*=================================
      Guardar en base de datos y limpiar cache
    =================================*/
    await queryRunner.manager.save(payable)
    await queryRunner.commitTransaction()

    deleteAll(auth_req, 'payable')
    if (payable.transaction) {
      KpiCacheService
        .recalculateBalanceKPIByTransaction(auth_req, payable.transaction)        
        .catch(error => logger.error(`${saveLoan.name}-Error recalculando KPI Balance`, parseError(error)))

      KpiCacheService
        .recalculateCategoryKPIByTransaction(auth_req, payable.transaction)
        .catch(error => logger.error(`${saveLoan.name}-Error recalculando KPI Categorías`, parseError(error)))
    }

    if (return_from === 'categories' && return_category_id) {
      return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
    }
    return res.redirect('/loans')
  } catch (error: any) {
    /* ============================
       Manejo de errores
    ============================ */
    await queryRunner.rollbackTransaction()
    logger.error(`${saveLoan.name}-Error. `, { user_id: auth_req.user.id, loan_id, mode, error: parseError(error), })

    let validationErrors: Record<string, string> | null = null
    switch (error?.code) {
      case 'DISBURSEMENT_REQUIRED':
        validationErrors = { disbursement_account: 'Cuenta de desembolso requerida' }
        break
      case 'DISBURSEMENT_NOT_FOUND':
        validationErrors = { disbursement_account: 'Cuenta de desembolso actual no encontrada' }
        break
      case 'CATEGORY_NOT_FOUND':
        validationErrors = { category: 'Categoría seleccionada no encontrada' }
        break
      default:
        validationErrors = error?.validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
    }
    return res.render('layouts/main', {
      title: getTitle(mode),
      view: 'pages/loans/form',
      ...form_state,
      errors: validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
    })
  } finally {
    await queryRunner.release()
    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`${saveLoan.name}. user=[${user_id}], elapsedTime=[${duration_sec.toFixed(4)}]`)
  }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\payable\payable.validator.ts
```
 
```ts
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { getActiveAccountById } from '../../cache/cache-accounts.service'
import { getActiveCategoryById } from '../../cache/cache-categories.service'
import { getActivePayableGroupById } from '../../cache/cache-payable-groups.service'
import { getPayableById, getPayableByName } from '../../cache/cache-payables.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Payable } from '../../entities/Payable.entity'
import { PayablePayment } from '../../entities/PayablePayment.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validatePayable = async (auth_req: AuthRequest, payable: Payable): Promise<Record<string, string> | null> => {
  const user_id = auth_req.user.id
  const payable_instance = plainToInstance(Payable, payable)
  const errors = await validate(payable_instance)
  const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}
  // Validaciones class-validator
  const payment_repo = AppDataSource.getRepository(PayablePayment)
  // Nombre único por usuario
  if (payable.name && user_id) {
    const existing_by_name = await getPayableByName(auth_req, payable.name)
    if (existing_by_name && existing_by_name.id !== payable.id) field_errors.name = 'Ya existe un compromiso con este nombre'
  }
  // Monto total obligatorio y > 0
  if (payable.total_amount === undefined || payable.total_amount === null || Number(payable.total_amount) <= 0) {
    field_errors.total_amount = 'El monto total del compromiso debe ser mayor a cero'
  }
  // Cuenta de desembolso obligatoria
  if (!payable.disbursement_account || !payable.disbursement_account.id) {
    field_errors.disbursement_account = 'Debe seleccionar una cuenta de desembolso'
  } else {
    const account = await getActiveAccountById(auth_req, payable.disbursement_account.id)
    if (!account) field_errors.disbursement_account = 'La cuenta de desembolso no es válida o no pertenece al usuario'
  }
  // Validación categoría
  if (payable.category && payable.category.id) {
    const category = await getActiveCategoryById(auth_req, payable.category.id)
    if (!category) field_errors.category = 'La categoría no es válida o no pertenece al usuario'
  }
  // Grupo de compromiso obligatorio
  if (!payable.payable_group || !payable.payable_group.id) {
    field_errors.payable_group = 'Debe seleccionar un grupo de compromiso'
  } else {
    const payable_group = await getActivePayableGroupById(auth_req, payable.payable_group.id)
    if (!payable_group) field_errors.payable_group = 'El grupo de compromiso no es válido o no pertenece al usuario'
  }
  // Validaciones solo en edición
  if (payable.id) {
    const existing_payable = await getPayableById(auth_req, payable.id)
    if (!existing_payable) {
      field_errors.general = 'Compromiso no encontrado o no pertenece al usuario'
    } else {
      const payments = await payment_repo.find({ where: { payable: { id: payable.id } } })
      const totalPrincipalPaidCents = payments.reduce((sum, p) => sum + Math.round(Number(p.principal_paid) * 100), 0)
      const totalAmountCents = payable.total_amount !== undefined ? Math.round(Number(payable.total_amount) * 100) : 0
      // Validación modificación monto
      if (payable.total_amount !== undefined && Number(existing_payable.total_amount) !== Number(payable.total_amount)) {
        if (payments.length > 0) {
          if (!auth_req.role?.can_update_amount_payable) {
            field_errors.total_amount = 'No se puede modificar el monto total de una cuenta con pagar con pagos registrados'
          }
        } else {
          const now = new Date()
          const payable_date = new Date(existing_payable.start_date)
          const same_month = payable_date.getFullYear() === now.getFullYear() && payable_date.getMonth() === now.getMonth()
          if (!same_month) {
            if (!auth_req.role?.can_update_amount_payable) {
              field_errors.total_amount = 'No se puede modificar el monto de una cuenta con pagar de meses anteriores'
            }
          }
        }
      }
      // Validación cambio start_date
      if (payments.length > 0 && payable.start_date) {
        const normalizeToMinute = (date: Date | string) => {
          const d = new Date(date)
          d.setSeconds(0, 0)
          return d.getTime()
        }
        const existing_time = normalizeToMinute(existing_payable.start_date)
        const new_time = normalizeToMinute(payable.start_date)
        if (existing_time !== new_time) {
          if (!auth_req.role?.can_update_start_date_payable) {
            field_errors.start_date = 'No se puede modificar la fecha de inicio de una cuenta con pagar con pagos registrados'
          }
        }
      }
      // Validación capital pagado
      if (payable.total_amount !== undefined && totalAmountCents < totalPrincipalPaidCents) {
        field_errors.total_amount = 'El monto total no puede ser menor al capital ya pagado'
      }
      // No permitir cambiar usuario
      if (payable.user && payable.user.id !== existing_payable.user.id) {
        field_errors.user = 'No se puede cambiar el usuario de la cuenta'
      }
      // No permitir cambiar cuenta si hay pagos
      if (payments.length > 0) {
        const newAccId = payable.disbursement_account?.id || null
        const oldAccId = existing_payable.disbursement_account?.id || null
        if (newAccId !== oldAccId) {
          field_errors.disbursement_account = 'No se puede cambiar la cuenta de desembolso de una cuenta con pagar con pagos registrados'
        }
      }
    }
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeletePayable = async (auth_req: AuthRequest, payable: Payable): Promise<Record<string, string> | null> => {
  const field_errors: Record<string, string> = {}
  const payablePaymentRepo = AppDataSource.getRepository(PayablePayment)
  const paymentsCount = await payablePaymentRepo.count({
    where: { payable: { id: payable.id } }
  })
  if (paymentsCount > 0) field_errors.general = 'No se puede eliminar una cuenta con pagar con pagos registrados'
  return Object.keys(field_errors).length > 0 ? field_errors : null
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\payable-group\payable-group.controller.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express'
import { getPayableGroupById } from '../../cache/cache-payable-groups.service'
import { loanGroupFormMatrix } from '../../policies/loan-group-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { BaseFormViewParams } from '../../types/form-view-params'
export { savePayableGroup as apiForSavingPayableGroup } from './payable-group.saving'

type PayableGroupFormViewParams = BaseFormViewParams & {
    payable_group: any
}

const renderPayableGroupForm = async (res: Response, params: PayableGroupFormViewParams) => {
    const { title, view, payable_group, errors, mode, auth_req } = params
    const loan_group_form_policy = loanGroupFormMatrix[mode]
    return res.render('layouts/main', {
        title,
        view,
        errors,
        mode,
        auth_req,
        payable_group,
        loan_group_form_policy,
    })
}

export const routeToFormInsertPayableGroup: RequestHandler = async (req: Request, res: Response) => {
    const mode = 'insert'
    const auth_req = req as AuthRequest
    return renderPayableGroupForm(res, {
        title: 'Insertar Grupo de Préstamos',
        view: 'pages/loan-groups/form',
        errors: {},
        mode,
        auth_req,
        payable_group: {
            is_active: true
        },
    })
}

export const routeToFormUpdatePayableGroup: RequestHandler = async (req: Request, res: Response) => {
    const mode = 'update'
    const auth_req = req as AuthRequest
    const payable_group_id = Number(req.params.id)
    const payable_group = await getPayableGroupById(auth_req, payable_group_id)
    if (!payable_group) {
        return res.redirect('/loans')
    }
    return renderPayableGroupForm(res, {
        title: 'Editar Grupo de Préstamos',
        view: 'pages/loan-groups/form',
        errors: {},
        mode,
        auth_req,
        payable_group
    })
}

export const routeToFormDeletePayableGroup: RequestHandler = async (req: Request, res: Response) => {
    const mode = 'delete'
    const auth_req = req as AuthRequest
    const payable_group_id = Number(req.params.id)
    const payable_group = await getPayableGroupById(auth_req, payable_group_id)
    if (!payable_group) {
        return res.redirect('/loans')
    }
    return renderPayableGroupForm(res, {
        title: 'Eliminar Grupo de Préstamos',
        view: 'pages/loan-groups/form',
        errors: {},
        mode,
        auth_req,
        payable_group
    })
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\payable-group\payable-group.saving.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express'
import { performance } from 'perf_hooks';
import { deleteAll } from '../../cache/cache-key.service'
import { getPayableGroupById } from '../../cache/cache-payable-groups.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { PayableGroup } from '../../entities/PayableGroup.entity'
import { loanGroupFormMatrix } from '../../policies/loan-group-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { LoanGroupFormMode } from '../../types/form-view-params'
import { parseBoolean } from '../../utils/bool.util'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'
import { validateDeleteLoanGroup, validateLoanGroup } from './payable-group.validator'

/* ============================
   Obtener título según el modo del formulario
============================ */
const getTitle = (mode: string) => {
    switch (mode) {
        case 'insert': return 'Insertar Grupo de Cuentas por Pagar'
        case 'update': return 'Editar Grupo de Cuentas por Pagar'
        case 'delete': return 'Eliminar Grupo de Cuentas por Pagar'
        default: return 'Indefinido'
    }
}

/* ============================
   Sanitizar payload según policy
============================ */
const sanitizeByPolicy = (mode: LoanGroupFormMode, body: any) => {
    const policy = loanGroupFormMatrix[mode]
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
const buildPayableGroupView = (body: any, mode: PayableGroupFormMode) => {
    return {
        ...body,
        is_active: parseBoolean(body.is_active),
    }
}

/* ============================
   Renderizar formulario de categoría para Insertar, Editar, Eliminar o Cambiar Estado
============================ */
export const savePayableGroup: RequestHandler = async (req: Request, res: Response) => {
    const start = performance.now()
    logger.info(`${savePayableGroup.name} called`, { body: req.body, param: req.params })
    const auth_req = req as AuthRequest
    const user_id = auth_req.user.id
    const payable_group_id = Number(req.body.id)
    const mode: PayableGroupFormMode = req.body.mode || 'insert'
    const repo_payable_group = AppDataSource.getRepository(PayableGroup)
    const payable_group_view = buildPayableGroupView(req.body, mode)
    const form_state = {
        payable_group: payable_group_view,
        payable_group_form_policy: payableGroupFormMatrix[mode],
        mode
    }
    try {
        let existing: PayableGroup | null = null
        if (payable_group_id) {
            existing = await getPayableGroupById(auth_req, payable_group_id)
            if (!existing) throw new Error('Grupo de Cuentas por Pagar no encontrada')
        }
        /* =========================
           DELETE
        ============================ */
        if (mode === 'delete') {
            if (!existing) throw new Error('Grupo de Cuentas por Pagar no encontrada')
            const errors = await validateDeletePayableGroup(auth_req, existing)
            if (errors) throw { validationErrors: errors }
            await repo_payable_group.delete(existing.id)
            deleteAll(auth_req, 'payable_group')
            return res.redirect('/loans')
        }
        /* =========================
           INSERT / UPDATE
        ============================ */
        let payable_group: PayableGroup
        if (mode === 'insert') {
            payable_group = repo_payable_group.create({
                user: { id: auth_req.user.id } as any,
                name: req.body.name,
                is_active: true
            })
        } else {
            if (!existing) throw new Error('Grupo de Cuentas por Pagar no encontrada')
            payable_group = existing
        }
        /*=================================
          Aplicar sanitización por policy
        =================================*/
        const clean = sanitizeByPolicy(mode, req.body)

        if (clean.name !== undefined) payable_group.name = clean.name
        if (clean.is_active !== undefined) { payable_group.is_active = parseBoolean(clean.is_active) }
        const errors = await validatePayableGroup(auth_req, payable_group)
        if (errors) throw { validationErrors: errors }
        /*=================================
        Guardar en base de datos y limpiar cache
        =================================*/
        await repo_payable_group.save(payable_group)
        deleteAll(auth_req, 'payable_group')
        return res.redirect('/loans')
    } catch (error: any) {
        /* ============================
           Manejo de errores
        ============================ */
        logger.error(`${savePayableGroup.name}-Error. `, { user_id: auth_req.user.id, payable_group_id: payable_group_id, mode, error: parseError(error), })
        const validationErrors = error?.validationErrors || null
        return res.render('layouts/main', {
            title: getTitle(mode),
            view: 'pages/payable-groups/form',
            ...form_state,
            errors: validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
        })
    } finally {
        const end = performance.now()
        const duration_sec = (end - start) / 1000
        logger.debug(`${savePayableGroup.name}. user=[${user_id}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\payable-group\payable-group.validator.ts
```
 
```ts
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { getPayableGroupByName } from '../../cache/cache-payable-groups.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Payable } from '../../entities/Payable.entity'
import { PayableGroup } from '../../entities/PayableGroup.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validatePayableGroup = async (auth_req: AuthRequest, payable_group: PayableGroup): Promise<Record<string, string> | null> => {
  const payable_group_instance = plainToInstance(PayableGroup, payable_group)
  const errors = await validate(payable_group_instance)
  const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}
  // Nombre único por usuario
  if (payable_group.name) {
    const existing = await getPayableGroupByName(auth_req, payable_group.name)
    if (existing && existing.id !== payable_group.id) {
      field_errors.name = 'Ya existe un grupo de cuentas por pagar con este nombre'
    }
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeletePayableGroup = async (auth_req: AuthRequest, payable_group: PayableGroup): Promise<Record<string, string> | null> => {
  const user_id = auth_req.user.id
  const field_errors: Record<string, string> = {}
  const loan_repo = AppDataSource.getRepository(Payable)
  const loans_count = await loan_repo.count({
    where: {
      payable_group: { id: payable_group.id },
      user: { id: user_id }
    }
  })
  if (loans_count > 0) {
    field_errors.general = `No se puede eliminar el grupo porque tiene ${loans_count} préstamo(s) asociado(s)`
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\payable-payment\payable-payment.controller.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express'
import { getActiveAccounts } from '../../cache/cache-accounts.service'
import { getPayableById } from '../../cache/cache-payables.service'
import { getPaymentById, getPaymentsForApi } from '../../cache/cache-payable-payments.service'
import { AppDataSource } from "../../config/typeorm.datasource"
import { PayablePayment } from '../../entities/PayablePayment.entity'
import { paymentFormMatrix } from '../../policies/loan-payment-form.policy'
import { getNextValidTransactionDate } from '../../services/next-valid-trx-date.service'
import { getActiveCategoriesForPaymentsByUser } from '../../services/populate-items.service'
import { AuthRequest } from "../../types/auth-request"
import { BaseFormViewParams } from '../../types/form-view-params'
import { formatDateForInputLocal } from '../../utils/date.util'
import { parseError } from '../../utils/error.util'
import { logger } from "../../utils/logger.util"
export { savePayment as apiForSavingAccount } from './payable-payment.saving'

type PaymentFormViewParams = BaseFormViewParams & {
    payment: any
}

const renderPayablePaymentForm = async (res: Response, params: PaymentFormViewParams) => {
    const { title, view, payment, errors, mode, auth_req } = params
    const payment_form_policy = paymentFormMatrix[mode]
    const active_expense_category_list = await getActiveCategoriesForPaymentsByUser(auth_req)
    const account_list = await getActiveAccounts(auth_req)
    const payable_id = auth_req.params.payable_id || payment.loan?.id || null
    const category_id = auth_req.query.category_id || null
    const from = auth_req.query.from || null
    return res.render('layouts/main', {
        title,
        view,
        errors,
        mode,
        auth_req,
        payment,
        payment_form_policy,
        active_expense_category_list,
        account_list,
        payable_id,
        context: { category_id, from }
    })
}

export const routeToPagePayablePayment: RequestHandler = async (req, res) => {
    const auth_req = req as AuthRequest
    const payable_id = Number(req.params.id)
    const payable = await getPayableById(auth_req, payable_id)
    if (!payable) {
        return res.redirect('/payables')
    }
    res.render('layouts/main', {
        title: 'Pagos',
        view: 'pages/payable-payments/index',
        USER_ID: auth_req.user?.id || 'guest',
        PAYABLE_ID: payable_id,
        payable
    })
}

export const routeToFormInsertPayablePayment: RequestHandler = async (req, res) => {
    const mode = 'insert'
    const auth_req = req as AuthRequest
    const timezone = auth_req.timezone || 'UTC'
    const default_date = await getNextValidTransactionDate(auth_req)
    return renderPayablePaymentForm(res, {
        title: 'Insertar Pago',
        view: 'pages/payable-payments/form',
        errors: {},
        auth_req,
        mode,
        payment: {
            payment_date: formatDateForInputLocal(default_date, timezone),
            note: '',
            principal_paid: '0.00',
            interest_paid: '0.00',
            category: null,
            account: null,
        },
    })
}

export const routeToFormUpdatePayablePayment: RequestHandler = async (req, res) => {
    const mode = 'update'
    const auth_req = req as AuthRequest
    const timezone = auth_req.timezone || 'UTC'
    const payment_id = Number(req.params.id)
    const payment = await getPaymentById(auth_req, payment_id)
    if (!payment) {
        return res.redirect('/payments')
    }
    return renderPayablePaymentForm(res, {
        title: 'Editar Pago',
        view: 'pages/payable-payments/form',
        errors: {},
        mode,
        auth_req,
        payment: {
            ...payment,
            payment_date: formatDateForInputLocal(payment.payment_date, timezone)
        }
    })
}

export const routeToFormClonePayablePayment: RequestHandler = async (req, res) => {
    const mode = 'insert'
    const auth_req = req as AuthRequest
    const timezone = auth_req.timezone || 'UTC'
    const payment_id = Number(req.params.id)
    const payment = await getPaymentById(auth_req, payment_id)
    if (!payment) {
        return res.redirect('/payments')
    }
    const default_date = await getNextValidTransactionDate(auth_req)
    return renderPayablePaymentForm(res, {
        title: 'Insertar Pago',
        view: 'pages/payable-payments/form',
        errors: {},
        mode,
        auth_req,
        payment: {
            ...payment,
            payment_date: formatDateForInputLocal(default_date, timezone)
        }
    })
}

export const routeToFormDeletePayablePayment: RequestHandler = async (req, res) => {
    const mode = 'delete'
    const auth_req = req as AuthRequest
    const timezone = auth_req.timezone || 'UTC'
    const payment_id = Number(req.params.id)
    const payment = await getPaymentById(auth_req, payment_id)
    if (!payment) {
        return res.redirect('/payments')
    }
    return renderPaymentForm(res, {
        title: 'Eliminar Pago',
        view: 'pages/payable-payments/form',
        errors: {},
        mode,
        auth_req,
        payment: {
            ...payment,
            payment_date: formatDateForInputLocal(payment.payment_date, timezone)
        }
    })
}

/*=================================================
Api para devolver el DTO Payable en JSON
==================================================*/
export const apiForGettingPayments: RequestHandler = async (req: Request, res: Response) => {
    const auth_req = req as AuthRequest
    const payable_id = Number(req.params.payable_id)
    try {
        const payments = await getPaymentsForApi(auth_req, payable_id)
        res.json(payments)
    } catch (error) {
        logger.error(`${apiForGettingPayments.name}-Error. `, parseError(error))
        res.status(500).json({ error: 'Error al listar pagos' })
    } finally {
    }
}


 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\payable-payment\payable-payment.saving.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express';
import { DateTime } from 'luxon';
import { performance } from 'perf_hooks';
import { getAccountById, getActiveAccounts } from '../../cache/cache-accounts.service';
import { getCategoryById } from '../../cache/cache-categories.service';
import { deleteAll } from '../../cache/cache-key.service';
import { getLoanById } from '../../cache/cache-payables.service';
import { getPaymentById } from '../../cache/cache-payable-payments.service';
import { AppDataSource } from '../../config/typeorm.datasource';
import { Account } from '../../entities/Account.entity';
import { Payable } from '../../entities/Payable.entity';
import { PayablePayment } from '../../entities/PayablePayment.entity';
import { Transaction } from '../../entities/Transaction.entity';
import { paymentFormMatrix } from '../../policies/loan-payment-form.policy';
import { KpiCacheService } from '../../services/kpi-cache.service';
import { getNextPayablePaymentNumber } from '../../services/payable-payment-number.service';
import { getActiveCategoriesForPaymentsByUser } from '../../services/populate-items.service';
import { AuthRequest } from '../../types/auth-request';
import { PaymentFormMode } from '../../types/form-view-params';
import { parseBoolean } from '../../utils/bool.util';
import { parseLocalDateToUTC } from '../../utils/date.util';
import { parseError } from '../../utils/error.util';
import { logger } from '../../utils/logger.util';
import { validateDeletePayment, validateSavePayment } from './payable-payment.validator';

/* ============================
   Helpers
============================ */
const getTotal = (p: PayablePayment) => p.principal_paid + p.interest_paid

const applyLoanDelta = (payable: Payable, old_principal: number, new_principal: number) => {
    const delta = new_principal - old_principal
    payable.balance -= delta
}

const applyPrincipalDelta = (payable: Payable, old_principal: number, new_principal: number) => {
    const delta = new_principal - old_principal
    payable.principal_paid += delta
}

const applyInterestDelta = (payable: Payable, old_interest: number, new_interest: number) => {
    const delta = new_interest - old_interest
    payable.interest_paid += delta
}

const applyAccountDelta = (account: Account, old_total: number, new_total: number) => {
    const delta = new_total - old_total
    account.balance -= delta
}

/* ============================
   Obtener título según el modo del formulario
============================ */
const getTitle = (mode: string) => {
    switch (mode) {
        case 'insert': return 'Registrar Pago'
        case 'update': return 'Editar Pago'
        case 'delete': return 'Eliminar Pago'
        default: return 'Indefinido'
    }
}

/* ============================
   Sanitizar payload según policy
============================ */

const sanitizeByPolicy = (mode: PaymentFormMode, body: any) => {
    const policy = paymentFormMatrix[mode]
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
const buildPaymentView = async (auth_req: AuthRequest, body: any) => {
    const account_id = Number(body.account_id)
    const category_id = Number(body.category_id)
    const account = await getAccountById(auth_req, account_id)
    const category = await getCategoryById(auth_req, category_id)

    return {
        ...body,
        is_active: parseBoolean(body.is_active),
        account,
        category,
    }
}

/* ============================
   Controller
============================ */
export const savePayment: RequestHandler = async (req: Request, res: Response) => {
    const start = performance.now()
    logger.info(`${savePayment.name} called`, { body: req.body, param: req.params })
    const auth_req = req as AuthRequest
    const user_id = auth_req.user.id
    const timezone = auth_req.timezone || 'UTC'
    const payment_id = Number(req.body.id)
    const loan_id = Number(req.body.loan_id)
    const mode: PaymentFormMode = req.body.mode || 'insert'
    const return_from = req.body.return_from
    const return_category_id = Number(req.body.return_category_id) || null

    const form_state = {
        payment: await buildPaymentView(auth_req, req.body),
        loan_id,
        account_list: await getActiveAccounts(auth_req),
        active_expense_category_list: await getActiveCategoriesForPaymentsByUser(auth_req),
        payment_form_policy: paymentFormMatrix[mode],
        mode,
        context: { from: return_from || null, category_id: return_category_id || null }
    }

    const queryRunner = AppDataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
        if (!loan_id) throw new Error('Préstamo es requerido')

        const loanRepo = queryRunner.manager.getRepository(Loan)
        const paymentRepo = queryRunner.manager.getRepository(LoanPayment)
        const transactionRepo = queryRunner.manager.getRepository(Transaction)
        const accountRepo = queryRunner.manager.getRepository(Account)

        const loan = await getLoanById(auth_req, loan_id)
        if (!loan) throw new Error('Prestamo no encontrado')

        let existing: LoanPayment | null = null
        if (payment_id) {
            existing = await getPaymentById(auth_req, payment_id)
            if (!existing) throw new Error('Pago no encontrado')
        }
        /* =========================
           DELETE
        ============================ */
        if (mode === 'delete') {
            if (!existing) throw new Error('Pago no encontrado')
            const errors = await validateDeletePayment(auth_req, existing)
            if (errors) throw { validationErrors: errors }
            const total = getTotal(existing)
            loan.balance += existing.principal_paid
            loan.principal_paid -= existing.principal_paid
            loan.interest_paid -= existing.interest_paid
            if (loan.balance > 0) loan.is_active = true
            await loanRepo.save(loan)
            existing.account.balance += total
            await accountRepo.save(existing.account)
            await paymentRepo.delete(existing.id)

            if (existing.transaction) {
                await transactionRepo.delete(existing.transaction.id)
            }
            await queryRunner.commitTransaction()
            deleteAll(auth_req, 'payment')

            KpiCacheService
                .recalculateBalanceKPIByTransaction(auth_req, existing.transaction)
                .catch(error => logger.error(`${savePayment.name}-Error recalculando KPI Balance`, parseError(error)))

            KpiCacheService
                .recalculateCategoryKPIByTransaction(auth_req, existing.transaction)
                .catch(error => logger.error(`${savePayment.name}-Error recalculando KPI Categorías`, parseError(error)))

                if (return_from === 'categories' && return_category_id) {
                return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
            }
            return res.redirect(`/payments/${loan_id}/loan`)
        }
        /* =========================
           INSERT / UPDATE
        ============================ */
        const clean = sanitizeByPolicy(mode, req.body)

        const account_id = Number(clean.account_id)
        const account = await getAccountById(auth_req, account_id)
        if (!account) throw new Error('Cuenta es requerida')

        const category_id = Number(clean.category_id)
        const category = await getCategoryById(auth_req, category_id)
        if (!category) throw new Error('Categoría es requerida')

        let payment: LoanPayment
        let old_payment: LoanPayment | null = null
        let old_principal = 0
        let old_total = 0

        if (mode === 'insert') {
            const principal_paid = Number(clean.principal_paid || 0)
            const payment_number = principal_paid > 0 ? await getNextPaymentNumber(loan_id) : 0

            payment = paymentRepo.create({
                loan,
                account,
                category,
                payment_number,
                principal_paid: Number(clean.principal_paid || 0),
                interest_paid: Number(clean.interest_paid || 0),
                note: clean.note || '',
                payment_date: parseLocalDateToUTC(clean.payment_date, timezone)
            })
        } else {
            if (!existing) throw new Error('Pago no encontrado')
            old_payment = structuredClone(existing)
            old_principal = existing.principal_paid
            old_total = getTotal(existing)
            payment = existing
            if (clean.note !== undefined) payment.note = clean.note
            if (clean.principal_paid !== undefined) payment.principal_paid = Number(clean.principal_paid)
            if (clean.interest_paid !== undefined) payment.interest_paid = Number(clean.interest_paid)
            if (clean.payment_date !== undefined) payment.payment_date = parseLocalDateToUTC(clean.payment_date, timezone)
            payment.account = account
            payment.category = category
        }

        const errors = await validateSavePayment(auth_req, payment, old_payment)
        if (errors) throw { validationErrors: errors }

        /* =========================
           UPDATE LOAN
        ============================ */
        if (!old_payment) {
            loan.balance -= payment.principal_paid
            loan.principal_paid += payment.principal_paid
            loan.interest_paid += payment.interest_paid
        } else {
            applyLoanDelta(loan, old_principal, payment.principal_paid)
            applyPrincipalDelta(loan, old_principal, payment.principal_paid)
            applyInterestDelta(loan, old_payment.interest_paid, payment.interest_paid)
        }
        if (loan.balance <= 0) {
            loan.balance = 0
            loan.is_active = false
        } else {
            loan.is_active = true
        }
        await loanRepo.save(loan)

        /* =========================
           UPDATE ACCOUNT
        ============================ */
        const new_total = getTotal(payment)
        if (!old_payment) {
            account.balance -= new_total
        } else {
            applyAccountDelta(account, old_total, new_total)
        }
        await accountRepo.save(account)

        /* =========================
           TRANSACTION
        ============================ */
        let trx: Transaction
        if (old_payment?.transaction?.id) {
            trx = old_payment.transaction
            trx.amount = new_total
            trx.account = account
            trx.category = payment.category
            trx.date = payment.payment_date
            trx.description = payment.note
            trx.detailed_type = 'payment_for_loan'
        } else {
            trx = transactionRepo.create({
                user: { id: auth_req.user.id } as any,
                type: 'expense',
                detailed_type: 'payment_for_loan',
                amount: new_total,
                account,
                category: payment.category,
                date: payment.payment_date,
                description: payment.note
            })
        }

        await transactionRepo.save(trx)
        payment.transaction = trx
        await paymentRepo.save(payment)
        await queryRunner.commitTransaction()
        deleteAll(auth_req, 'payment')

        KpiCacheService
            .recalculateBalanceKPIByTransaction(auth_req, trx)
            .catch(error => logger.error(`${savePayment.name}-Error recalculando KPI Balance`, parseError(error)))

        KpiCacheService
            .recalculateCategoryKPIByTransaction(auth_req, trx)
            .catch(error => logger.error(`${savePayment.name}-Error recalculando KPI Categorías`, parseError(error)))

            if (return_from === 'categories' && return_category_id) {
            return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
        }
        return res.redirect(`/payments/${loan_id}/loan`)
    } catch (error: any) {
        /* ============================
            Manejo de errores
        ============================ */
        await queryRunner.rollbackTransaction()
        logger.error(`${savePayment.name}-Error.`, { user_id: auth_req.user.id, payment_id, loan_id, mode, error: parseError(error), })

        const validationErrors = error?.validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
        return res.render('layouts/main', {
            title: getTitle(mode),
            view: 'pages/loan-payments/form',
            ...form_state,
            errors: validationErrors
        })
    } finally {
        await queryRunner.release()
        const end = performance.now()
        const duration_sec = (end - start) / 1000
        logger.debug(`${savePayment.name}. user=[${user_id}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    }
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\payable-payment\payable-payment.validator.ts
```
 
```ts
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { getActiveCategoryById } from '../../cache/cache-categories.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { LoanPayment } from '../../entities/PayablePayment.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validateSavePayment = async (auth_req: AuthRequest, payment: LoanPayment, old_payment: LoanPayment | null): Promise<Record<string, string> | null> => {
    const payment_instance = plainToInstance(LoanPayment, payment)
    const errors = await validate(payment_instance)
    const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}

    const payment_repo = AppDataSource.getRepository(LoanPayment)
    // Validación monto principal
    let available_amount = payment.loan.balance
    if (old_payment) available_amount += old_payment.principal_paid
    if (payment.principal_paid > available_amount) {
        field_errors.principal_paid = 'El monto del capital supera el saldo pendiente del préstamo'
    }
    const total_payment = payment.principal_paid + payment.interest_paid
    if (total_payment <= 0) {
        field_errors.general = 'El monto total del pago (capital + intereses) debe ser mayor a cero'
    }
    // Detectar cambios contables
    let financial_change = false
    if (old_payment) {
        const principal_changed = payment.principal_paid !== old_payment.principal_paid
        const interest_changed = payment.interest_paid !== old_payment.interest_paid
        const new_date = payment.payment_date.getTime()
        const old_date = new Date(old_payment.payment_date).getTime()
        const date_changed = new_date !== old_date
        financial_change = principal_changed || interest_changed || date_changed
    }
    if (old_payment && financial_change) {
        const now = new Date()
        const payment_date = new Date(old_payment.payment_date)
        const same_month = payment_date.getFullYear() === now.getFullYear() && payment_date.getMonth() === now.getMonth()
        if (!same_month) {
            if (!auth_req.role?.can_update_date_payment) {
                field_errors.general = 'No se pueden modificar monto o fecha de pagos de meses anteriores'
            }
        }
    }
    // Validación categoría
    if (payment.category && payment.category.id) {
        const category = await getActiveCategoryById(auth_req, payment.category.id)
        if (!category) {
            field_errors.category = 'La categoría seleccionada no es válida'
        }
    }
    // Validación fecha del pago
    const last_payment = await payment_repo.findOne({ where: { loan: { id: payment.loan.id } }, order: { payment_date: 'DESC', id: 'DESC' } })
    if (last_payment && (!old_payment || last_payment.id !== old_payment.id) && payment.payment_date.getTime() < last_payment.payment_date.getTime()) {
        if (!auth_req.role?.can_update_date_payment) {
            field_errors.payment_date = 'La fecha del pago no puede ser anterior al último pago registrado'
        }
    }
    return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeletePayment = async (auth_req: AuthRequest, payment: LoanPayment): Promise<Record<string, string> | null> => {
    const field_errors: Record<string, string> = {}
    const now = new Date()
    const payment_date = new Date(payment.payment_date)
    // Validación mismo mes
    const same_month = payment_date.getFullYear() === now.getFullYear() && payment_date.getMonth() === now.getMonth()
    if (!same_month) {
        if (!auth_req.role?.can_update_date_payment) {
            field_errors.general = 'Solo se pueden eliminar pagos del mes en curso'
        }
    }
    // Validación último pago
    const payment_repo = AppDataSource.getRepository(LoanPayment)
    const last_payment = await payment_repo.findOne({
        where: { loan: { id: payment.loan.id } },
        order: { payment_date: 'DESC', id: 'DESC' }
    })
    if (!last_payment || last_payment.id !== payment.id) {
        field_errors.general = 'Solo se puede eliminar el último pago registrado del préstamo'
    }
    return Object.keys(field_errors).length > 0 ? field_errors : null
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\transaction\batch-categorize.controller.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express';
import { In } from 'typeorm';
import { getActiveExpenseCategories, getActiveIncomeCategories } from '../../cache/cache-categories.service';
import { AppDataSource } from '../../config/typeorm.datasource';
import { Category } from '../../entities/Category.entity';
import { Transaction } from '../../entities/Transaction.entity';
import { AuthRequest } from '../../types/auth-request';
import { logger } from '../../utils/logger.util';
import { parseError } from '../../utils/error.util';
import { deleteAll } from '../../cache/cache-key.service';

export const apiForGettingCategorizeTransactions: RequestHandler = async (req: Request, res: Response) => {
    const auth_req = req as AuthRequest;
    const ids_raw = String(req.query.ids || '');
    const ids = ids_raw.split(',').map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0);
    const return_from = req.query.from as string | undefined
    const return_category_id = req.query.category_id ? Number(req.query.category_id) : null

    if (!ids.length) { return res.redirect('/transactions') }

    const active_income_categories = await getActiveIncomeCategories(auth_req)
    const active_expense_categories = await getActiveExpenseCategories(auth_req)

    const repo_transaction = AppDataSource.getRepository(Transaction);
    const transactions = await repo_transaction.find({
        where: {
            id: In(ids),
            type: In(['income', 'expense']),
            user: { id: auth_req.user.id }
        },
        relations: {
            category: true, loan: true, loan_payment: true
        },
        select: {
            id: true, type: true, amount: true, date: true, description: true,
            category: {
                id: true, name: true
            }
        }
    })

    const has_income = transactions.some(t => t.type === 'income')
    const has_expense = transactions.some(t => t.type === 'expense')

    res.render(
        'layouts/main',
        {
            title: 'Categorizar Transacciones',
            view: 'pages/transactions/batch-categorize',
            active_income_categories,
            active_expense_categories,
            transactions,
            has_income,
            has_expense,
            USER_ID: auth_req.user?.id || 'guest',
            context: {
                from: return_from || null,
                category_id: return_category_id || null
            },
        }
    )
}

export const apiForBatchCategorize: RequestHandler = async (req: Request, res: Response) => {
    const auth_req = req as AuthRequest
    const user_id = auth_req.user.id
    const return_from = req.body.return_from
    const return_category_id = req.body.return_category_id ? Number(req.body.return_category_id) : null

    try {
        const { income_category_id, expense_category_id, income_ids = '[]', expense_ids = '[]' } = req.body

        // Parse JSON strings to arrays
        const income_ids_arr = typeof income_ids === 'string' ? JSON.parse(income_ids) : income_ids
        const expense_ids_arr = typeof expense_ids === 'string' ? JSON.parse(expense_ids) : expense_ids

        const all_ids = [...income_ids_arr, ...expense_ids_arr]
        if (!all_ids.length) {
            throw new Error('No se proporcionaron transacciones para categorizar')
        }

        /* ============================================================
        1. Re-cargar categorías activas (para re-render en caso error)
        ============================================================ */
        /*const active_categories = await getActiveCategoriesByUser(auth_req)
        const { active_income_categories, active_expense_categories } = splitCategoriesByType(active_categories)*/

        const active_income_categories = await getActiveIncomeCategories(auth_req)
        const active_expense_categories = await getActiveExpenseCategories(auth_req)

        /* ============================================================
        2. Re-cargar transacciones seleccionadas
        ============================================================ */
        const repo_transaction = AppDataSource.getRepository(Transaction)

        const transactions = await repo_transaction.find({
            where: { id: In(all_ids), type: In(['income', 'expense']), user: { id: user_id } },
            relations: { category: true },
            select: { id: true, type: true, amount: true, date: true, description: true, category: { id: true, name: true } }
        })

        const has_income = transactions.some(t => t.type === 'income')
        const has_expense = transactions.some(t => t.type === 'expense')

        /* ============================================================
        3. Validaciones de consistencia
        ============================================================ */
        if (income_ids_arr.length && !income_category_id) {
            throw new Error('Debe seleccionar categoría de ingresos')
        }

        if (expense_ids_arr.length && !expense_category_id) {
            throw new Error('Debe seleccionar categoría de gastos')
        }

        /* ============================================================
        4. Validar categorías pertenezcan al usuario
        ============================================================ */
        const categoryRepo = AppDataSource.getRepository(Category)

        if (income_category_id) {
            const incomeCategory = await categoryRepo.findOne({
                where: { id: income_category_id, user: { id: user_id } }
            })

            if (!incomeCategory) {
                throw new Error('Categoría de ingresos inválida')
            }
        }

        if (expense_category_id) {
            const expenseCategory = await categoryRepo.findOne({
                where: { id: expense_category_id, user: { id: user_id } }
            })

            if (!expenseCategory) {
                throw new Error('Categoría de gastos inválida')
            }
        }

        /* ============================================================
        5. Procesar actualización (SOLO category)
        ============================================================ */
        await AppDataSource.transaction(async manager => {
            if (income_ids_arr.length) {
                await manager
                    .createQueryBuilder()
                    .update(Transaction)
                    .set({ category: income_category_id })
                    .where('id IN (:...ids)', { ids: income_ids_arr })
                    .andWhere('user.id = :user_id', { user_id })
                    .andWhere('type = :type', { type: 'income' })
                    .execute()
            }


            if (expense_ids_arr.length) {
                await manager
                    .createQueryBuilder()
                    .update(Transaction)
                    .set({ category: expense_category_id })
                    .where('id IN (:...ids)', { ids: expense_ids_arr })
                    .andWhere('user.id = :user_id', { user_id })
                    .andWhere('type = :type', { type: 'expense' })
                    .execute()
            }

        })

        deleteAll(auth_req, 'transaction')
        /* ============================================================
        6. Redirigir si todo correcto
        ============================================================ */
        if (return_from === 'categories' && return_category_id) {
            return res.redirect(
                `/transactions?category_id=${return_category_id}&from=categories&saved_batch=true`
            )
        }
        return res.redirect('/transactions?saved_batch=true')

    } catch (error) {
        logger.error(`${apiForBatchCategorize.name} - Error`, parseError(error))

        const active_income_categories = await getActiveIncomeCategories(auth_req)
        const active_expense_categories = await getActiveExpenseCategories(auth_req)

        return res.status(500).render('layouts/main', {
            title: 'Categorizar Transacciones',
            view: 'pages/transactions/batch-categorize',
            active_income_categories,
            active_expense_categories,
            transactions: [],
            has_income: false,
            has_expense: false,
            errors: { general: 'Error interno del servidor' },
            USER_ID: auth_req.user?.id
        })
    }

}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\transaction\transaction.auxiliar.ts
```
 
```ts
import { AppDataSource } from '../../config/typeorm.datasource'
import { Category } from '../../entities/Category.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/auth-request'
import { DateTime } from 'luxon'

type SplitCategoriesResult = {
  active_income_categories: Category[]
  active_expense_categories: Category[]
}

export const splitCategoriesByType = (categories: Category[]): SplitCategoriesResult => {
  const active_income_categories: Category[] = []
  const active_expense_categories: Category[] = []

  categories.forEach(category => {
    if (category.type === 'income') {
      active_income_categories.push(category)
    }

    if (category.type === 'expense') {
      active_expense_categories.push(category)
    }
  })

  return {
    active_income_categories,
    active_expense_categories
  }
}

export const calculateTransactionDeltas = (transaction: Transaction, factor: 1 | -1): Map<number, number> => {
  const deltas = new Map<number, number>()
  const amount = Number(transaction.amount)

  const addDelta = (accountId?: number, value?: number) => {
    if (!accountId || !value) return
    const prev = deltas.get(accountId) || 0
    deltas.set(accountId, prev + value)
  }

  if (transaction.type === 'income' && transaction.account?.id) {
    addDelta(transaction.account.id, amount * factor)
  }

  if (transaction.type === 'expense' && transaction.account?.id) {
    addDelta(transaction.account.id, -amount * factor)
  }

  if (transaction.type === 'transfer') {
    if (transaction.account?.id) {
      addDelta(transaction.account.id, -amount * factor)
    }
    if (transaction.to_account?.id) {
      addDelta(transaction.to_account.id, amount * factor)
    }
  }
  return deltas
}

export const buildReturnUrl = (from?: string, category_id?: number | null, extraParams?: Record<string, string>) => {
  const params = new URLSearchParams()

  if (from === 'categories' && category_id) {
    params.set('category_id', String(category_id))
    params.set('from', 'categories')
  }

  if (extraParams) {
    for (const key in extraParams) {
      params.set(key, extraParams[key])
    }
  }

  return `/transactions${params.toString() ? `?${params}` : ''}`
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\transaction\transaction.controller.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express'
import { getActiveAccounts, getActiveAccountsForTransfer, getActiveAccountsForTransferIncludeCurrentAccount, getActiveAccountsIncludeCurrentAccount } from '../../cache/cache-accounts.service'
import { getActiveCategoryById, getActiveExpenseCategories, getActiveExpenseCategoriesIncludeCurrentCategory, getActiveIncomeCategories, getActiveIncomeCategoriesIncludeCurrentCategory, getCategoryById } from '../../cache/cache-categories.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Transaction } from '../../entities/Transaction.entity'
import { transactionFormMatrix } from '../../policies/transaction-form.policy'
import { getNextValidTransactionDate } from '../../services/next-valid-trx-date.service'
import { AuthRequest } from '../../types/auth-request'
import { BaseFormViewParams } from '../../types/form-view-params'
import { formatDateForInputLocal } from '../../utils/date.util'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'
import { validateActiveCategoryTransaction } from './transaction.validator'
export { saveTransaction as apiForSavingTransaction } from './transaction.saving'

type TransactionFormViewParams = BaseFormViewParams & {
  transaction: any
}

const renderTransactionForm = async (res: Response, params: TransactionFormViewParams) => {
  const { title, view, transaction, errors, mode, auth_req } = params

  const transaction_form_policy = transactionFormMatrix[mode]
  const active_accounts = await getActiveAccountsIncludeCurrentAccount(auth_req, transaction?.account?.id)
  const active_accounts_for_transfer = await getActiveAccountsForTransferIncludeCurrentAccount(auth_req, transaction?.account?.id)
  const active_income_categories = await getActiveIncomeCategoriesIncludeCurrentCategory(auth_req, transaction?.category?.id)
  const active_expense_categories = await getActiveExpenseCategoriesIncludeCurrentCategory(auth_req, transaction?.category?.id)

  const category_id = auth_req.query.category_id || null
  const from = auth_req.query.from || null

  return res.render(
    'layouts/main',
    {
      title,
      view,
      errors,
      mode,
      auth_req,
      transaction,
      transaction_form_policy,
      active_accounts,
      active_accounts_for_transfer,
      active_income_categories,
      active_expense_categories,
      context: { category_id, from },
    }
  )
}

export const apiForGettingTransactions: RequestHandler = async (req: Request, res: Response) => {
  try {
    const auth_req = req as AuthRequest
    const page = Number(auth_req.query.page) || 1
    const limit = Number(auth_req.query.limit) || 10
    const search = (auth_req.query.search as string) || ''
    const skip = (page - 1) * limit
    const user_id = auth_req.user.id
    const category_id = Number(auth_req.query.category_id) || null

    const qb = AppDataSource
      .getRepository(Transaction)
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.account', 'account')
      .leftJoinAndSelect('t.to_account', 'to_account')
      .leftJoinAndSelect('t.category', 'category')
      .leftJoinAndSelect('t.loan', 'loan')
      .leftJoinAndSelect('t.loan_payment', 'loan_payment')
      .leftJoinAndSelect('loan_payment.loan', 'paymentLoan')
      .leftJoinAndSelect('paymentLoan.category', 'paymentLoanCategory')
      .where('t.user_id = :user_id', { user_id })

    if (category_id) {
      qb.andWhere('category.id = :category_id', { category_id })
    }

    if (search) {
      qb.andWhere(
        `(
          t.type LIKE :search OR
          account.name LIKE :search OR
          to_account.name LIKE :search OR
          category.name LIKE :search OR
          t.description LIKE :search 
        )`,
        { search: `%${search.toLowerCase()}%` }
      )
    }

    const [items, total] = await qb
      .orderBy('t.date', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount()

    res.json({ items, total, page, limit, category_id: category_id })
  } catch (error) {
    logger.error(`${apiForGettingTransactions.name}-Error. `, parseError(error))
    res.status(500).json({ error: 'Error al listar transacciones' })
  } finally {
  }
}

export const routeToPageTransaction: RequestHandler = (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const category_id = req.query.category_id || null
  const from = req.query.from || null
  const saved_batch = req.query.saved_batch === 'true'
  const timezone = auth_req.timezone || 'UTC'
  res.render(
    'layouts/main',
    {
      title: 'Transacciones',
      view: 'pages/transactions/index',
      active_income_categories: [],
      active_expense_categories: [],
      USER_ID: auth_req.user?.id || 'guest',
      TIMEZONE: timezone,
      context: {
        from,
        category_id: category_id,
        saved_batch
      },
    })
}

export const routeToFormInsertTransaction: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'

  const default_date = await getNextValidTransactionDate(auth_req)
  return renderTransactionForm(res, {
    title: 'Insertar Transacción',
    view: 'pages/transactions/form',
    errors: {},
    mode,
    auth_req,
    transaction: {
      date: formatDateForInputLocal(default_date, timezone),
      amount: '0.00',
    },
  })
}

export const routeToFormUpdateTransaction: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'update'
  const auth_req = req as AuthRequest
  const transaction_id = Number(req.params.id)
  const timezone = auth_req.timezone || 'UTC'
  const repo_transaction = AppDataSource.getRepository(Transaction)
  const transaction = await repo_transaction.findOne({
    where: { id: transaction_id, user: { id: auth_req.user.id } },
    relations: { account: true, to_account: true, category: true }
  })
  if (!transaction) {
    return res.redirect('/transactions')
  }
  return renderTransactionForm(res, {
    title: 'Editar Transacción',
    view: 'pages/transactions/form',
    errors: {},
    mode,
    auth_req,
    transaction: {
      ...transaction,
      date: formatDateForInputLocal(transaction.date, timezone),
    },
  })
}

export const routeToFormCloneTransaction: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  const transaction_id = Number(req.params.id)
  const timezone = auth_req.timezone || 'UTC'
  const repo_transaction = AppDataSource.getRepository(Transaction)
  const transaction = await repo_transaction.findOne({
    where: { id: transaction_id, user: { id: auth_req.user.id } },
    relations: { account: true, to_account: true, category: true }
  })
  if (!transaction) {
    return res.redirect('/transactions')
  }
  const default_date = await getNextValidTransactionDate(auth_req)
  const category_errors = await validateActiveCategoryTransaction(transaction, auth_req)
  const errors = category_errors ? category_errors : {}
  return renderTransactionForm(res, {
    title: 'Insertar Transacción',
    view: 'pages/transactions/form',
    errors,
    mode,
    auth_req,
    transaction: {
      ...transaction,
      date: formatDateForInputLocal(default_date, timezone),
      description: transaction.description ?? ''
    },
  })
}

export const routeToFormDeleteTransaction: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'delete'
  const auth_req = req as AuthRequest
  const transaction_id = Number(req.params.id)
  const timezone = auth_req.timezone || 'UTC'
  const repo_transaction = AppDataSource.getRepository(Transaction)
  const transaction = await repo_transaction.findOne({
    where: { id: transaction_id, user: { id: auth_req.user.id } },
    relations: { account: true, to_account: true, category: true }
  })
  if (!transaction) {
    return res.redirect('/transactions')
  }
  return renderTransactionForm(res, {
    title: 'Eliminar Transacción',
    view: 'pages/transactions/form',
    errors: {},
    mode,
    auth_req: auth_req,
    transaction: {
      ...transaction,
      date: formatDateForInputLocal(transaction.date, timezone),
    },
  })
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\transaction\transaction.saving.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express';
import { performance } from 'perf_hooks';
import { getAccountById, getActiveAccounts, getActiveAccountsForTransfer } from '../../cache/cache-accounts.service';
import { getActiveExpenseCategories, getActiveIncomeCategories, getCategoryById } from '../../cache/cache-categories.service';
import { deleteAll } from '../../cache/cache-key.service';
import { AppDataSource } from '../../config/typeorm.datasource';
import { Account } from '../../entities/Account.entity';
import { Transaction } from '../../entities/Transaction.entity';
import { transactionFormMatrix } from '../../policies/transaction-form.policy';
import { KpiCacheService } from '../../services/kpi-cache.service';
import { AuthRequest } from '../../types/auth-request';
import { TransactionFormMode } from '../../types/form-view-params';
import { parseLocalDateToUTC } from '../../utils/date.util';
import { parseError } from '../../utils/error.util';
import { logger } from '../../utils/logger.util';
import { getSqlErrorMessage } from '../../utils/sql-err.util';
import { calculateTransactionDeltas } from '../transaction/transaction.auxiliar';
import { validateDeleteTransaction, validateSaveTransaction } from '../transaction/transaction.validator';

/* ============================
   Título según modo
============================ */
const getTitle = (mode: TransactionFormMode) => {
  switch (mode) {
    case 'insert': return 'Insertar Transacción'
    case 'update': return 'Editar Transacción'
    case 'delete': return 'Eliminar Transacción'
    default: return 'Indefinido'
  }
}

/* ============================
   Sanitizar payload según policy
============================ */
const sanitizeByPolicy = (mode: TransactionFormMode, body: any) => {
  const policy = transactionFormMatrix[mode]
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
const buildTransactionView = (auth_req: AuthRequest, body: any) => {
  return {
    ...body
  }
}

const isSavingAccount = (acc: Account | null | undefined): acc is Account & { type: 'saving' } => {
  return acc?.type === 'saving'
}

export const saveTransaction: RequestHandler = async (req: Request, res: Response) => {
  const start = performance.now()
  logger.info(`${saveTransaction.name} called`, { body: req.body, param: req.params })
  const auth_req = req as AuthRequest
  const user_id = auth_req.user.id
  const timezone = req.body.timezone || 'UTC'
  const mode: TransactionFormMode = req.body.mode || 'insert'
  const transaction_id = Number(req.body.id)
  const return_from = req.body.return_from
  const return_category_id = Number(req.body.return_category_id) || null


  const active_accounts = await getActiveAccounts(auth_req)
  const active_accounts_for_transfer = await getActiveAccountsForTransfer(auth_req)
  const active_income_categories = await getActiveIncomeCategories(auth_req)
  const active_expense_categories = await getActiveExpenseCategories(auth_req)

  const form_state = {
    transaction: buildTransactionView(auth_req, req.body),
    transaction_form_policy: transactionFormMatrix[mode],
    active_accounts,
    active_accounts_for_transfer,
    active_income_categories,
    active_expense_categories,
    mode,
    context: { from: return_from, category_id: return_category_id }
  }

  const query_runner = AppDataSource.createQueryRunner()
  await query_runner.connect()
  await query_runner.startTransaction()
  const repo_transaction = AppDataSource.getRepository(Transaction)

  try {
    let existing: Transaction | null = null
    if (transaction_id) {
      existing = await repo_transaction.findOne({
        where: { id: transaction_id, user: { id: auth_req.user.id } },
        relations: { account: true, to_account: true, category: true }
      })
      if (!existing) throw new Error('Transacción no encontrada')
    }

    /* ============================
       DELETE
    ============================ */
    if (mode === 'delete') {
      if (!existing) throw new Error('Transacción no encontrada')
      const errors = await validateDeleteTransaction(existing, auth_req)
      if (errors) throw { validationErrors: errors }
      const deltas = calculateTransactionDeltas(existing, -1)
      for (const [acc_id, delta] of deltas) {
        const acc = await query_runner.manager.findOne(Account, { where: { id: acc_id } })
        if (!acc) continue
        await query_runner.manager.update(Account, { id: acc_id }, {
          balance: Number(acc.balance) + delta
        })
      }

      await query_runner.manager.remove(Transaction, existing)
      await query_runner.commitTransaction()
      deleteAll(auth_req, 'transaction')

      KpiCacheService
        .recalculateBalanceKPIByTransaction(auth_req, existing)
        .catch(error => logger.error(`${saveTransaction.name}-Error recalculando KPI Balance`, parseError(error)))

      KpiCacheService
        .recalculateCategoryKPIByTransaction(auth_req, existing)
        .catch(error => logger.error(`${saveTransaction.name}-Error recalculando KPI Categorías`, parseError(error)))

        if (return_from === 'categories' && return_category_id) {
        return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
      }
      return res.redirect('/transactions')
    }

    /* ============================
       INSERT / UPDATE
    ============================ */
    let transaction: Transaction
    let previous_transaction: Transaction | undefined
    if (mode === 'insert') {
      transaction = repo_transaction.create({
        user: auth_req.user as any
      })
    } else {
      if (!existing) throw new Error('Transacción no encontrada')
      previous_transaction = Object.assign(new Transaction(), {
        type: existing.type,
        amount: existing.amount,
        account: existing.account,
        to_account: existing.to_account,
        category: existing.category
      })
      transaction = existing
    }
    /*=================================
      Aplicar sanitización por policy
    =================================*/
    const clean = sanitizeByPolicy(mode, req.body)
    if (clean.type !== undefined) { transaction.type = clean.type }
    if (clean.account !== undefined) { transaction.account = await getAccountById(auth_req, Number(clean.account)) }
    if (clean.to_account !== undefined) { transaction.to_account = await getAccountById(auth_req, Number(clean.to_account)) }
    if (clean.category !== undefined) { transaction.category = await getCategoryById(auth_req, Number(clean.category)) }
    if (clean.date) { transaction.date = parseLocalDateToUTC(clean.date, timezone) }
    if (clean.amount !== undefined) { transaction.amount = Number(clean.amount) }
    if (clean.description !== undefined) { transaction.description = clean.description }
    if (transaction.type === 'transfer') { transaction.category = null }
    if (transaction.type !== 'transfer') { transaction.to_account = null }

    // Determinar detailed_type basado en el tipo de transacción
    if (transaction.type === 'income') {
      transaction.detailed_type = 'income'
    } else if (transaction.type === 'expense') {
      transaction.detailed_type = 'expense'
    } else if (transaction.type === 'transfer') {
      const from_account = transaction.account
      const to_account = transaction.to_account
      const from_is_saving = from_account && isSavingAccount(from_account)
      const to_is_saving = to_account && isSavingAccount(to_account)
      if (to_is_saving && !from_is_saving) {
        transaction.detailed_type = 'saving'
      }
      else if (from_is_saving && !to_is_saving) {
        transaction.detailed_type = 'withdrawal'
      }
      else {
        transaction.detailed_type = 'transfer'
      }
    }

    const errors = await validateSaveTransaction(transaction, auth_req, previous_transaction)
    if (errors) throw { validationErrors: errors }
    const deltas = new Map<number, number>()
    const mergeDeltas = (map: Map<number, number>) => {
      for (const [acc_id, value] of map) {
        const prev = deltas.get(acc_id) || 0
        deltas.set(acc_id, prev + value)
      }
    }
    if (previous_transaction) {
      mergeDeltas(calculateTransactionDeltas(previous_transaction, -1))
    }
    const saved_transaction = await query_runner.manager.save(Transaction, transaction)
    mergeDeltas(calculateTransactionDeltas(saved_transaction, 1))
    for (const [acc_id, delta] of deltas) {
      const acc = await query_runner.manager.findOne(Account, { where: { id: acc_id } })
      if (!acc) continue
      await query_runner.manager.update(Account, { id: acc_id }, {
        balance: Number(acc.balance) + delta
      })
    }

    /*=================================
      Guardar en base de datos y limpiar cache
    =================================*/
    await query_runner.commitTransaction()
    deleteAll(auth_req, 'transaction')

    KpiCacheService
      .recalculateBalanceKPIByTransaction(auth_req, saved_transaction)
      .catch(error => logger.error(`${saveTransaction.name}-Error recalculando KPI Balance`, parseError(error)))

    KpiCacheService
      .recalculateCategoryKPIByTransaction(auth_req, saved_transaction)
      .catch(error => logger.error(`${saveTransaction.name}-Error recalculando KPI Categorías`, parseError(error)))

      if (return_from === 'categories' && return_category_id) {
      return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
    }
    return res.redirect('/transactions')

  } catch (error: any) {
    /* ============================
       Manejo de errores
    ============================ */
    await query_runner.rollbackTransaction()
    logger.error(`${saveTransaction.name}-Error. `, { user_id: auth_req.user.id, transaction_id, mode, error: parseError(error), })

    const validation_errors = error?.validationErrors || null
    return res.status(500).render('layouts/main', {
      title: getTitle(mode),
      view: 'pages/transactions/form',
      ...form_state,
      active_accounts_for_transfer,
      active_accounts,
      active_income_categories,
      active_expense_categories,
      context: { from: return_from, category_id: return_category_id },
      errors: validation_errors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.\n' + getSqlErrorMessage(error) }
    })
  } finally {
    await query_runner.release()
    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`${saveTransaction.name}. user=[${user_id}], elapsedTime=[${duration_sec.toFixed(4)}]`)
  }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\transaction\transaction.validator.ts
```
 
```ts
import { validate } from 'class-validator'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Account } from '../../entities/Account.entity'
import { Category } from '../../entities/Category.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/auth-request'
import { logger } from '../../utils/logger.util'

export const validateSaveTransaction = async (transaction: Transaction, auth_req: AuthRequest, old_transaction?: Transaction): Promise<Record<string, string> | null> => {
    const errors = await validate(transaction)
    const field_errors: Record<string, string> = {}

    if (errors.length > 0) {
        errors.forEach(err => {
            const message = err.constraints
                ? Object.values(err.constraints)[0]
                : err.children?.[0]?.constraints
                    ? Object.values(err.children[0].constraints)[0]
                    : null

            if (!message) return

            switch (err.property) {
                case 'account':
                    field_errors.account = message
                    break
                case 'to_account':
                    field_errors.to_account = message
                    break
                case 'description':
                    field_errors.description = message
                    break
                case 'category':
                    field_errors.category = message
                    break
                default:
                    field_errors.general = message
            }
        })
    }

    // Validación: la fecha debe ser del mes en curso o posterior
    if (transaction.date) {
        const now = new Date()
        const start_of_current_month = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
        if (transaction.date < start_of_current_month) {
            if (!auth_req.role?.can_update_date_transaction) {
                field_errors.date = 'La fecha debe ser del mes en curso o posterior'
            }
        }
    }

    // Validación: el monto debe ser mayor a cero
    if (transaction.amount === undefined || transaction.amount === null || Number(transaction.amount) <= 0) {
        field_errors.amount = 'El monto debe ser mayor a cero'
    }

    if (transaction.type === 'income' || transaction.type === 'expense') {
        if (!transaction.account) field_errors.account = 'Debe seleccionar una cuenta'
        if (!transaction.category) field_errors.category = 'Debe seleccionar una categoría'
        if (transaction.to_account) field_errors.to_account = 'Una transferencia no es válida para este tipo'
    }

    if (transaction.type === 'transfer') {
        if (!transaction.account) field_errors.account = 'Debe seleccionar una cuenta origen'
        if (!transaction.to_account) field_errors.to_account = 'Debe seleccionar una cuenta destino'
        if (transaction.category) field_errors.category = 'Una transferencia no lleva categoría'
    }

    // Validación: para egresos, la cuenta debe tener saldo disponible
    if (transaction.type === 'expense') {
        if (!transaction.account || !transaction.account.id) {
            field_errors.account = 'Cuenta requerida para egreso'
        } else {
            const accRepo = AppDataSource.getRepository(Account)
            const acc = await accRepo.findOne({ where: { id: transaction.account.id, user: { id: auth_req.user.id } } })
            const acc_balance = acc ? Number(acc.balance) : 0

            const new_amount = Number(transaction.amount)
            const old_amount = old_transaction ? Number(old_transaction.amount) : 0

            const is_same_amount = old_transaction && new_amount === old_amount
            if (!is_same_amount) {
                const effective_balance = acc_balance + old_amount
                if (effective_balance <= 0) {
                    field_errors.amount = 'No hay saldo disponible en la cuenta para realizar el egreso'
                } else if (new_amount > effective_balance) {
                    field_errors.amount = 'Saldo insuficiente en la cuenta para este egreso'
                }
            }
        }
    }

    // Validación: para transferencias, la cuenta origen debe tener saldo suficiente
    if (transaction.type === 'transfer') {
        if (!transaction.account || !transaction.account.id) {
            field_errors.account = 'Cuenta origen requerida para transferencia'
        }
        if (!transaction.to_account || !transaction.to_account.id) {
            field_errors.to_account = 'Cuenta destino requerida para transferencia'
        }
        if (transaction.account && transaction.to_account && transaction.account.id === transaction.to_account.id) {
            field_errors.to_account = 'La cuenta destino debe ser distinta a la cuenta origen'
        }

        if (transaction.account && transaction.account.id) {
            const accRepo = AppDataSource.getRepository(Account)
            const acc = await accRepo.findOne({ where: { id: transaction.account.id, user: { id: auth_req.user.id } } })
            const acc_balance = acc ? Number(acc.balance) : 0

            const new_amount = Number(transaction.amount)
            const old_amount = old_transaction ? Number(old_transaction.amount) : 0
            const is_same_amount = old_transaction && new_amount === old_amount

            if (!is_same_amount) {
                const effective_balance = acc_balance + old_amount
                if (effective_balance <= 0) {
                    field_errors.amount = 'No hay saldo disponible en la cuenta origen para realizar la transferencia'
                } else if (new_amount > effective_balance) {
                    field_errors.amount = 'Saldo insuficiente en la cuenta origen para esta transferencia'
                }
            }
        }
    }
    logger.debug(`${validateSaveTransaction.name}-Errors: ${JSON.stringify(field_errors)}`)
    return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeleteTransaction = async (transaction: Transaction, auth_req: AuthRequest): Promise<Record<string, string> | null> => {
    const field_errors: Record<string, string> = {}

    if (!transaction.date) {
        field_errors.general = 'La transacción no tiene fecha registrada'
    } else {
        const transaction_date = new Date(transaction.date)
        const now = new Date()

        if (transaction_date.getFullYear() < now.getFullYear() || (transaction_date.getFullYear() === now.getFullYear() && transaction_date.getMonth() < now.getMonth())) {
            if (!auth_req.role?.can_delete_transaction) {
                field_errors.general = 'No se puede eliminar transacciones de meses anteriores'
            }
        }
    }

    logger.debug(`${validateDeleteTransaction.name}-Errors: ${JSON.stringify(field_errors)}`)
    return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateActiveCategoryTransaction = async (transaction: Transaction, auth_req: AuthRequest): Promise<Record<string, string> | null> => {
    const field_errors: Record<string, string> = {}

    if (!transaction.category || !transaction.category.id) {
        return null
    }

    const categoryRepo = AppDataSource.getRepository(Category)
    const category = await categoryRepo.findOne({
        where: {
            id: transaction.category.id,
            user: { id: auth_req.user.id },
            is_active: true
        }
    })

    if (!category) {
        const category_name = transaction.category?.name || ''
        field_errors.category = `La categoría "${category_name}" de esta transacción ya no está activa o no existe`
    }

    logger.debug(`${validateActiveCategoryTransaction.name}-Errors: ${JSON.stringify(field_errors)}`)
    return Object.keys(field_errors).length > 0 ? field_errors : null
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\policies\account-form.policy.ts
```
 
```ts
import { AccountFormMatrix } from "../types/form-view-params";

export const accountFormMatrix: AccountFormMatrix = {
    insert: {
        type: 'editable',
        name: 'editable',
        is_active: 'readonly'
    },
    update: {
        type: 'readonly',
        name: 'editable',
        is_active: 'editable'
    },
    delete: {
        type: 'readonly',
        name: 'readonly',
        is_active: 'readonly'
    }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\policies\category-form.policy.ts
```
 
```ts
import { CategoryFormMatrix } from "../types/form-view-params";

export const categoryFormMatrix: CategoryFormMatrix = {
    insert: {
        type: 'editable',
        type_for_loan: 'editable',
        name: 'editable',
        category_group_id: 'editable',
        is_active: 'readonly'
    },
    update: {
        type: 'readonly',
        type_for_loan: 'editable',
        name: 'editable',
        category_group_id: 'editable',
        is_active: 'editable'
    },
    delete: {
        type: 'readonly',
        type_for_loan: 'readonly',
        name: 'readonly',
        category_group_id: 'readonly',
        is_active: 'readonly'
    }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\policies\category-group-form.policy.ts
```
 
```ts
import { CategoryGroupFormMatrix } from "../types/form-view-params";

export const categoryGroupFormMatrix: CategoryGroupFormMatrix = {
    insert: {
        name: 'editable',
        is_active: 'readonly'
    },
    update: {
        name: 'editable',
        is_active: 'readonly'
    },
    delete: {
        name: 'readonly',
        is_active: 'readonly'
    },
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\policies\loan-form.policy.ts
```
 
```ts
import { LoanFormMatrix, } from "../types/form-view-params";

export const loanFormMatrix: LoanFormMatrix = {
    insert: {
        name: 'editable',
        total_amount: 'editable',
        start_date: 'editable',
        loan_group_id: 'editable',
        disbursement_account_id: 'editable',
        category_id: 'editable',
        note: 'editable',
        is_active: 'readonly'
    },

    update: {
        name: 'editable',
        total_amount: 'editable',
        start_date: 'editable',
        loan_group_id: 'editable',
        disbursement_account_id: 'editable',
        category_id: 'editable',
        note: 'editable',
        is_active: 'readonly'
    },

    delete: {
        name: 'readonly',
        total_amount: 'readonly',
        start_date: 'readonly',
        loan_group_id: 'readonly',
        disbursement_account_id: 'readonly',
        category_id: 'readonly',
        note: 'readonly',
        is_active: 'readonly'
    }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\policies\loan-group-form.policy.ts
```
 
```ts
import { LoanGroupFormMatrix } from "../types/form-view-params"

export const loanGroupFormMatrix: LoanGroupFormMatrix = {
    insert: {
        name: 'editable',
        is_active: 'readonly'
    },
    update: {
        name: 'editable',
        is_active: 'readonly'
    },
    delete: {
        name: 'readonly',
        is_active: 'readonly'
    },
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\policies\loan-payment-form.policy.ts
```
 
```ts
import { PaymentFormMatrix } from "../types/form-view-params";

export const paymentFormMatrix: PaymentFormMatrix = {

  insert: {
    account_id: 'editable',
    category_id: 'editable',
    principal_paid: 'editable',
    interest_paid: 'editable',
    payment_date: 'editable',
    note: 'editable'
  },

  update: {
    account_id: 'readonly',
    category_id: 'editable',
    principal_paid: 'editable',
    interest_paid: 'editable',
    payment_date: 'editable',
    note: 'editable'
  },

  delete: {
    account_id: 'readonly',
    category_id: 'readonly',
    principal_paid: 'readonly',
    interest_paid: 'readonly',
    payment_date: 'readonly',
    note: 'readonly'
  }

} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\policies\roles-user.policy.ts
```
 
```ts
type Role = 'ADMIN' | 'USER'

export interface RoleUser {
    can_update_amount_loan?: boolean
    can_update_start_date_loan?: boolean
    can_update_date_payment?: boolean
    can_update_date_transaction?: boolean
    can_delete_transaction?: boolean
}

export const role_permissions: Record<Role, RoleUser> = {
    ADMIN: {
        can_update_amount_loan: true,
        can_update_start_date_loan: true,
        can_update_date_payment: true,
        can_update_date_transaction: true,
        can_delete_transaction: true,
    },
    USER: {
        can_update_amount_loan: false,
        can_update_start_date_loan: false,
        can_update_date_payment: false,
        can_update_date_transaction: false,
        can_delete_transaction: false,
    }
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\policies\transaction-form.policy.ts
```
 
```ts
import { TransactionFormMatrix } from "../types/form-view-params";

export const transactionFormMatrix: TransactionFormMatrix = {
    insert: {
        type: 'editable',
        account: 'editable',
        to_account: 'editable',
        category: 'editable',
        amount: 'editable',
        date: 'editable',
        description: 'editable'
    },
    update: {
        type: 'readonly',
        account: 'editable',
        to_account: 'editable',
        category: 'editable',
        amount: 'editable',
        date: 'editable',
        description: 'editable'
    },
    delete: {
        type: 'readonly',
        account: 'readonly',
        to_account: 'readonly',
        category: 'readonly',
        amount: 'readonly',
        date: 'readonly',
        description: 'readonly'
    },
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\routes\account.route.ts
```
 
```ts
import { Router } from 'express'
import {
    apiForGettingAccounts,
    apiForSavingAccount,
    routeToFormDeleteAccount,
    routeToFormInsertAccount,
    routeToFormUpdateAccount,
    routeToPageAccount
} from '../controllers/account/account.controller'

const router = Router()

/*Eventos de acción */
router.get('/list', apiForGettingAccounts)
router.post('/', apiForSavingAccount)

/*Eventos de enrutamiento */
router.get('/', routeToPageAccount)
router.get('/insert', routeToFormInsertAccount)
router.get('/update/:id', routeToFormUpdateAccount)
router.get('/delete/:id', routeToFormDeleteAccount)


export default router
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\routes\auth.route.ts
```
 
```ts
import { Router } from 'express'
import { show2FA, verify2FA } from '../controllers/home/2fa.controller'
import { twoFALimiter } from '../config/rate-limiter'

const router = Router()

router.get('/2fa', show2FA)
router.post('/2fa', twoFALimiter, verify2FA)

export default router
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\routes\category-group.route.ts
```
 
```ts
import { Router } from 'express'
import {
    apiForSavingCategoryGroup,
    routeToFormDeleteCategoryGroup,
    routeToFormInsertCategoryGroup,
    routeToFormUpdateCategoryGroup
} from '../controllers/category-group/category-group.controller'

const router = Router()

/*Eventos de acción */
router.post('/', apiForSavingCategoryGroup)

/*Eventos de enrutamiento */
router.get('/insert', routeToFormInsertCategoryGroup)
router.get('/update/:id', routeToFormUpdateCategoryGroup)
router.get('/delete/:id', routeToFormDeleteCategoryGroup)

export default router 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\routes\category.route.ts
```
 
```ts
import { Router } from 'express'
import {
    apiForGettingCategories,
    apiForSavingCategory,
    routeToFormDeleteCategory,
    routeToFormInsertCategory,
    routeToFormUpdateCategory,
    routeToPageCategory
} from '../controllers/category/category.controller'

const router = Router()

/*Eventos de acción */
router.get('/list', apiForGettingCategories)
router.post('/', apiForSavingCategory)

/*Eventos de enrutamiento */
router.get('/', routeToPageCategory)
router.get('/insert', routeToFormInsertCategory)
router.get('/update/:id', routeToFormUpdateCategory)
router.get('/delete/:id', routeToFormDeleteCategory)

export default router 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\routes\home.route.ts
```
 
```ts
import { Router } from 'express'
import {
    apiForGettingCashSummary,
    apiForGettingKpis,
    apiForGettingLoanSummary,
    apiForLogout,
    apiForValidatingLogin,
    routeToPageHome,
    routeToPageLogin,
    routeToPageRoot
} from '../controllers/home/home.controller'
import { injectNetBalance } from '../middlewares/inject-net-balance.middleware'
import { sessionAuthMiddleware } from '../middlewares/session-auth.middleware'
import { loginLimiter } from '../config/rate-limiter'

const router = Router()

// Public routes
router.post('/login', loginLimiter, apiForValidatingLogin)
router.get('/login', routeToPageLogin)
router.get('/', routeToPageRoot)

// Protected routes
const protectedSubRouter = Router()
protectedSubRouter.use(sessionAuthMiddleware)
protectedSubRouter.use(injectNetBalance)

protectedSubRouter.get('/logout', apiForLogout)
protectedSubRouter.get('/kpis', apiForGettingKpis)
protectedSubRouter.get('/cash-summary', apiForGettingCashSummary)
protectedSubRouter.get('/loan-summary', apiForGettingLoanSummary)
protectedSubRouter.get('/home', routeToPageHome)

router.use(protectedSubRouter)

export default router
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\routes\loan-group.route.ts
```
 
```ts
import { Router } from 'express'
import {
    apiForSavingLoanGroup,
    routeToFormDeleteLoanGroup,
    routeToFormInsertLoanGroup,
    routeToFormUpdateLoanGroup
}
    from '../controllers/payable-group/payable-group.controller'

const router = Router()

/*Eventos de acción */
router.post('/', apiForSavingLoanGroup)

/*Eventos de enrutamiento */
router.get('/insert', routeToFormInsertLoanGroup)
router.get('/update/:id', routeToFormUpdateLoanGroup)
router.get('/delete/:id', routeToFormDeleteLoanGroup)

export default router 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\routes\loan-payment.route.ts
```
 
```ts
import { Router } from 'express'
import {
    apiForGettingPayments,
    apiForSavingAccount,
    routeToFormClonePayment,
    routeToFormDeletePayment,
    routeToFormInsertPayment,
    routeToFormUpdatePayment,
    routeToPagePayment
} from '../controllers/payable-payment/payable-payment.controller'

const router = Router()

/*Eventos de acción */
router.get('/list/:loan_id/loan', apiForGettingPayments)
router.post('/', apiForSavingAccount)

/*Eventos de enrutamiento */
router.get('/:id/loan', routeToPagePayment)
router.get('/insert/:loan_id', routeToFormInsertPayment)
router.get('/update/:id', routeToFormUpdatePayment)
router.get('/clone/:id', routeToFormClonePayment)
router.get('/delete/:id', routeToFormDeletePayment)

export default router
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\routes\loan.route.ts
```
 
```ts
import { Router } from "express"
import {
    apiForGettingLoans,
    apiForSavingLoan,
    routeToFormCloneLoan,
    routeToFormDeleteLoan,
    routeToFormInsertLoan,
    routeToFormUpdateLoan,
    routeToPageLoan
} from "../controllers/payable/payable.controller"
import { routeToPagePayment } from "../controllers/payable-payment/payable-payment.controller"

const router = Router()

/*Eventos de acción */
router.get('/list', apiForGettingLoans) 
router.post('/', apiForSavingLoan)

/*Eventos de enrutamiento */
router.get('/', routeToPageLoan)
router.get('/insert', routeToFormInsertLoan)
router.get('/update/:id', routeToFormUpdateLoan)
router.get('/clone/:id', routeToFormCloneLoan)
router.get('/delete/:id', routeToFormDeleteLoan)
router.get('/:id/loan', routeToPagePayment)

export default router 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\routes\transaction.route.ts
```
 
```ts
import { Router } from 'express'
import {
  apiForBatchCategorize,
  apiForGettingCategorizeTransactions
} from '../controllers/transaction/batch-categorize.controller'
import {
  apiForGettingTransactions,
  apiForSavingTransaction,
  routeToFormCloneTransaction,
  routeToFormDeleteTransaction,
  routeToFormInsertTransaction,
  routeToFormUpdateTransaction,
  routeToPageTransaction
} from '../controllers/transaction/transaction.controller'

const router = Router()

/*Eventos de acción */
router.post('/', apiForSavingTransaction)
router.get('/list', apiForGettingTransactions)
router.get('/batch-categorize', apiForGettingCategorizeTransactions)

/*Eventos de enrutamiento */
router.get('/', routeToPageTransaction)
router.get('/insert', routeToFormInsertTransaction)
router.get('/update/:id', routeToFormUpdateTransaction)
router.get('/clone/:id', routeToFormCloneTransaction)
router.get('/delete/:id', routeToFormDeleteTransaction)
router.post('/batch-categorize', apiForBatchCategorize)

export default router 
 
```
 
