import { Request, RequestHandler, Response } from 'express'
import { AuthRequest } from '../../types/auth-request'
import { BaseFormViewParams } from '../../types/form-view-params'
import { receivableGroupFormMatrix } from '../../policies/receivable-group-form.policy copy'
import { getReceivableGroupById } from '../../cache/cache-receivable-groups.service'
export { saveReceivableGroup as apiForSavingReceivableGroup } from './receivable-group.saving'

type ReceivableGroupFormViewParams = BaseFormViewParams & {
    receivable_group: any
}

const renderReceivableGroupForm = async (res: Response, params: ReceivableGroupFormViewParams) => {
    const { title, view, receivable_group, errors, mode, auth_req } = params
    const receivable_group_form_policy = receivableGroupFormMatrix[mode]
    return res.render('layouts/main', {
        title,
        view,
        errors,
        mode,
        auth_req,
        receivable_group,
        receivable_group_form_policy,
    })
}

export const routeToFormInsertReceivableGroup: RequestHandler = async (req: Request, res: Response) => {
    const mode = 'insert'
    const auth_req = req as AuthRequest
    return renderReceivableGroupForm(res, {
        title: 'Insertar Grupo de Cuentas por Cobrar',
        view: 'pages/receivable-groups/form',
        errors: {},
        mode,
        auth_req,
        receivable_group: {
            is_active: true
        },
    })
}

export const routeToFormUpdateReceivableGroup: RequestHandler = async (req: Request, res: Response) => {
    const mode = 'update'
    const auth_req = req as AuthRequest
    const receivable_group_id = Number(req.params.id)
    const receivable_group = await getReceivableGroupById(auth_req, receivable_group_id)
    if (!receivable_group) {
        return res.redirect('/receivables')
    }
    return renderReceivableGroupForm(res, {
        title: 'Editar Grupo de Cuentas por Cobrar',
        view: 'pages/receivable-groups/form',
        errors: {},
        mode,
        auth_req,
        receivable_group
    })
}

export const routeToFormDeleteReceivableGroup: RequestHandler = async (req: Request, res: Response) => {
    const mode = 'delete'
    const auth_req = req as AuthRequest
    const receivable_group_id = Number(req.params.id)
    const receivable_group = await getReceivableGroupById(auth_req, receivable_group_id)
    if (!receivable_group) {
        return res.redirect('/receivables')
    }
    return renderReceivableGroupForm(res, {
        title: 'Eliminar Grupo de Cuentas por Cobrar',
        view: 'pages/receivable-groups/form',
        errors: {},
        mode,
        auth_req,
        receivable_group
    })
}
