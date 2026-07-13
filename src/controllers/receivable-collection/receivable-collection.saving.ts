import { Request, RequestHandler, Response } from 'express';
import { performance } from 'perf_hooks';
import { getAccountById, getActiveAccounts } from '../../cache/cache-accounts.service';
import { getCategoryById } from '../../cache/cache-categories.service';
import { deleteAll } from '../../cache/cache-key.service';
import { getReceivableById } from '../../cache/cache-receivables.service';
import { AppDataSource } from '../../config/typeorm.datasource';
import { Account } from '../../entities/Account.entity';
import { Receivable } from '../../entities/Receivable.entity';
import { ReceivableCollection } from '../../entities/ReceivableCollection.entity';
import { Transaction } from '../../entities/Transaction.entity';
import { KpiCacheService } from '../../services/kpi-cache.service';
import { AuthRequest } from '../../types/auth-request';
import { ReceivableCollectionFormMode } from '../../types/form-view-params';
import { parseBoolean } from '../../utils/bool.util';
import { parseLocalDateToUTC } from '../../utils/date.util';
import { parseError } from '../../utils/error.util';
import { logger } from '../../utils/logger.util';
import { receivableCollectionFormMatrix } from '../../policies/payable-receivable_collection-form.policy';
import { getActiveCategoriesForReceivableCollectionsByUser, getCollectionById } from '../../cache/cache-receivable-collections.service';
import { validateDeleteReceivableCollection, validateSaveReceivableCollection } from './receivable-collection.validator';

/* ============================
   Helpers
============================ */
const getTotal = (p: ReceivableCollection) => p.principal_collected + p.interest_collected

const applyReceivableDelta = (receivable: Receivable, old_principal: number, new_principal: number) => {
    const delta = new_principal - old_principal
    receivable.balance -= delta
}

const applyPrincipalDelta = (receivable: Receivable, old_principal: number, new_principal: number) => {
    const delta = new_principal - old_principal
    receivable.principal_received += delta
}

const applyInterestDelta = (receivable: Receivable, old_interest: number, new_interest: number) => {
    const delta = new_interest - old_interest
    receivable.interest_received += delta
}

const applyAccountDelta = (account: Account, old_total: number, new_total: number) => {
    const delta = new_total - old_total
    account.balance += delta
}

/* ============================
   Obtener título según el modo del formulario
============================ */
const getTitle = (mode: string) => {
    switch (mode) {
        case 'insert': return 'Registrar Pago'
        case 'update': return 'Editar Pago'
        case 'delete': return 'Eliminar Pago'
        default: return 'Indefinido'
    }
}

/* ============================
   Sanitizar payload según policy
============================ */

const sanitizeByPolicy = (mode: ReceivableCollectionFormMode, body: any) => {
    const policy = receivableCollectionFormMatrix[mode]
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
const buildPaymentView = async (auth_req: AuthRequest, body: any) => {
    const account_id = Number(body.account_id)
    const category_id = Number(body.category_id)
    const account = await getAccountById(auth_req, account_id)
    const category = await getCategoryById(auth_req, category_id)

    return {
        ...body,
        is_active: parseBoolean(body.is_active),
        account,
        category,
    }
}

/* ============================
   Controller
============================ */
export const saveReceivableCollection: RequestHandler = async (req: Request, res: Response) => {
    const start = performance.now()
    logger.info(`${saveReceivableCollection.name} called`, { body: req.body, param: req.params })
    const auth_req = req as AuthRequest
    const user_id = auth_req.user.id
    const timezone = auth_req.timezone || 'UTC'
    const receivableCollection_id = Number(req.body.id)
    const receivable_id = Number(req.body.receivable_id)
    const mode: ReceivableCollectionFormMode = req.body.mode || 'insert'
    const return_from = req.body.return_from
    const return_category_id = Number(req.body.return_category_id) || null

    const form_state = {
        receivableCollection: await buildPaymentView(auth_req, req.body),
        receivable_id,
        account_list: await getActiveAccounts(auth_req),
        active_expense_category_list: await getActiveCategoriesForReceivableCollectionsByUser(auth_req),
        receivableCollection_form_policy: receivableCollectionFormMatrix[mode],
        mode,
        context: { from: return_from || null, category_id: return_category_id || null }
    }

    const queryRunner = AppDataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
        if (!receivable_id) throw new Error('Cuenta por pagar es requerida')

        const receivableRepo = queryRunner.manager.getRepository(Receivable)
        const receivableCollectionRepo = queryRunner.manager.getRepository(ReceivableCollection)
        const transactionRepo = queryRunner.manager.getRepository(Transaction)
        const accountRepo = queryRunner.manager.getRepository(Account)

        const receivable = await getReceivableById(auth_req, receivable_id)
        if (!receivable) throw new Error('Cuenta por pagar no encontrada')

        let existing: ReceivableCollection | null = null
        if (receivableCollection_id) {
            existing = await getCollectionById(auth_req, receivableCollection_id)
            if (!existing) throw new Error('Pago no encontrado')
        }
        /* =========================
           DELETE
        ============================ */
        if (mode === 'delete') {
            if (!existing) throw new Error('Pago no encontrado')
            const errors = await validateDeleteReceivableCollection(auth_req, existing)
            if (errors) throw { validationErrors: errors }
            const total = getTotal(existing)
            receivable.balance += existing.principal_collected
            receivable.principal_received -= existing.principal_collected
            receivable.interest_received -= existing.interest_collected
            if (receivable.balance > 0) receivable.is_active = true
            await receivableRepo.save(receivable)
            existing.account.balance -= total
            await accountRepo.save(existing.account)
            await receivableCollectionRepo.delete(existing.id)

            if (existing.transaction) {
                await transactionRepo.delete(existing.transaction.id)
            }
            await queryRunner.commitTransaction()
            deleteAll(auth_req, 'receivable_collection')

            KpiCacheService
                .recalculateBalanceKPIByTransaction(auth_req, existing.transaction)
                .catch(error => logger.error(`${saveReceivableCollection.name}-Error recalculando KPI Balance`, parseError(error)))

            KpiCacheService
                .recalculateCategoryKPIByTransaction(auth_req, existing.transaction)
                .catch(error => logger.error(`${saveReceivableCollection.name}-Error recalculando KPI Categorías`, parseError(error)))

                if (return_from === 'categories' && return_category_id) {
                return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
            }
            return res.redirect(`/receivableCollections/${receivable_id}/receivable`)
        }
        /* =========================
           INSERT / UPDATE
        ============================ */
        const clean = sanitizeByPolicy(mode, req.body)

        const account_id = Number(clean.account_id)
        const account = await getAccountById(auth_req, account_id)
        if (!account) throw new Error('Cuenta es requerida')

        const category_id = Number(clean.category_id)
        const category = await getCategoryById(auth_req, category_id)
        if (!category) throw new Error('Categoría es requerida')

        let receivableCollection: ReceivableCollection
        let old_receivableCollection: ReceivableCollection | null = null
        let old_principal = 0
        let old_total = 0

        if (mode === 'insert') {
            const principal_collected = Number(clean.principal_collected ?? clean.principal_paid ?? 0)
            const interest_collected = Number(clean.interest_collected ?? clean.interest_paid ?? 0)
            const collection_number = 0

            receivableCollection = receivableCollectionRepo.create({
                receivable,
                account,
                category,
                collection_number,
                principal_collected,
                interest_collected,
                note: clean.note || '',
                collection_date: parseLocalDateToUTC(clean.collection_date ?? clean.payment_date ?? clean.receivableCollection_date, timezone)
            })
        } else {
            if (!existing) throw new Error('Pago no encontrado')
            old_receivableCollection = structuredClone(existing)
            old_principal = existing.principal_collected
            old_total = getTotal(existing)
            receivableCollection = existing
            if (clean.note !== undefined) receivableCollection.note = clean.note
            if (clean.principal_collected !== undefined || clean.principal_paid !== undefined) {
                receivableCollection.principal_collected = Number(clean.principal_collected ?? clean.principal_paid)
            }
            if (clean.interest_collected !== undefined || clean.interest_paid !== undefined) {
                receivableCollection.interest_collected = Number(clean.interest_collected ?? clean.interest_paid)
            }
            if (clean.collection_date !== undefined || clean.payment_date !== undefined || clean.receivableCollection_date !== undefined) {
                receivableCollection.collection_date = parseLocalDateToUTC(clean.collection_date ?? clean.payment_date ?? clean.receivableCollection_date, timezone)
            }
            receivableCollection.account = account
            receivableCollection.category = category
        }

        const errors = await validateSaveReceivableCollection(auth_req, receivableCollection, old_receivableCollection)
        if (errors) throw { validationErrors: errors }

        /* =========================
           UPDATE PAYABLE
        ============================ */
        if (!old_receivableCollection) {
            receivable.balance -= receivableCollection.principal_collected
            receivable.principal_received += receivableCollection.principal_collected
            receivable.interest_received += receivableCollection.interest_collected
        } else {
            applyReceivableDelta(receivable, old_principal, receivableCollection.principal_collected)
            applyPrincipalDelta(receivable, old_principal, receivableCollection.principal_collected)
            applyInterestDelta(receivable, old_receivableCollection.interest_collected, receivableCollection.interest_collected)
        }
        if (receivable.balance <= 0) {
            receivable.balance = 0
            receivable.is_active = false
        } else {
            receivable.is_active = true
        }
        await receivableRepo.save(receivable)

        /* =========================
           UPDATE ACCOUNT
        ============================ */
        const new_total = getTotal(receivableCollection)
        if (!old_receivableCollection) {
            account.balance += new_total
        } else {
            applyAccountDelta(account, old_total, new_total)
        }
        await accountRepo.save(account)

        /* =========================
           TRANSACTION
        ============================ */
        let trx: Transaction
        if (old_receivableCollection?.transaction?.id) {
            trx = old_receivableCollection.transaction
            trx.type = 'income'
            trx.amount = new_total
            trx.account = account
            trx.category = receivableCollection.category
            trx.date = receivableCollection.collection_date
            trx.description = receivableCollection.note
            trx.detailed_type = 'collection_for_receivable'
        } else {
            trx = transactionRepo.create({
                user: { id: auth_req.user.id } as any,
                type: 'income',
                detailed_type: 'collection_for_receivable',
                amount: new_total,
                account,
                category: receivableCollection.category,
                date: receivableCollection.collection_date,
                description: receivableCollection.note
            })
        }

        await transactionRepo.save(trx)
        receivableCollection.transaction = trx
        await receivableCollectionRepo.save(receivableCollection)
        await queryRunner.commitTransaction()
        deleteAll(auth_req, 'receivable_collection')

        KpiCacheService
            .recalculateBalanceKPIByTransaction(auth_req, trx)
            .catch(error => logger.error(`${saveReceivableCollection.name}-Error recalculando KPI Balance`, parseError(error)))

        KpiCacheService
            .recalculateCategoryKPIByTransaction(auth_req, trx)
            .catch(error => logger.error(`${saveReceivableCollection.name}-Error recalculando KPI Categorías`, parseError(error)))

            if (return_from === 'categories' && return_category_id) {
            return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
        }
        return res.redirect(`/receivableCollections/${receivable_id}/receivable`)
    } catch (error: any) {
        /* ============================
            Manejo de errores
        ============================ */
        await queryRunner.rollbackTransaction()
        logger.error(`${saveReceivableCollection.name}-Error.`, { user_id: auth_req.user.id, receivableCollection_id, receivable_id, mode, error: parseError(error), })

        const validationErrors = error?.validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
        return res.render('layouts/main', {
            title: getTitle(mode),
            view: 'pages/receivable-receivableCollections/form',
            ...form_state,
            errors: validationErrors
        })
    } finally {
        await queryRunner.release()
        const end = performance.now()
        const duration_sec = (end - start) / 1000
        logger.debug(`${saveReceivableCollection.name}. user=[${user_id}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    }
}