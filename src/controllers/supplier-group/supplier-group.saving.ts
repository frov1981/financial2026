import { Request, RequestHandler, Response } from 'express'
import { performance } from 'perf_hooks'
import { getSupplierGroupById, getSupplierGroups } from '../../cache/cache-suppliers.service'
import { deleteAll } from '../../cache/cache-key.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { SupplierGroup } from '../../entities/SupplierGroup.entity'
import { supplierGroupFormMatrix } from '../../policies/supplier-group-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { SupplierGroupFormMode } from '../../types/form-view-params'
import { parseBoolean } from '../../utils/bool.util'
import { LOGGER_EVENTS } from '../../utils/logger-events'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'
import { validateDeleteSupplierGroup, validateSupplierGroup } from './supplier-group.validator'

const parseMode = (value: unknown): SupplierGroupFormMode =>
  value === 'update' || value === 'delete' ? value : 'insert'

const getTitle = (mode: SupplierGroupFormMode) => {
  if (mode === 'update') return 'Editar Grupo de Proveedores'
  if (mode === 'delete') return 'Eliminar Grupo de Proveedores'
  return 'Crear Grupo de Proveedores'
}

const buildView = (body: Record<string, unknown>): Partial<SupplierGroup> => ({
  id: typeof body.id === 'string' && Number.isSafeInteger(Number(body.id)) ? Number(body.id) : undefined,
  name: typeof body.name === 'string' ? body.name.trim() : '',
  is_active: parseBoolean(body.is_active)
})

export const saveSupplierGroup: RequestHandler = async (req: Request, res: Response) => {
  const started_at = performance.now()
  const auth_req = req as AuthRequest
  const user_id = auth_req.user.id
  const mode = parseMode(req.body.mode)
  const group_id = Number(req.body.id)
  const body = req.body as Record<string, unknown>
  const repo = AppDataSource.getRepository(SupplierGroup)
  const group_logger = logger.forMethod(saveSupplierGroup.name, LOGGER_EVENTS.SUPPLIER_GROUP, user_id)
  const form_state = {
    supplier_group: buildView(body),
    supplier_group_form_policy: supplierGroupFormMatrix[mode],
    mode
  }

  try {
    let existing: SupplierGroup | null = null
    if (group_id) {
      existing = await getSupplierGroupById(auth_req, group_id)
      if (!existing) throw new Error('Grupo de proveedores no encontrado')
    }

    if (mode === 'delete') {
      if (!existing) throw new Error('Grupo de proveedores no encontrado')
      const errors = await validateDeleteSupplierGroup(existing, auth_req)
      if (errors) throw { validationErrors: errors }
      await repo.delete(existing.id)
      deleteAll(auth_req, 'supplier_group')
      return res.redirect('/suppliers')
    }

    const group = mode === 'insert'
      ? repo.create({ user: { id: user_id }, is_active: true })
      : existing ? repo.create(existing) : null
    if (!group) throw new Error('Grupo de proveedores no encontrado')

    const policy = supplierGroupFormMatrix[mode]
    if (policy.name === 'editable' && typeof body.name === 'string') group.name = body.name.trim()
    if (policy.is_active === 'editable' && body.is_active !== undefined) group.is_active = parseBoolean(body.is_active)

    const errors = await validateSupplierGroup(group, auth_req)
    if (errors) throw { validationErrors: errors }
    await repo.save(group)
    deleteAll(auth_req, 'supplier_group')
    return res.redirect('/suppliers')
  } catch (error) {
    group_logger.error('Error al guardar grupo de proveedores', {
      supplier_group_id: group_id,
      mode,
      error: parseError(error)
    })
    const validation_errors = (error as { validationErrors?: Record<string, string> })?.validationErrors
    return res.render('layouts/main', {
      title: getTitle(mode),
      view: 'pages/supplier-groups/form',
      ...form_state,
      errors: validation_errors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
    })
  } finally {
    group_logger.elapsedTime('Elapsed time', { elapsed_ms: performance.now() - started_at })
  }
}
