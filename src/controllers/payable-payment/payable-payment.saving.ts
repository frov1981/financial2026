import { Request, RequestHandler, Response } from 'express';
import { performance } from 'perf_hooks';
import { getAccountById, getActiveAccounts } from '../../cache/cache-accounts.service';
import { getCategoryById } from '../../cache/cache-categories.service';
import { deleteAll } from '../../cache/cache-key.service';
import { getPaymentById } from '../../cache/cache-payable-payments.service';
import { getPayableById } from '../../cache/cache-payables.service';
import { AppDataSource } from '../../config/typeorm.datasource';
import { Account } from '../../entities/Account.entity';
import { Payable } from '../../entities/Payable.entity';
import { PayablePayment } from '../../entities/PayablePayment.entity';
import { Transaction } from '../../entities/Transaction.entity';
import { payablePaymentFormMatrix } from '../../policies/payable-payment-form.policy';
import { KpiCacheService } from '../../services/kpi-cache.service';
import { getNextPayablePaymentNumber } from '../../services/payable-payment-number.service';
import { getActiveCategoriesForPaymentsByUser } from '../../services/populate-items.service';
import { AuthRequest } from '../../types/auth-request';
import { PayablePaymentFormMode } from '../../types/form-view-params';
import { parseBoolean } from '../../utils/bool.util';
import { parseLocalDateToUTC } from '../../utils/date.util';
import { parseError } from '../../utils/error.util';
import { logger } from '../../utils/logger.util';
import { validateDeletePayment, validateSavePayment } from './payable-payment.validator';

/* ============================
   Helpers
============================ */
const getTotal = (p: PayablePayment) => p.principal_paid + p.interest_paid

const applyPayableDelta = (payable: Payable, old_principal: number, new_principal: number) => {
    const delta = new_principal - old_principal
    payable.balance -= delta
}

const applyPrincipalDelta = (payable: Payable, old_principal: number, new_principal: number) => {
    const delta = new_principal - old_principal
    payable.principal_paid += delta
}

const applyInterestDelta = (payable: Payable, old_interest: number, new_interest: number) => {
    const delta = new_interest - old_interest
    payable.interest_paid += delta
}

const applyAccountDelta = (account: Account, old_total: number, new_total: number) => {
    const delta = new_total - old_total
    account.balance -= delta
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

const sanitizeByPolicy = (mode: PayablePaymentFormMode, body: any) => {
    const policy = payablePaymentFormMatrix[mode]
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
export const savePayment: RequestHandler = async (req: Request, res: Response) => {
    const start = performance.now()
    logger.info(`${savePayment.name} called`, { body: req.body, param: req.params })
    const auth_req = req as AuthRequest
    const user_id = auth_req.user.id
    const timezone = auth_req.timezone || 'UTC'
    const payment_id = Number(req.body.id)
    const payable_id = Number(req.body.payable_id)
    const mode: PayablePaymentFormMode = req.body.mode || 'insert'
    const return_from = req.body.return_from
    const return_category_id = Number(req.body.return_category_id) || null

    const form_state = {
        payment: await buildPaymentView(auth_req, req.body),
        payable_id,
        account_list: await getActiveAccounts(auth_req),
        active_expense_category_list: await getActiveCategoriesForPaymentsByUser(auth_req),
        payment_form_policy: payablePaymentFormMatrix[mode],
        mode,
        context: { from: return_from || null, category_id: return_category_id || null }
    }

    const queryRunner = AppDataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
        if (!payable_id) throw new Error('Cuenta por pagar es requerida')

        const payableRepo = queryRunner.manager.getRepository(Payable)
        const paymentRepo = queryRunner.manager.getRepository(PayablePayment)
        const transactionRepo = queryRunner.manager.getRepository(Transaction)
        const accountRepo = queryRunner.manager.getRepository(Account)

        const payable = await getPayableById(auth_req, payable_id)
        if (!payable) throw new Error('Cuenta por pagar no encontrada')

        let existing: PayablePayment | null = null
        if (payment_id) {
            existing = await getPaymentById(auth_req, payment_id)
            if (!existing) throw new Error('Pago no encontrado')
        }
        /* =========================
           DELETE
        ============================ */
        if (mode === 'delete') {
            if (!existing) throw new Error('Pago no encontrado')
            const errors = await validateDeletePayment(auth_req, existing)
            if (errors) throw { validationErrors: errors }
            const total = getTotal(existing)
            payable.balance += existing.principal_paid
            payable.principal_paid -= existing.principal_paid
            payable.interest_paid -= existing.interest_paid
            if (payable.balance > 0) payable.is_active = true
            await payableRepo.save(payable)
            existing.account.balance += total
            await accountRepo.save(existing.account)
            await paymentRepo.delete(existing.id)

            if (existing.transaction) {
                await transactionRepo.delete(existing.transaction.id)
            }
            await queryRunner.commitTransaction()
            deleteAll(auth_req, 'payable_payment')

            KpiCacheService
                .recalculateBalanceKPIByTransaction(auth_req, existing.transaction)
                .catch(error => logger.error(`${savePayment.name}-Error recalculando KPI Balance`, parseError(error)))

            KpiCacheService
                .recalculateCategoryKPIByTransaction(auth_req, existing.transaction)
                .catch(error => logger.error(`${savePayment.name}-Error recalculando KPI Categorías`, parseError(error)))

                if (return_from === 'categories' && return_category_id) {
                return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
            }
            return res.redirect(`/payments/${payable_id}/payable`)
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

        let payment: PayablePayment
        let old_payment: PayablePayment | null = null
        let old_principal = 0
        let old_total = 0

        if (mode === 'insert') {
            const principal_paid = Number(clean.principal_paid || 0)
            const payment_number = principal_paid > 0 ? await getNextPayablePaymentNumber(payable_id) : 0

            payment = paymentRepo.create({
                payable,
                account,
                category,
                payment_number,
                principal_paid: Number(clean.principal_paid || 0),
                interest_paid: Number(clean.interest_paid || 0),
                note: clean.note || '',
                payment_date: parseLocalDateToUTC(clean.payment_date, timezone)
            })
        } else {
            if (!existing) throw new Error('Pago no encontrado')
            old_payment = structuredClone(existing)
            old_principal = existing.principal_paid
            old_total = getTotal(existing)
            payment = existing
            if (clean.note !== undefined) payment.note = clean.note
            if (clean.principal_paid !== undefined) payment.principal_paid = Number(clean.principal_paid)
            if (clean.interest_paid !== undefined) payment.interest_paid = Number(clean.interest_paid)
            if (clean.payment_date !== undefined) payment.payment_date = parseLocalDateToUTC(clean.payment_date, timezone)
            payment.account = account
            payment.category = category
        }

        const errors = await validateSavePayment(auth_req, payment, old_payment)
        if (errors) throw { validationErrors: errors }

        /* =========================
           UPDATE PAYABLE
        ============================ */
        if (!old_payment) {
            payable.balance -= payment.principal_paid
            payable.principal_paid += payment.principal_paid
            payable.interest_paid += payment.interest_paid
        } else {
            applyPayableDelta(payable, old_principal, payment.principal_paid)
            applyPrincipalDelta(payable, old_principal, payment.principal_paid)
            applyInterestDelta(payable, old_payment.interest_paid, payment.interest_paid)
        }
        if (payable.balance <= 0) {
            payable.balance = 0
            payable.is_active = false
        } else {
            payable.is_active = true
        }
        await payableRepo.save(payable)

        /* =========================
           UPDATE ACCOUNT
        ============================ */
        const new_total = getTotal(payment)
        if (!old_payment) {
            account.balance -= new_total
        } else {
            applyAccountDelta(account, old_total, new_total)
        }
        await accountRepo.save(account)

        /* =========================
           TRANSACTION
        ============================ */
        let trx: Transaction
        if (old_payment?.transaction?.id) {
            trx = old_payment.transaction
            trx.amount = new_total
            trx.account = account
            trx.category = payment.category
            trx.date = payment.payment_date
            trx.description = payment.note
            trx.detailed_type = 'payment_for_payable'
        } else {
            trx = transactionRepo.create({
                user: { id: auth_req.user.id } as any,
                type: 'expense',
                detailed_type: 'payment_for_payable',
                amount: new_total,
                account,
                category: payment.category,
                date: payment.payment_date,
                description: payment.note
            })
        }

        await transactionRepo.save(trx)
        payment.transaction = trx
        await paymentRepo.save(payment)
        await queryRunner.commitTransaction()
        deleteAll(auth_req, 'payable_payment')

        KpiCacheService
            .recalculateBalanceKPIByTransaction(auth_req, trx)
            .catch(error => logger.error(`${savePayment.name}-Error recalculando KPI Balance`, parseError(error)))

        KpiCacheService
            .recalculateCategoryKPIByTransaction(auth_req, trx)
            .catch(error => logger.error(`${savePayment.name}-Error recalculando KPI Categorías`, parseError(error)))

            if (return_from === 'categories' && return_category_id) {
            return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
        }
        return res.redirect(`/payments/${payable_id}/payable`)
    } catch (error: any) {
        /* ============================
            Manejo de errores
        ============================ */
        await queryRunner.rollbackTransaction()
        logger.error(`${savePayment.name}-Error.`, { user_id: auth_req.user.id, payment_id, payable_id, mode, error: parseError(error), })

        const validationErrors = error?.validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
        return res.render('layouts/main', {
            title: getTitle(mode),
            view: 'pages/payable-payments/form',
            ...form_state,
            errors: validationErrors
        })
    } finally {
        await queryRunner.release()
        const end = performance.now()
        const duration_sec = (end - start) / 1000
        logger.debug(`${savePayment.name}. user=[${user_id}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    }
}