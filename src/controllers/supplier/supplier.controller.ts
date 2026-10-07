import { LOGGER_EVENTS } from '../../utils/logger-events'
import { Request, RequestHandler, Response } from 'express'
import { performance } from 'perf_hooks'
import { getSupplierById, getSuppliersForApi } from '../../cache/cache-suppliers.service'
import { Supplier } from '../../entities/Supplier.entity'
import { supplierFormMatrix } from '../../policies/supplier-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { BaseFormViewParams } from '../../types/form-view-params'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'

export { saveSupplier as apiForSavingSupplier } from './supplier.saving'

type SupplierFormViewParams = BaseFormViewParams & {
  supplier: Partial<Supplier>
}

const renderSupplierForm = (res: Response, params: SupplierFormViewParams) => {
  const { title, view, supplier, errors, mode, auth_req } = params
  const supplier_form_policy = supplierFormMatrix[mode]
  return res.render('layouts/main', {
    title,
    view,
    errors,
    mode,
    auth_req,
    supplier,
    supplier_form_policy
  })
}

export const routeToPageSupplier: RequestHandler = (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  return res.render('layouts/main', {
    title: 'Proveedores',
    view: 'pages/suppliers/index',
    USER_ID: auth_req.user.id
  })
}

export const routeToFormInsertSupplier: RequestHandler = (req: Request, res: Response) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  return renderSupplierForm(res, {
    title: 'Insertar Proveedor',
    view: 'pages/suppliers/form',
    errors: {},
    mode,
    auth_req,
    supplier: { is_active: true }
  })
}

export const routeToFormUpdateSupplier: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'update'
  const auth_req = req as AuthRequest
  const supplier = await getSupplierById(auth_req, Number(req.params.id))
  if (!supplier) return res.redirect('/suppliers')
  return renderSupplierForm(res, {
    title: 'Editar Proveedor',
    view: 'pages/suppliers/form',
    errors: {},
    mode,
    auth_req,
    supplier
  })
}

export const routeToFormDeleteSupplier: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'delete'
  const auth_req = req as AuthRequest
  const supplier = await getSupplierById(auth_req, Number(req.params.id))
  if (!supplier) return res.redirect('/suppliers')
  return renderSupplierForm(res, {
    title: 'Eliminar Proveedor',
    view: 'pages/suppliers/form',
    errors: {},
    mode,
    auth_req,
    supplier
  })
}

export const apiForGettingSuppliers: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const api_logger = logger.forMethod(apiForGettingSuppliers.name, LOGGER_EVENTS.SUPPLIER, auth_req.user.id)
  const started_at = performance.now()
  try {
    api_logger.debug('Obteniendo proveedores')
    const result = await getSuppliersForApi(auth_req)
    return res.json(result)
  } catch (error) {
    api_logger.error('Error al listar proveedores', parseError(error))
    return res.status(500).json({ error: 'Error al listar proveedores' })
  } finally {
    api_logger.elapsedTime('Elapsed time', { elapsed_ms: performance.now() - started_at })
    api_logger.debug('Fin de la operación de listado de proveedores')
  }
}
