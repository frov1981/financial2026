import { AppDataSource } from "../config/typeorm.datasource"
import { LoanGroup } from "../entities/LoanGroup.entity"
import { AuthRequest } from "../types/auth-request"
import { cacheKeys } from "./cache-key.service"
import { cache } from "./cache.service"

const getLoanGroupBase = async (user_id: number): Promise<LoanGroup[]> => {
    const cache_key = cacheKeys.loanGroupByUser(user_id)
    const cached_loan_group = cache.get<LoanGroup[]>(cache_key)
    if (cached_loan_group !== undefined) {
        return cached_loan_group
    }
    const repo = AppDataSource.getRepository(LoanGroup)
    const loan_group: LoanGroup[] = await repo.find({
        where: { user: { id: user_id } },
        order: { name: 'ASC' }
    })
    cache.set(cache_key, loan_group)
    return loan_group
}

export const getLoanGroup = async (auth_req: AuthRequest): Promise<LoanGroup[]> => {
    const user_id = auth_req.user.id
    const loan_group: LoanGroup[] = await getLoanGroupBase(user_id)
    return loan_group
}

export const getLoanGroupById = async (auth_req: AuthRequest, loan_group_id: number): Promise<LoanGroup | null> => {
    const user_id = auth_req.user.id
    const loan_groups = await getLoanGroupBase(user_id)
    const loan_group = loan_groups.find(loan_group => loan_group.id === loan_group_id)
    return loan_group || null
}

export const getLoanGroupByName = async (auth_req: AuthRequest, name: string): Promise<LoanGroup | null> => {
    const user_id = auth_req.user.id
    const loan_groups = await getLoanGroupBase(user_id)
    const loan_group = loan_groups.find(loan_group => loan_group.name.toLowerCase() === name.toLowerCase())
    return loan_group || null
}

export const getActiveLoanGroupById = async (auth_req: AuthRequest, loan_group_id: number): Promise<LoanGroup | null> => {
    const user_id = auth_req.user.id
    const loan_groups = await getLoanGroupBase(user_id)
    const loan_group = loan_groups.find(loan_group => loan_group.id === loan_group_id && loan_group.is_active)
    return loan_group || null
}

export const getActiveLoanGroup = async (auth_req: AuthRequest): Promise<LoanGroup[]> => {
    const user_id = auth_req.user.id
    const loan_groups = await getLoanGroupBase(user_id)
    const loan_group = loan_groups.filter(loan_group => loan_group.is_active)
    return loan_group
}