import { Request, RequestHandler, Response } from 'express'
import { performance } from 'perf_hooks';
import { deleteAll } from '../../cache/cache-key.service'
import { getLoanGroupById } from '../../cache/cache-loan-group.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { LoanGroup } from '../../entities/LoanGroup.entity'
import { loanGroupFormMatrix } from '../../policies/loan-group-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { LoanGroupFormMode } from '../../types/form-view-params'
import { parseBoolean } from '../../utils/bool.util'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'
import { validateDeleteLoanGroup, validateLoanGroup } from './loan-group.validator'

/* ============================
   Obtener título según el modo del formulario
============================ */
const getTitle = (mode: string) => {
    switch (mode) {
        case 'insert': return 'Insertar Grupo de Préstamos'
        case 'update': return 'Editar Grupo de Préstamos'
        case 'delete': return 'Eliminar Grupo de Préstamos'
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
const buildLoanGroupView = (body: any, mode: LoanGroupFormMode) => {
    return {
        ...body,
        is_active: parseBoolean(body.is_active),
    }
}

/* ============================
   Renderizar formulario de categoría para Insertar, Editar, Eliminar o Cambiar Estado
============================ */
export const saveLoanGroup: RequestHandler = async (req: Request, res: Response) => {
    const start = performance.now()
    logger.info(`${saveLoanGroup.name} called`, { body: req.body, param: req.params })
    const auth_req = req as AuthRequest
    const user_id = auth_req.user.id
    const loan_group_id = Number(req.body.id)
    const mode: LoanGroupFormMode = req.body.mode || 'insert'
    const repo_loan_group = AppDataSource.getRepository(LoanGroup)
    const loan_group_view = buildLoanGroupView(req.body, mode)
    const form_state = {
        loan_group: loan_group_view,
        loan_group_form_policy: loanGroupFormMatrix[mode],
        mode
    }
    try {
        let existing: LoanGroup | null = null
        if (loan_group_id) {
            existing = await getLoanGroupById(auth_req, loan_group_id)
            if (!existing) throw new Error('Grupo de Préstamos no encontrada')
        }
        /* =========================
           DELETE
        ============================ */
        if (mode === 'delete') {
            if (!existing) throw new Error('Grupo de Préstamos no encontrada')
            const errors = await validateDeleteLoanGroup(auth_req, existing)
            if (errors) throw { validationErrors: errors }
            await repo_loan_group.delete(existing.id)
            deleteAll(auth_req, 'loan_group')
            return res.redirect('/loans')
        }
        /* =========================
           INSERT / UPDATE
        ============================ */
        let loan_group: LoanGroup
        if (mode === 'insert') {
            loan_group = repo_loan_group.create({
                user: { id: auth_req.user.id } as any,
                name: req.body.name,
                is_active: true
            })
        } else {
            if (!existing) throw new Error('Grupo de Préstamos no encontrada')
            loan_group = existing
        }
        /*=================================
          Aplicar sanitización por policy
        =================================*/
        const clean = sanitizeByPolicy(mode, req.body)

        if (clean.name !== undefined) loan_group.name = clean.name
        if (clean.is_active !== undefined) { loan_group.is_active = parseBoolean(clean.is_active) }
        const errors = await validateLoanGroup(auth_req, loan_group)
        if (errors) throw { validationErrors: errors }
        /*=================================
        Guardar en base de datos y limpiar cache
        =================================*/
        await repo_loan_group.save(loan_group)
        deleteAll(auth_req, 'loan_group')
        return res.redirect('/loans')
    } catch (err: any) {
        /* ============================
           Manejo de errores
        ============================ */
        logger.error(`${saveLoanGroup.name}-Error. `, { user_id: auth_req.user.id, loan_group_id: loan_group_id, mode, error: parseError(err), })
        const validationErrors = err?.validationErrors || null
        return res.render('layouts/main', {
            title: getTitle(mode),
            view: 'pages/loan-groups/form',
            ...form_state,
            errors: validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
        })
    } finally {
        const end = performance.now()
        const duration_sec = (end - start) / 1000
        logger.debug(`${saveLoanGroup.name}. user=[${user_id}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    }
}
