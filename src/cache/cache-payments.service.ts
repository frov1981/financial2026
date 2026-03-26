import { AppDataSource } from "../config/typeorm.datasource"
import { LoanPayment } from "../entities/LoanPayment.entity"
import { AuthRequest } from "../types/auth-request"
import { logger } from "../utils/logger.util"
import { cacheKeys } from "./cache-key.service"
import { cache } from "./cache.service"

export type DTOLoanPayment = {
    id: number
    payment_number: number
    principal_paid: number
    interest_paid: number
    payment_date: Date
    note: string | null
    created_at: Date
    account: { id: number, name: string } | null
    category: { id: number, name: string } | null
    loan: { id: number, name: string } | null
}

const getPaymentsBase = async (user_id: number): Promise<LoanPayment[]> => {
    const cache_key = cacheKeys.paymentsByUser(user_id)
    const cached_payments = cache.get<LoanPayment[]>(cache_key)
    if (cached_payments !== undefined) return cached_payments

    const repo = AppDataSource.getRepository(LoanPayment)
    const payments: LoanPayment[] = await repo.find({
        where: { loan: { user: { id: user_id } } },
        relations: { loan: true, category: true, account: true },
    })

    cache.set(cache_key, payments)
    return payments
}

export const getPayments = async (auth_req: AuthRequest): Promise<LoanPayment[]> => {
    const user_id = auth_req.user.id
    const payments: LoanPayment[] = await getPaymentsBase(user_id)
    return payments
}

export const getPaymentById = async (auth_req: AuthRequest, payment_id: number): Promise<LoanPayment | null> => {
    const user_id = auth_req.user.id
    const payments = await getPaymentsBase(user_id)
    const payment = payments.find(payment => payment.id === payment_id)
    return payment || null
}

export const getPaymentsForApi = async (auth_req: AuthRequest, loan_id: number): Promise<DTOLoanPayment[]> => {
    const user_id = auth_req.user.id
    const cache_key = cacheKeys.paymentsByLoanForApi(user_id, loan_id)

    const cached = cache.get<DTOLoanPayment[]>(cache_key)
    if (cached !== undefined) return cached

    const repo = AppDataSource.getRepository(LoanPayment)
    const start = performance.now()

    const result = await repo.find({
        where: { loan: { id: loan_id } },
        relations: { loan: true, account: true, category: true },
        order: { payment_date: 'DESC' }
    })

    const payments: DTOLoanPayment[] = result.map(p => ({
        id: p.id,
        payment_number: p.payment_number,
        principal_paid: p.principal_paid,
        interest_paid: p.interest_paid,
        payment_date: p.payment_date,
        note: p.note,
        created_at: p.created_at,
        account: p.account ? { id: p.account.id, name: p.account.name } : null,
        category: p.category ? { id: p.category.id, name: p.category.name } : null,
        loan: p.loan ? { id: p.loan.id, name: p.loan.name } : null
    }))

    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`method=[${getPaymentsForApi.name}], cacheKey=[${cache_key}], loan=[${loan_id}], user=[${user_id}], entity=[loan_payment], count=[${payments.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    cache.set(cache_key, payments)
    return payments
}