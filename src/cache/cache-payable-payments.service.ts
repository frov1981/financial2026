import { AppDataSource } from "../config/typeorm.datasource"
import { PayablePayment } from "../entities/PayablePayment.entity"
import { AuthRequest } from "../types/auth-request"
import { logger } from "../utils/logger.util"
import { cacheKeys } from "./cache-key.service"
import { cache } from "./cache.service"

export type DTOPayablePayment = {
    id: number
    payment_number: number
    principal_paid: number
    interest_paid: number
    payment_date: Date
    note: string | null
    created_at: Date
    account: { id: number, name: string } | null
    category: { id: number, name: string } | null
    payable: { id: number, name: string } | null
}

const getPaymentsBase = async (user_id: number): Promise<PayablePayment[]> => {
    const cache_key = cacheKeys.paymentsByUser(user_id)
    const cached_payments = cache.get<PayablePayment[]>(cache_key)
    if (cached_payments !== undefined) return cached_payments

    const repo = AppDataSource.getRepository(PayablePayment)
    const payments: PayablePayment[] = await repo.find({
        where: { payable: { user: { id: user_id } } },
        relations: { payable: true, category: true, account: true, transaction: true },
    })

    cache.set(cache_key, payments)
    return payments
}

export const getPayments = async (auth_req: AuthRequest): Promise<PayablePayment[]> => {
    const user_id = auth_req.user.id
    const payments: PayablePayment[] = await getPaymentsBase(user_id)
    return payments
}

export const getPaymentById = async (auth_req: AuthRequest, payment_id: number): Promise<PayablePayment | null> => {
    const user_id = auth_req.user.id
    const payments = await getPaymentsBase(user_id)
    const payment = payments.find(payment => payment.id === payment_id)
    return payment || null
}

export const getPaymentsForApi = async (auth_req: AuthRequest, payable_id: number): Promise<DTOPayablePayment[]> => {
    const user_id = auth_req.user.id
    const cache_key = cacheKeys.paymentsByPayableForApi(user_id, payable_id)

    const cached = cache.get<DTOPayablePayment[]>(cache_key)
    if (cached !== undefined) return cached

    const repo = AppDataSource.getRepository(PayablePayment)
    const start = performance.now()

    const result = await repo.find({
        where: { payable: { id: payable_id } },
        relations: { payable: true, account: true, category: true },
        order: { payment_date: 'DESC' }
    })

    const payments: DTOPayablePayment[] = result.map(p => ({
        id: p.id,
        payment_number: p.payment_number,
        principal_paid: p.principal_paid,
        interest_paid: p.interest_paid,
        payment_date: p.payment_date,
        note: p.note,
        created_at: p.created_at,
        account: p.account ? { id: p.account.id, name: p.account.name } : null,
        category: p.category ? { id: p.category.id, name: p.category.name } : null,
        payable: p.payable ? { id: p.payable.id, name: p.payable.name } : null
    }))

    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`method=[${getPaymentsForApi.name}], cacheKey=[${cache_key}], payable=[${payable_id}], user=[${user_id}], entity=[payable_payment], count=[${payments.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    cache.set(cache_key, payments)
    return payments
}