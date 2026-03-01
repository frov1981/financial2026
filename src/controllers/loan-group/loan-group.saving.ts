import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { AuthRequest } from '../../types/auth-request'
import { logger } from '../../utils/logger.util'
import { loanGroupFormMatrix, LoanGroupFormMode } from '../../policies/loan-group-form.policy'
import { LoanGroup } from '../../entities/LoanGroup.entity'
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
        if (policy[field] === 'edit' && body[field] !== undefined) {
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
    }
}

/* ============================
   Renderizar formulario de categoría para Insertar, Editar, Eliminar o Cambiar Estado
============================ */
export const saveLoanGroup: RequestHandler = async (req: Request, res: Response) => {
    logger.debug(`${saveLoanGroup.name}-Start`)
    logger.info('saveLoanGroup called', { body: req.body, param: req.params })

    const auth_req = req as AuthRequest
    const loan_group_id = req.body.id ? Number(req.body.id) : undefined
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
            existing = await repo_loan_group.findOne({
                where: { id: loan_group_id, user: { id: auth_req.user.id } },
            })
            if (!existing) throw new Error('Grupo de Préstamos no encontrada')
        }

        /* =========================
           DELETE
        ============================ */
        if (mode === 'delete') {
            if (!existing) throw new Error('Grupo de Préstamos no encontrada')

            const errors = await validateDeleteLoanGroup(existing, auth_req)
            if (errors) throw { validationErrors: errors }

            await repo_loan_group.delete(existing.id)
            return res.redirect('/loans')
        }

        /* =========================
           INSERT / UPDATE / STATUS
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

        const clean = sanitizeByPolicy(mode, req.body)

        if (clean.name !== undefined) loan_group.name = clean.name
        if (clean.is_active !== undefined) { loan_group.is_active = clean.is_active === 'true' || clean.is_active === '1' }

        const errors = await validateLoanGroup(loan_group, auth_req)
        if (errors) throw { validationErrors: errors }

        await repo_loan_group.save(loan_group)
        return res.redirect('/loans')

    } catch (err: any) {
        logger.error(`${saveLoanGroup.name}-Error. `, {
            user_id: auth_req.user.id,
            loan_group_id: loan_group_id,
            mode,
            error: err,
            stack: err?.stack
        })

        const validationErrors = err?.validationErrors || null

        return res.render('layouts/main', {
            title: getTitle(mode),
            view: 'pages/loan-groups/form',
            ...form_state,
            errors: validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
        })
    } finally {
        logger.debug(`${saveLoanGroup.name}-End`)
    }
}
