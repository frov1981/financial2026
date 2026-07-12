import { Request, RequestHandler, Response } from 'express';
import { performance } from 'perf_hooks';
import { deleteAll } from '../../cache/cache-key.service';
import { AppDataSource } from '../../config/typeorm.datasource';
import { AuthRequest } from '../../types/auth-request';
import { parseBoolean } from '../../utils/bool.util';
import { parseError } from '../../utils/error.util';
import { logger } from '../../utils/logger.util';
import { ReceivableGroupFormMode } from '../../types/form-view-params';
import { receivableGroupFormMatrix } from '../../policies/receivable-group-form.policy copy';
import { ReceivableGroup } from '../../entities/ReceivableGroup.entity';
import { getReceivableGroupById } from '../../cache/cache-receivable-groups.service';
import { validateDeleteReceivableGroup, validateReceivableGroup } from './receivable-group.validator';

/* ============================
   Obtener título según el modo del formulario
============================ */
const getTitle = (mode: string) => {
    switch (mode) {
        case 'insert': return 'Insertar Grupo de Cuentas por Cobrar'
        case 'update': return 'Editar Grupo de Cuentas por Cobrar'
        case 'delete': return 'Eliminar Grupo de Cuentas por Cobrar'
        default: return 'Indefinido'
    }
}

/* ============================
   Sanitizar payload según policy
============================ */
const sanitizeByPolicy = (mode: ReceivableGroupFormMode, body: any) => {
    const policy = receivableGroupFormMatrix[mode]
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
const buildReceivableGroupView = (body: any, mode: ReceivableGroupFormMode) => {
    return {
        ...body,
        is_active: parseBoolean(body.is_active),
    }
}

/* ============================
   Renderizar formulario de categoría para Insertar, Editar, Eliminar o Cambiar Estado
============================ */
export const saveReceivableGroup: RequestHandler = async (req: Request, res: Response) => {
    const start = performance.now()
    logger.info(`${saveReceivableGroup.name} called`, { body: req.body, param: req.params })
    const auth_req = req as AuthRequest
    const user_id = auth_req.user.id
    const receivable_group_id = Number(req.body.id)
    const mode: ReceivableGroupFormMode = req.body.mode || 'insert'
    const repo_receivable_group = AppDataSource.getRepository(ReceivableGroup)
    const receivable_group_view = buildReceivableGroupView(req.body, mode)
    const form_state = {
        receivable_group: receivable_group_view,
        receivable_group_form_policy: receivableGroupFormMatrix[mode],
        mode
    }
    try {
        let existing: ReceivableGroup | null = null
        if (receivable_group_id) {
            existing = await getReceivableGroupById(auth_req, receivable_group_id)
            if (!existing) throw new Error('Grupo de Cuentas por Cobrar no encontrada')
        }
        /* =========================
           DELETE
        ============================ */
        if (mode === 'delete') {
            if (!existing) throw new Error('Grupo de Cuentas por Cobrar no encontrada')
            const errors = await validateDeleteReceivableGroup(auth_req, existing)
            if (errors) throw { validationErrors: errors }
            await repo_receivable_group.delete(existing.id)
            deleteAll(auth_req, 'receivable_group')
            return res.redirect('/receivables')
        }
        /* =========================
           INSERT / UPDATE
        ============================ */
        let receivable_group: ReceivableGroup
        if (mode === 'insert') {
            receivable_group = repo_receivable_group.create({
                user: { id: auth_req.user.id } as any,
                name: req.body.name,
                is_active: true
            })
        } else {
            if (!existing) throw new Error('Grupo de Cuentas por Pagar no encontrada')
            receivable_group = existing
        }
        /*=================================
          Aplicar sanitización por policy
        =================================*/
        const clean = sanitizeByPolicy(mode, req.body)

        if (clean.name !== undefined) receivable_group.name = clean.name
        if (clean.is_active !== undefined) { receivable_group.is_active = parseBoolean(clean.is_active) }
        const errors = await validateReceivableGroup(auth_req, receivable_group)
        if (errors) throw { validationErrors: errors }
        /*=================================
        Guardar en base de datos y limpiar cache
        =================================*/
        await repo_receivable_group.save(receivable_group)
        deleteAll(auth_req, 'receivable_group')
        return res.redirect('/receivables')
    } catch (error: any) {
        /* ============================
           Manejo de errores
        ============================ */
        logger.error(`${saveReceivableGroup.name}-Error. `, { user_id: auth_req.user.id, receivable_group_id: receivable_group_id, mode, error: parseError(error), })
        const validationErrors = error?.validationErrors || null
        return res.render('layouts/main', {
            title: getTitle(mode),
            view: 'pages/receivable-groups/form',
            ...form_state,
            errors: validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
        })
    } finally {
        const end = performance.now()
        const duration_sec = (end - start) / 1000
        logger.debug(`${saveReceivableGroup.name}. user=[${user_id}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    }
}
