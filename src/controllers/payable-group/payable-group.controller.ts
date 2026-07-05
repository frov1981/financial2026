import { Request, RequestHandler, Response } from 'express'
import { getPayableGroupById } from '../../cache/cache-payable-groups.service'
import { payableGroupFormMatrix } from '../../policies/payable-group-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { BaseFormViewParams } from '../../types/form-view-params'
export { savePayableGroup as apiForSavingPayableGroup } from './payable-group.saving'

type PayableGroupFormViewParams = BaseFormViewParams & {
    payable_group: any
}

const renderPayableGroupForm = async (res: Response, params: PayableGroupFormViewParams) => {
    const { title, view, payable_group, errors, mode, auth_req } = params
    const payable_group_form_policy = payableGroupFormMatrix[mode]
    return res.render('layouts/main', {
        title,
        view,
        errors,
        mode,
        auth_req,
        payable_group,
        payable_group_form_policy,
    })
}

export const routeToFormInsertPayableGroup: RequestHandler = async (req: Request, res: Response) => {
    const mode = 'insert'
    const auth_req = req as AuthRequest
    return renderPayableGroupForm(res, {
        title: 'Insertar Grupo de Cuentas por Pagar',
        view: 'pages/payable-groups/form',
        errors: {},
        mode,
        auth_req,
        payable_group: {
            is_active: true
        },
    })
}

export const routeToFormUpdatePayableGroup: RequestHandler = async (req: Request, res: Response) => {
    const mode = 'update'
    const auth_req = req as AuthRequest
    const payable_group_id = Number(req.params.id)
    const payable_group = await getPayableGroupById(auth_req, payable_group_id)
    if (!payable_group) {
        return res.redirect('/payables')
    }
    return renderPayableGroupForm(res, {
        title: 'Editar Grupo de Cuentas por Pagar',
        view: 'pages/payable-groups/form',
        errors: {},
        mode,
        auth_req,
        payable_group
    })
}

export const routeToFormDeletePayableGroup: RequestHandler = async (req: Request, res: Response) => {
    const mode = 'delete'
    const auth_req = req as AuthRequest
    const payable_group_id = Number(req.params.id)
    const payable_group = await getPayableGroupById(auth_req, payable_group_id)
    if (!payable_group) {
        return res.redirect('/payables')
    }
    return renderPayableGroupForm(res, {
        title: 'Eliminar Grupo de Cuentas por Pagar',
        view: 'pages/payable-groups/form',
        errors: {},
        mode,
        auth_req,
        payable_group
    })
}
