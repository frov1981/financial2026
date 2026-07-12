import { performance } from 'perf_hooks';
import { AppDataSource } from "../config/typeorm.datasource";
import { Category } from "../entities/Category.entity";
import { Payable } from "../entities/Payable.entity";
import { AuthRequest } from "../types/auth-request";
import { logger } from '../utils/logger.util';
import { cacheKeys } from "./cache-key.service";
import { cache } from "./cache.service";

type DTOPayable = {
    id: number
    name: string
    total_amount: number
    principal_paid: number
    interest_paid: number
    balance: number
    start_date: Date
    end_date: Date | null
    is_active: boolean
    created_at: Date
    note: string | null
    disbursement_account: { id: number, name: string } | null
    category: { id: number, name: string } | null
    payable_group: { id: number, name: string } | null
}

type DTOPayableGroupTotal = {
    payable_group_id: number
    payable_group_name: string
    total_balance: number
}

const getPayablesBase = async (user_id: number): Promise<Payable[]> => {
    const cache_key = cacheKeys.payablesByUser(user_id)
    const cached_payables = cache.get<Payable[]>(cache_key)
    if (cached_payables !== undefined) {
        return cached_payables
    }
    const repo = AppDataSource.getRepository(Payable)
    const payables: Payable[] = await repo.find({
        where: { user: { id: user_id } },
        relations: { payable_group: true, category: true, disbursement_account: true, transaction: true, payments: true },
        order: { name: 'ASC' }
    })
    cache.set(cache_key, payables)
    return payables
}

export const getPayables = async (auth_req: AuthRequest): Promise<Payable[]> => {
    const user_id = auth_req.user.id
    const payables: Payable[] = await getPayablesBase(user_id)
    return payables
}

export const getPayableById = async (auth_req: AuthRequest, payable_id: number): Promise<Payable | null> => {
    const user_id = auth_req.user.id
    const payables = await getPayablesBase(user_id)
    const payable = payables.find(payable => payable.id === payable_id)
    return payable || null
}

export const getPayableByName = async (auth_req: AuthRequest, name: string): Promise<Payable | null> => {
    const user_id = auth_req.user.id
    const payables = await getPayablesBase(user_id)
    const payable = payables.find(payable => payable.name.toLowerCase() === name.toLowerCase())
    return payable || null
}

export const getActivePayableById = async (auth_req: AuthRequest, payable_id: number): Promise<Payable | null> => {
    const user_id = auth_req.user.id
    const payables = await getPayablesBase(user_id)
    const payable = payables.find(payable => payable.id === payable_id && payable.is_active)
    return payable || null
}

export const getActivePayables = async (auth_req: AuthRequest): Promise<Payable[]> => {
    const user_id = auth_req.user.id
    const payables: Payable[] = await getPayablesBase(user_id)
    const active_payables: Payable[] = payables.filter(payable => payable.is_active)
    return active_payables
}

export const getActiveCategoriesForPayablesByUser = async (auth_req: AuthRequest): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const cache_key = cacheKeys.payableCategoriesByUser(user_id)
    const cached_categories = cache.get<Category[]>(cache_key)
    if (cached_categories !== undefined) {
        return cached_categories
    }

    const repo = AppDataSource.getRepository(Category)
    const categories = await repo.find({
        where: {
            user: { id: user_id },
            is_active: true,
            type_for_payable_or_receivable: 'payable'
        },
        order: { name: 'ASC' }
    })

    cache.set(cache_key, categories)
    return categories
}

export const getInactivePayables = async (auth_req: AuthRequest): Promise<Payable[]> => {
    const user_id = auth_req.user.id
    const payables: Payable[] = await getPayablesBase(user_id)
    const inactive_payables: Payable[] = payables.filter(payable => !payable.is_active)
    return inactive_payables
}

export const getPayablesForApi = async (auth_req: AuthRequest): Promise<{ payables: DTOPayable[], group_totals: DTOPayableGroupTotal[] }> => {
    const user_id = auth_req.user.id
    const cache_key = cacheKeys.payablesByUserForApi(user_id)
    const cached_payables = cache.get<{ payables: DTOPayable[], group_totals: DTOPayableGroupTotal[] }>(cache_key)
    if (cached_payables !== undefined) {
        return cached_payables
    }

    const repository = AppDataSource.getRepository(Payable)
    const start = performance.now()
    const result = await repository
        .createQueryBuilder('payable')
        .leftJoinAndSelect('payable.payable_group', 'payable_group')
        .leftJoinAndSelect('payable.disbursement_account', 'disbursement_account')
        .leftJoinAndSelect('payable.category', 'category')
        .where('payable.user_id = :user_id', { user_id })
        .orderBy('payable_group.name', 'ASC')
        .addOrderBy('payable.name', 'ASC')
        .getMany()

    const payables: DTOPayable[] = result.map(payable => ({
        id: payable.id,
        name: payable.name,
        total_amount: payable.total_amount,
        principal_paid: payable.principal_paid,
        interest_paid: payable.interest_paid,
        balance: payable.balance,
        start_date: payable.start_date,
        end_date: payable.end_date,
        is_active: payable.is_active,
        created_at: payable.created_at,
        note: payable.note,
        disbursement_account: payable.disbursement_account ? { id: payable.disbursement_account.id, name: payable.disbursement_account.name } : null,
        category: payable.category ? { id: payable.category.id, name: payable.category.name } : null,
        payable_group: payable.payable_group ? { id: payable.payable_group.id, name: payable.payable_group.name } : null
    }))

    const group_totals_map: Record<number, DTOPayableGroupTotal> = {}

    for (const payable of result) {
        if (!payable.payable_group) continue
        const group_id = payable.payable_group.id

        if (!group_totals_map[group_id]) {
            group_totals_map[group_id] = {
                payable_group_id: group_id,
                payable_group_name: payable.payable_group.name,
                total_balance: 0
            }
        }

        group_totals_map[group_id].total_balance += Number(payable.balance)
    }

    const group_totals = Object.values(group_totals_map)
    const response = { payables, group_totals }
    
    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`method=[${getPayablesForApi.name}], cacheKey=[${cache_key}], user=[${user_id}], entity=[payable], count=[${payables.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    cache.set(cache_key, response)
    return response
}