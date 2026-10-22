import { Request, RequestHandler, Response } from 'express'
import { performance } from 'perf_hooks'
import { getSupplierGroupById, getSupplierGroups } from '../../cache/cache-suppliers.service'
import { SupplierGroup } from '../../entities/SupplierGroup.entity'
import { supplierGroupFormMatrix } from '../../policies/supplier-group-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { BaseFormViewParams } from '../../types/form-view-params'
import { LOGGER_EVENTS } from '../../utils/logger-events'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'

export { saveSupplierGroup as apiForSavingSupplierGroup } from './supplier-group.saving'

type SupplierGroupFormViewParams = BaseFormViewParams & {
  supplier_group: Partial<SupplierGroup>
}

const renderForm = (res: Response, params: SupplierGroupFormViewParams) => {
  const { title, view, supplier_group, errors, mode } = params
  return res.render('layouts/main', {
    title,
    view,
    supplier_group,
    supplier_group_form_policy: supplierGroupFormMatrix[mode],
    errors,
    mode
  })
}

export const routeToFormInsertSupplierGroup: RequestHandler = (req: Request, res: Response) =>
  renderForm(res, {
    title: 'Crear Grupo de Proveedores',
    view: 'pages/supplier-groups/form',
    errors: {},
    mode: 'insert',
    auth_req: req as AuthRequest,
    supplier_group: { is_active: true }
  })

export const routeToFormUpdateSupplierGroup: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const supplier_group = await getSupplierGroupById(auth_req, Number(req.params.id))
  if (!supplier_group) return res.redirect('/suppliers')
  return renderForm(res, {
    title: 'Editar Grupo de Proveedores',
    view: 'pages/supplier-groups/form',
    errors: {},
    mode: 'update',
    auth_req,
    supplier_group
  })
}

export const routeToFormDeleteSupplierGroup: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const supplier_group = await getSupplierGroupById(auth_req, Number(req.params.id))
  if (!supplier_group) return res.redirect('/suppliers')
  return renderForm(res, {
    title: 'Eliminar Grupo de Proveedores',
    view: 'pages/supplier-groups/form',
    errors: {},
    mode: 'delete',
    auth_req,
    supplier_group
  })
}

export const apiForGettingSupplierGroups: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const api_logger = logger.forMethod(apiForGettingSupplierGroups.name, LOGGER_EVENTS.SUPPLIER_GROUP, auth_req.user.id)
  const started_at = performance.now()
  try {
    const groups = await getSupplierGroups(auth_req)
    return res.json(groups.map(group => ({
      id: group.id,
      name: group.name,
      is_active: group.is_active
    })))
  } catch (error) {
    api_logger.error('Error al listar grupos de proveedores', parseError(error))
    return res.status(500).json({ error: 'Error al listar grupos de proveedores' })
  } finally {
    api_logger.elapsedTime('Elapsed time', { elapsed_ms: performance.now() - started_at })
  }
}
