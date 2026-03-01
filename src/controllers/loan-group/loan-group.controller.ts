import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { loanGroupFormMatrix } from '../../policies/loan-group-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { LoanGroup } from '../../entities/LoanGroup.entity'
export { saveLoanGroup as apiForSavingLoanGroup } from './loan-group.saving'

type LoanGroupFormViewParams = {
    title: string
    view: string
    loan_group: any
    errors: any
    mode: 'insert' | 'update' | 'delete'
    auth_req: AuthRequest
}

const renderLoanGroupForm = async (res: Response, params: LoanGroupFormViewParams) => {
    const { title, view, loan_group, errors, mode, auth_req } = params
    const loan_group_form_policy = loanGroupFormMatrix[mode]
    return res.render('layouts/main', {
        title,
        view,
        loan_group,
        errors,
        loan_group_form_policy,
        mode
    })
}

export const routeToFormInsertLoanGroup: RequestHandler = async (req: Request, res: Response) => {
    const auth_req = req as AuthRequest
    const timezone = auth_req.timezone || 'UTC'
    return renderLoanGroupForm(res, {
        title: 'Insertar Grupo de Préstamos',
        view: 'pages/loan-groups/form',
        loan_group: {
            is_active: true
        },
        errors: {},
        mode: 'insert',
        auth_req
    })
}

export const routeToFormUpdateLoanGroup: RequestHandler = async (req: Request, res: Response) => {
    const auth_req = req as AuthRequest
    const timezone = auth_req.timezone || 'UTC'
    const loan_group_id = Number(req.params.id)
    if (!Number.isInteger(loan_group_id) || loan_group_id <= 0) {
        return res.redirect('/loans')
    }
    const repo_loan_group = AppDataSource.getRepository(LoanGroup)
    const loan_group = await repo_loan_group.findOne({
        where: { id: loan_group_id, user: { id: auth_req.user.id } },
    })
    if (!loan_group) {
        return res.redirect('/loans')
    }
    return renderLoanGroupForm(res, {
        title: 'Editar Grupo de Préstamos',
        view: 'pages/loan-groups/form',
        loan_group: {
            id: loan_group.id,
            name: loan_group.name,
            is_active: loan_group.is_active,
        },
        errors: {},
        mode: 'update',
        auth_req
    })
}

export const routeToFormDeleteLoanGroup: RequestHandler = async (req: Request, res: Response) => {
    const auth_req = req as AuthRequest
    const loan_group_id = Number(req.params.id)
    if (!Number.isInteger(loan_group_id) || loan_group_id <= 0) {
        return res.redirect('/loans')
    }
    const repo_loan_group = AppDataSource.getRepository(LoanGroup)
    const loan_group = await repo_loan_group.findOne({
        where: { id: loan_group_id, user: { id: auth_req.user.id } },
    })
    if (!loan_group) {
        return res.redirect('/loans')
    }
    return renderLoanGroupForm(res, {
        title: 'Eliminar Grupo de Préstamos',
        view: 'pages/loan-groups/form',
        loan_group: {
            id: loan_group.id,
            name: loan_group.name,
            is_active: loan_group.is_active,
        },
        errors: {},
        mode: 'delete',
        auth_req
    })
}
