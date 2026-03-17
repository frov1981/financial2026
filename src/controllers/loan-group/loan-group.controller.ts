import { Request, RequestHandler, Response } from 'express'
import { getLoanGroupById } from '../../cache/cache-loan-group.service'
import { loanGroupFormMatrix } from '../../policies/loan-group-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { BaseFormViewParams } from '../../types/form-view-params'
export { saveLoanGroup as apiForSavingLoanGroup } from './loan-group.saving'

type LoanGroupFormViewParams = BaseFormViewParams & {
    loan_group: any
}

const renderLoanGroupForm = async (res: Response, params: LoanGroupFormViewParams) => {
    const { title, view, loan_group, errors, mode, auth_req } = params
    const loan_group_form_policy = loanGroupFormMatrix[mode]
    return res.render('layouts/main', {
        title,
        view,
        errors,
        mode,
        auth_req,
        loan_group,
        loan_group_form_policy,
    })
}

export const routeToFormInsertLoanGroup: RequestHandler = async (req: Request, res: Response) => {
    const mode = 'insert'
    const auth_req = req as AuthRequest
    return renderLoanGroupForm(res, {
        title: 'Insertar Grupo de Préstamos',
        view: 'pages/loan-groups/form',
        errors: {},
        mode,
        auth_req,
        loan_group: {
            is_active: true
        },
    })
}

export const routeToFormUpdateLoanGroup: RequestHandler = async (req: Request, res: Response) => {
    const mode = 'update'
    const auth_req = req as AuthRequest
    const loan_group_id = Number(req.params.id)
    const loan_group = await getLoanGroupById(auth_req, loan_group_id)
    if (!loan_group) {
        return res.redirect('/loans')
    }
    return renderLoanGroupForm(res, {
        title: 'Editar Grupo de Préstamos',
        view: 'pages/loan-groups/form',
        errors: {},
        mode,
        auth_req,
        loan_group
    })
}

export const routeToFormDeleteLoanGroup: RequestHandler = async (req: Request, res: Response) => {
    const mode = 'delete'
    const auth_req = req as AuthRequest
    const loan_group_id = Number(req.params.id)
    const loan_group = await getLoanGroupById(auth_req, loan_group_id)
    if (!loan_group) {
        return res.redirect('/loans')
    }
    return renderLoanGroupForm(res, {
        title: 'Eliminar Grupo de Préstamos',
        view: 'pages/loan-groups/form',
        errors: {},
        mode,
        auth_req,
        loan_group
    })
}
