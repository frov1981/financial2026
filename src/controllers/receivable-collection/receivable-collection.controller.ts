import { Request, RequestHandler, Response } from 'express'
import { getActiveAccounts } from '../../cache/cache-accounts.service'
import { getReceivableById } from '../../cache/cache-receivables.service'
import { getNextValidTransactionDate } from '../../services/next-valid-transaaction-date.service'
import { AuthRequest } from "../../types/auth-request"
import { BaseFormViewParams } from '../../types/form-view-params'
import { formatDateForInputLocal } from '../../utils/date.util'
import { parseError } from '../../utils/error.util'
import { logger } from "../../utils/logger.util"
import { receivableCollectionFormMatrix } from '../../policies/payable-receivable_collection-form.policy'
import { getActiveCategoriesForReceivableCollectionsByUser, getCollectionById, getCollectionsForApi } from '../../cache/cache-receivable-collections.service'
export { saveReceivableCollection as apiForSavingAccount } from './receivable-collection.saving'

type ReceivableCollectionFormViewParams = BaseFormViewParams & {
    receivable_collection: any
}

const renderReceivableCollectionForm = async (res: Response, params: ReceivableCollectionFormViewParams) => {
    const { title, view, receivable_collection, errors, mode, auth_req } = params
    const receivable_collection_form_policy = receivableCollectionFormMatrix[mode]
    const active_expense_category_list = await getActiveCategoriesForReceivableCollectionsByUser(auth_req)
    const account_list = await getActiveAccounts(auth_req)
    const receivable_id = auth_req.params.receivable_id || auth_req.params.payable_id || receivable_collection.receivable?.id || null
    const payable_id = receivable_id
    const category_id = auth_req.query.category_id || null
    const from = auth_req.query.from || null
    return res.render('layouts/main', {
        title,
        view,
        errors,
        mode,
        auth_req,
        receivable_collection,
        receivable_collection_form_policy,
        active_expense_category_list,
        account_list,
        receivable_id,
        payable_id,
        context: { category_id, from }
    })
}

export const routeToPageReceivableCollection: RequestHandler = async (req, res) => {
    const auth_req = req as AuthRequest
    const receivable_id = Number(req.params.id)
    const receivable = await getReceivableById(auth_req, receivable_id)
    if (!receivable) {
        return res.redirect('/receivables')
    }
    res.render('layouts/main', {
        title: 'Cobros',
        view: 'pages/payable-receivable_collections/index',
        USER_ID: auth_req.user?.id || 'guest',
        RECEIVABLE_ID: receivable_id,
        receivable
    })
}

export const routeToFormInsertReceivableCollection: RequestHandler = async (req, res) => {
    const mode = 'insert'
    const auth_req = req as AuthRequest
    const timezone = auth_req.timezone || 'UTC'
    const default_date = await getNextValidTransactionDate(auth_req)
    return renderReceivableCollectionForm(res, {
        title: 'Insertar Pago',
        view: 'pages/payable-receivable_collections/form',
        errors: {},
        auth_req,
        mode,
        receivable_collection: {
            receivable_collection_date: formatDateForInputLocal(default_date, timezone),
            note: '',
            principal_paid: '0.00',
            interest_paid: '0.00',
            category: null,
            account: null,
        },
    })
}

export const routeToFormUpdateReceivableCollection: RequestHandler = async (req, res) => {
    const mode = 'update'
    const auth_req = req as AuthRequest
    const timezone = auth_req.timezone || 'UTC'
    const receivable_collection_id = Number(req.params.id)
    const receivable_collection = await getCollectionById(auth_req, receivable_collection_id)
    if (!receivable_collection) {
        return res.redirect('/receivable_collections')
    }
    return renderReceivableCollectionForm(res, {
        title: 'Editar Cobro',
        view: 'pages/payable-receivable_collections/form',
        errors: {},
        mode,
        auth_req,
        receivable_collection: {
            ...receivable_collection,
            receivable_collection_date: formatDateForInputLocal(receivable_collection.collection_date, timezone)
        }
    })
}

export const routeToFormCloneReceivableCollection: RequestHandler = async (req, res) => {
    const mode = 'insert'
    const auth_req = req as AuthRequest
    const timezone = auth_req.timezone || 'UTC'
    const receivable_collection_id = Number(req.params.id)
    const receivable_collection = await getCollectionById(auth_req, receivable_collection_id)
    if (!receivable_collection) {
        return res.redirect('/receivable_collections')
    }
    const default_date = await getNextValidTransactionDate(auth_req)
    return renderReceivableCollectionForm(res, {
        title: 'Insertar Pago',
        view: 'pages/payable-receivable_collections/form',
        errors: {},
        mode,
        auth_req,
        receivable_collection: {
            ...receivable_collection,
            receivable_collection_date: formatDateForInputLocal(default_date, timezone)
        }
    })
}

export const routeToFormDeleteReceivableCollection: RequestHandler = async (req, res) => {
    const mode = 'delete'
    const auth_req = req as AuthRequest
    const timezone = auth_req.timezone || 'UTC'
    const receivable_collection_id = Number(req.params.id)
    const receivable_collection = await getCollectionById(auth_req, receivable_collection_id)
    if (!receivable_collection) {
        return res.redirect('/receivable_collections')
    }
    return renderReceivableCollectionForm(res, {
        title: 'Eliminar Cobro',
        view: 'pages/payable-receivable_collections/form',
        errors: {},
        mode,
        auth_req,
        receivable_collection: {
            ...receivable_collection,
            receivable_collection_date: formatDateForInputLocal(receivable_collection.collection_date, timezone)
        }
    })
}

/*=================================================
Api para devolver el DTO Payable en JSON
==================================================*/
export const apiForGettingReceivableCollections: RequestHandler = async (req: Request, res: Response) => {
    const auth_req = req as AuthRequest
    const payable_id = Number(req.params.payable_id)
    try {
        const receivable_collections = await getCollectionsForApi(auth_req, payable_id)
        res.json(receivable_collections)
    } catch (error) {
        logger.error(`${apiForGettingReceivableCollections.name}-Error. `, parseError(error))
        res.status(500).json({ error: 'Error al listar cobros' })
    } finally {
    }
}


