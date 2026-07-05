import { Request, RequestHandler, Response } from 'express'
import { performance } from 'perf_hooks';
import { deleteAll } from '../../cache/cache-key.service'
import { getPayableGroupById } from '../../cache/cache-payable-groups.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { PayableGroup } from '../../entities/PayableGroup.entity'
import { payableGroupFormMatrix } from '../../policies/payable-group-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { PayableGroupFormMode } from '../../types/form-view-params'
import { parseBoolean } from '../../utils/bool.util'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'
import { validateDeletePayableGroup, validatePayableGroup } from './payable-group.validator'

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
const sanitizeByPolicy = (mode: PayableGroupFormMode, body: any) => {
    const policy = payableGroupFormMatrix[mode]
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
            return res.redirect('/payables')
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
        return res.redirect('/payables')
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
