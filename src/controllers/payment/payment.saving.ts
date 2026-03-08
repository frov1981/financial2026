import { Request, RequestHandler, Response } from 'express'
import { DateTime } from 'luxon'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Account } from '../../entities/Account.entity'
import { Category } from '../../entities/Category.entity'
import { Loan } from '../../entities/Loan.entity'
import { LoanPayment } from '../../entities/LoanPayment.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { paymentFormMatrix } from '../../policies/payment-form.policy'
import { KpiCacheService } from '../../services/kpi-cache.service'
import { getNextPaymentNumber } from '../../services/loan-payment-number.service'
import { getActiveAccountsByUser, getActiveCategoriesForPaymentsByUser } from '../../services/populate-items.service'
import { AuthRequest } from '../../types/auth-request'
import { PaymentFormMode } from '../../types/form-view-params'
import { parseLocalDateToUTC } from '../../utils/date.util'
import { logger } from '../../utils/logger.util'
import { validateDeletePayment, validateSavePayment } from './payment.validator'

/* ============================
   Helpers
============================ */

const getTotal = (p: LoanPayment) => p.principal_paid + p.interest_paid

const applyLoanDelta = (loan: Loan, old_principal: number, new_principal: number) => {
    const delta = new_principal - old_principal
    loan.balance -= delta
}

const applyPrincipalDelta = (loan: Loan, old_principal: number, new_principal: number) => {
    const delta = new_principal - old_principal
    loan.principal_paid += delta
}

const applyInterestDelta = (loan: Loan, old_interest: number, new_interest: number) => {
    const delta = new_interest - old_interest
    loan.interest_paid += delta
}

const applyAccountDelta = (account: Account, old_total: number, new_total: number) => {
    const delta = new_total - old_total
    account.balance -= delta
}

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

const sanitizeByPolicy = (mode: PaymentFormMode, body: any) => {
    const policy = paymentFormMatrix[mode]
    const clean: any = {}

    for (const field in policy) {
        if ((policy[field] === 'edit' || policy[field] === 'read') && body[field] !== undefined) {
            clean[field] = body[field]
        }
    }
    return clean
}

/* ============================
   Construir objeto para la vista
============================ */

const buildPaymentView = (body: any, account_list: Account[], catetory_list: Category[]) => {
    const account_id = body.account_id ? Number(body.account_id) : null
    const account = account_id ? account_list.find(a => a.id === account_id) || null : null

    const category_id = body.category_id ? Number(body.category_id) : null
    const category = category_id ? catetory_list.find(c => c.id === category_id) || null : null

    return {
        ...body,
        account: account ? { id: account.id, name: account.name } : null,
        category: category ? { id: category.id, name: category.name } : null
    }
}

/* Obtiene una categoría activa por id desde el arreglo ya cargado */
function findCategorybyBody(body: any, active_category_list: Category[]): Category | null {
  const category_id = body.category_id ? Number(body.category_id) : null

  if (!category_id) return null

  return active_category_list.find(c => c.id === category_id) || null
}

/* Obtiene una categoría activa por id desde el arreglo ya cargado */
function findAccountbyBody(body: any, account_list: Account[]): Account | null {
  const account_id = body.account_id ? Number(body.account_id) : null

  if (!account_id) return null

  return account_list.find(a => a.id === account_id) || null
}
/* ============================
   Controller
============================ */

export const savePayment: RequestHandler = async (req: Request, res: Response) => {
    logger.debug(`${savePayment.name}-Start`)
    logger.info('savePayment called', { body: req.body, param: req.params })

    const auth_req = req as AuthRequest
    const user_id = auth_req.user.id
    const payment_id = req.body.id ? Number(req.body.id) : undefined
    const loan_id = req.body.loan_id ? Number(req.body.loan_id) : undefined
    const mode: PaymentFormMode = req.body.mode || 'insert'
    const timezone = auth_req.timezone || 'UTC'
    const return_from = req.body.return_from
    const return_category_id = Number(req.body.return_category_id) || null

    logger.debug(`${savePayment.name}-Timezone for saving payment: [${timezone}]`)

    const account_list = await getActiveAccountsByUser(auth_req)
    const active_expense_category_list = await getActiveCategoriesForPaymentsByUser(auth_req)

    const payment_view = buildPaymentView(req.body, account_list, active_expense_category_list)
    const form_state = {
        payment: payment_view,
        loan_id,
        account_list,
        active_expense_category_list,
        payment_form_policy: paymentFormMatrix[mode],
        mode,
        context: {
            from: return_from || null,
            category_id: return_category_id || null
        }
    }

    const queryRunner = AppDataSource.createQueryRunner()

    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {

        if (!loan_id) throw new Error('Préstamo es requerido')

        const loanRepo = queryRunner.manager.getRepository(Loan)
        const paymentRepo = queryRunner.manager.getRepository(LoanPayment)
        const transactionRepo = queryRunner.manager.getRepository(Transaction)
        const accountRepo = queryRunner.manager.getRepository(Account)
        const categoryRepo = queryRunner.manager.getRepository(Category)

        const loan = await loanRepo.findOneByOrFail({ id: loan_id })

        let existing: LoanPayment | null = null

        if (payment_id) {
            existing = await paymentRepo.findOne({
                where: { id: payment_id },
                relations: { transaction: true, account: true, loan: true }
            })

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

            loan.balance += existing.principal_paid
            loan.principal_paid -= existing.principal_paid
            loan.interest_paid -= existing.interest_paid

            const local_date = DateTime.fromJSDate(existing.transaction.date, { zone: 'utc' }).setZone(timezone)
            const period_year = local_date.year
            const period_month = local_date.month

            if (loan.balance > 0) loan.is_active = true

            await loanRepo.save(loan)

            existing.account.balance += total
            await accountRepo.save(existing.account)

            await paymentRepo.delete(existing.id)

            if (existing.transaction) {
                await transactionRepo.delete(existing.transaction.id)
            }

            await queryRunner.commitTransaction()

            KpiCacheService.recalcMonthlyKPIs(user_id, period_year, period_month, timezone)
                .catch(err => logger.error(`${savePayment.name}-Error recalculando KPI`, { err }))

            if (return_from === 'categories' && return_category_id) {
                return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
            }

            return res.redirect(`/payments/${loan_id}/loan`)
        }

        /* =========================
           INSERT / UPDATE
        ============================ */

        const clean = sanitizeByPolicy(mode, req.body)

        const account_id = Number(clean.account_id)
        if (!account_id) throw new Error('Cuenta es requerida')

        const account = await accountRepo.findOneByOrFail({
            id: account_id,
            user: { id: user_id }
        })

        const category_id = Number(clean.category_id)
        if (!category_id) throw new Error('Categoría es requerida')

        const category = await categoryRepo.findOneByOrFail({
            id: category_id,
            user: { id: user_id },
            is_active: true
        })

        let payment: LoanPayment
        let old_payment: LoanPayment | null = null

        let old_principal = 0
        let old_total = 0

        if (mode === 'insert') {
            const payment_number = await getNextPaymentNumber(loan_id)

            payment = paymentRepo.create({
                loan,
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
           UPDATE LOAN
        ============================ */

        if (!old_payment) {
            loan.balance -= payment.principal_paid
            loan.principal_paid += payment.principal_paid
            loan.interest_paid += payment.interest_paid
        } else {
            applyLoanDelta(loan, old_principal, payment.principal_paid)
            applyPrincipalDelta(loan, old_principal, payment.principal_paid)
            applyInterestDelta(loan, old_payment.interest_paid, payment.interest_paid)
        }

        if (loan.balance <= 0) {
            loan.balance = 0
            loan.is_active = false
        } else {
            loan.is_active = true
        }

        await loanRepo.save(loan)

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

        if (old_payment && old_payment.transaction) {

            trx = old_payment.transaction
            trx.amount = new_total
            trx.account = account
            trx.category = payment.category
            trx.date = payment.payment_date
            trx.description = payment.note

        } else {

            trx = transactionRepo.create({
                user: { id: auth_req.user.id } as any,
                type: 'expense',
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

        const local_date = DateTime.fromJSDate(trx.date, { zone: 'utc' }).setZone(timezone)
        const period_year = local_date.year
        const period_month = local_date.month

        KpiCacheService.recalcMonthlyKPIs(user_id, period_year, period_month, timezone)
            .catch(err => logger.error(`${savePayment.name}-Error recalculando KPI`, { err }))

        if (return_from === 'categories' && return_category_id) {
            return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
        }

        return res.redirect(`/payments/${loan_id}/loan`)

    } catch (err: any) {

        await queryRunner.rollbackTransaction()

        logger.error(`${savePayment.name}-Error.`, {
            user_id: auth_req.user.id,
            payment_id,
            loan_id,
            mode,
            error: err,
            stack: err?.stack
        })

        const validationErrors = err?.validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }

        return res.render('layouts/main', {
            title: getTitle(mode),
            view: 'pages/payments/form',
            ...form_state,
            errors: validationErrors
        })

    } finally {

        await queryRunner.release()
        logger.debug(`${savePayment.name}-End`)

    }
}