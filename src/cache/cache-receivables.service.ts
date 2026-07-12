import { performance } from 'perf_hooks';
import { AppDataSource } from "../config/typeorm.datasource";
import { Category } from "../entities/Category.entity";
import { Receivable } from "../entities/Receivable.entity";
import { AuthRequest } from "../types/auth-request";
import { logger } from '../utils/logger.util';
import { cacheKeys } from "./cache-key.service";
import { cache } from "./cache.service";

type DTOReceivable = {
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
    receivable_group: { id: number, name: string } | null
}

type DTOReceivableGroupTotal = {
    receivable_group_id: number
    receivable_group_name: string
    total_balance: number
}

const getReceivablesBase = async (user_id: number): Promise<Receivable[]> => {
    const cache_key = cacheKeys.receivablesByUser(user_id)
    const cached_receivables = cache.get<Receivable[]>(cache_key)
    if (cached_receivables !== undefined) {
        return cached_receivables
    }
    const repo = AppDataSource.getRepository(Receivable)
    const receivables: Receivable[] = await repo.find({
        where: { user: { id: user_id } },
        relations: { receivable_group: true, category: true, disbursement_account: true, transaction: true, collections: true },
        order: { name: 'ASC' }
    })
    cache.set(cache_key, receivables)
    return receivables
}

export const getReceivables = async (auth_req: AuthRequest): Promise<Receivable[]> => {
    const user_id = auth_req.user.id
    const receivables: Receivable[] = await getReceivablesBase(user_id)
    return receivables
}

export const getReceivableById = async (auth_req: AuthRequest, receivable_id: number): Promise<Receivable | null> => {
    const user_id = auth_req.user.id
    const receivables = await getReceivablesBase(user_id)
    const receivable = receivables.find(receivable => receivable.id === receivable_id)
    return receivable || null
}

export const getReceivableByName = async (auth_req: AuthRequest, name: string): Promise<Receivable | null> => {
    const user_id = auth_req.user.id
    const receivables = await getReceivablesBase(user_id)
    const receivable = receivables.find(receivable => receivable.name.toLowerCase() === name.toLowerCase())
    return receivable || null
}

export const getActiveReceivableById = async (auth_req: AuthRequest, receivable_id: number): Promise<Receivable | null> => {
    const user_id = auth_req.user.id
    const receivables = await getReceivablesBase(user_id)
    const receivable = receivables.find(receivable => receivable.id === receivable_id && receivable.is_active)
    return receivable || null
}

export const getActiveReceivables = async (auth_req: AuthRequest): Promise<Receivable[]> => {
    const user_id = auth_req.user.id
    const receivables: Receivable[] = await getReceivablesBase(user_id)
    const active_receivables: Receivable[] = receivables.filter(receivable => receivable.is_active)
    return active_receivables
}

export const getActiveCategoriesForReceivablesByUser = async (auth_req: AuthRequest): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const cache_key = cacheKeys.receivableCategoriesByUser(user_id)
    const cached_categories = cache.get<Category[]>(cache_key)
    if (cached_categories !== undefined) {
        return cached_categories
    }

    const repo = AppDataSource.getRepository(Category)
    const categories = await repo.find({
        where: {
            user: { id: user_id },
            is_active: true,
            type_for_payable_or_receivable: 'receivable'
        },
        order: { name: 'ASC' }
    })

    cache.set(cache_key, categories)
    return categories
}

export const getInactiveReceivables = async (auth_req: AuthRequest): Promise<Receivable[]> => {
    const user_id = auth_req.user.id
    const receivables: Receivable[] = await getReceivablesBase(user_id)
    const inactive_receivables: Receivable[] = receivables.filter(receivable => !receivable.is_active)
    return inactive_receivables
}

export const getReceivablesForApi = async (auth_req: AuthRequest): Promise<{ receivables: DTOReceivable[], group_totals: DTOReceivableGroupTotal[] }> => {
    const user_id = auth_req.user.id
    const cache_key = cacheKeys.receivablesByUserForApi(user_id)
    const cached_receivables = cache.get<{ receivables: DTOReceivable[], group_totals: DTOReceivableGroupTotal[] }>(cache_key)
    if (cached_receivables !== undefined) {
        return cached_receivables
    }

    const repository = AppDataSource.getRepository(Receivable)
    const start = performance.now()
    const result = await repository
        .createQueryBuilder('receivable')
        .leftJoinAndSelect('receivable.receivable_group', 'receivable_group')
        .leftJoinAndSelect('receivable.disbursement_account', 'disbursement_account')
        .leftJoinAndSelect('receivable.category', 'category')
        .where('receivable.user_id = :user_id', { user_id })
        .orderBy('receivable_group.name', 'ASC')
        .addOrderBy('receivable.name', 'ASC')
        .getMany()

    const receivables: DTOReceivable[] = result.map(receivable => ({
        id: receivable.id,
        name: receivable.name,
        total_amount: receivable.total_amount,
        principal_paid: receivable.principal_received,
        interest_paid: receivable.interest_received,
        balance: receivable.balance,
        start_date: receivable.start_date,
        end_date: receivable.end_date,
        is_active: receivable.is_active,
        created_at: receivable.created_at,
        note: receivable.note,
        disbursement_account: receivable.disbursement_account ? { id: receivable.disbursement_account.id, name: receivable.disbursement_account.name } : null,
        category: receivable.category ? { id: receivable.category.id, name: receivable.category.name } : null,
        receivable_group: receivable.receivable_group ? { id: receivable.receivable_group.id, name: receivable.receivable_group.name } : null
    }))

    const group_totals_map: Record<number, DTOReceivableGroupTotal> = {}

    for (const receivable of result) {
        if (!receivable.receivable_group) continue
        const group_id = receivable.receivable_group.id

        if (!group_totals_map[group_id]) {
            group_totals_map[group_id] = {
                receivable_group_id: group_id,
                receivable_group_name: receivable.receivable_group.name,
                total_balance: 0
            }
        }

        group_totals_map[group_id].total_balance += Number(receivable.balance)
    }

    const group_totals = Object.values(group_totals_map)
    const response = { receivables, group_totals }
    
    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`method=[${getReceivablesForApi.name}], cacheKey=[${cache_key}], user=[${user_id}], entity=[receivable], count=[${receivables.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    cache.set(cache_key, response)
    return response
}