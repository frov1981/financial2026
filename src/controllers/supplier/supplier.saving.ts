import { LOGGER_EVENTS } from '../../utils/logger-events'
import { Request, RequestHandler, Response } from 'express'
import { performance } from 'perf_hooks'
import { getSupplierById } from '../../cache/cache-suppliers.service'
import { deleteAll } from '../../cache/cache-key.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Supplier } from '../../entities/Supplier.entity'
import { supplierFormMatrix } from '../../policies/supplier-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { SupplierFormMode } from '../../types/form-view-params'
import { parseBoolean } from '../../utils/bool.util'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'
import { validateDeleteSupplier, validateSaveSupplier } from './supplier.validator'

const getTitle = (mode: SupplierFormMode) => {
  switch (mode) {
    case 'insert': return 'Insertar Proveedor'
    case 'update': return 'Editar Proveedor'
    case 'delete': return 'Eliminar Proveedor'
  }
}

const parseSupplierMode = (value: unknown): SupplierFormMode => {
  if (value === 'update' || value === 'delete') return value
  return 'insert'
}

const sanitizeByPolicy = (mode: SupplierFormMode, body: Record<string, unknown>) => {
  const policy = supplierFormMatrix[mode]
  const clean: Record<string, unknown> = {}
  for (const field in policy) {
    if (policy[field] === 'editable' && body[field] !== undefined) {
      clean[field] = body[field]
    }
  }
  return clean
}

const normalizeOptionalString = (value: unknown): string | null => {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

const buildSupplierView = (body: Record<string, unknown>): Partial<Supplier> => ({
  id: typeof body.id === 'string' && Number.isSafeInteger(Number(body.id)) ? Number(body.id) : undefined,
  business_name: typeof body.business_name === 'string' ? body.business_name.trim() : '',
  tax_id: normalizeOptionalString(body.tax_id),
  address_1: normalizeOptionalString(body.address_1),
  address_2: normalizeOptionalString(body.address_2),
  mobile_1: normalizeOptionalString(body.mobile_1),
  mobile_2: normalizeOptionalString(body.mobile_2),
  whatsapp_1: normalizeOptionalString(body.whatsapp_1),
  whatsapp_2: normalizeOptionalString(body.whatsapp_2),
  email_1: normalizeOptionalString(body.email_1),
  email_2: normalizeOptionalString(body.email_2),
  is_active: parseBoolean(body.is_active)
})

export const saveSupplier: RequestHandler = async (req: Request, res: Response) => {
  const started_at = performance.now()
  const auth_req = req as AuthRequest
  const user_id = auth_req.user.id
  const mode = parseSupplierMode(req.body.mode)
  const supplier_id = req.body.id ? Number(req.body.id) : undefined
  const saveSupplier_logger = logger.forMethod(saveSupplier.name, LOGGER_EVENTS.SUPPLIER, user_id)
  const repo_supplier = AppDataSource.getRepository(Supplier)
  const body = req.body as Record<string, unknown>
  const form_state = {
    supplier: buildSupplierView(body),
    supplier_form_policy: supplierFormMatrix[mode],
    mode
  }

  saveSupplier_logger.debug('Inicio proceso de guardado de proveedor')
  saveSupplier_logger.debug('Parametros recibidos', { body: req.body, param: req.params })
  try {
    let existing: Supplier | null = null
    if (supplier_id) {
      existing = await getSupplierById(auth_req, supplier_id)
      if (!existing) throw new Error('Proveedor no encontrado')
    }

    if (mode === 'delete') {
      if (!existing) throw new Error('Proveedor no encontrado')
      const errors = await validateDeleteSupplier(existing)
      if (errors) throw { validationErrors: errors }
      await repo_supplier.delete(existing.id)
      deleteAll(auth_req, 'supplier')
      return res.redirect('/suppliers')
    }

    const supplier = mode === 'insert'
      ? repo_supplier.create({ user: { id: user_id }, is_active: true })
      : existing
    if (!supplier) throw new Error('Proveedor no encontrado')

    const clean = sanitizeByPolicy(mode, body)
    if (typeof clean.business_name === 'string') supplier.business_name = clean.business_name.trim()
    if (clean.tax_id !== undefined) supplier.tax_id = normalizeOptionalString(clean.tax_id)
    if (clean.address_1 !== undefined) supplier.address_1 = normalizeOptionalString(clean.address_1)
    if (clean.address_2 !== undefined) supplier.address_2 = normalizeOptionalString(clean.address_2)
    if (clean.mobile_1 !== undefined) supplier.mobile_1 = normalizeOptionalString(clean.mobile_1)
    if (clean.mobile_2 !== undefined) supplier.mobile_2 = normalizeOptionalString(clean.mobile_2)
    if (clean.whatsapp_1 !== undefined) supplier.whatsapp_1 = normalizeOptionalString(clean.whatsapp_1)
    if (clean.whatsapp_2 !== undefined) supplier.whatsapp_2 = normalizeOptionalString(clean.whatsapp_2)
    if (clean.email_1 !== undefined) supplier.email_1 = normalizeOptionalString(clean.email_1)
    if (clean.email_2 !== undefined) supplier.email_2 = normalizeOptionalString(clean.email_2)
    if (clean.is_active !== undefined) supplier.is_active = parseBoolean(clean.is_active)

    const errors = await validateSaveSupplier(auth_req, supplier)
    if (errors) throw { validationErrors: errors }
    await repo_supplier.save(supplier)
    deleteAll(auth_req, 'supplier')
    return res.redirect('/suppliers')
  } catch (error: any) {
    saveSupplier_logger.error('Error al guardar el proveedor', { supplier_id, mode, error: parseError(error) })
    const validation_errors = error?.validationErrors || null
    return res.render('layouts/main', {
      title: getTitle(mode),
      view: 'pages/suppliers/form',
      ...form_state,
      errors: validation_errors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
    })
  } finally {
    saveSupplier_logger.elapsedTime('Elapsed time', { elapsed_ms: performance.now() - started_at })
    saveSupplier_logger.debug('Fin de la operación de guardado de proveedor')
  }
}
