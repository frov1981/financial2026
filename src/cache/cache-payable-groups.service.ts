import { AppDataSource } from "../config/typeorm.datasource";
import { PayableGroup } from "../entities/PayableGroup.entity";
import { AuthRequest } from "../types/auth-request";
import { cacheKeys } from "./cache-key.service";
import { cache } from "./cache.service";

const getPayableGroupBase = async (user_id: number): Promise<PayableGroup[]> => {
    const cache_key = cacheKeys.payableGroupByUser(user_id)
    const cached_payable_group = cache.get<PayableGroup[]>(cache_key)
    if (cached_payable_group !== undefined) {
        return cached_payable_group
    }
    const repo = AppDataSource.getRepository(PayableGroup)
    const payable_group: PayableGroup[] = await repo.find({
        where: { user: { id: user_id } },
        order: { name: 'ASC' }
    })
    cache.set(cache_key, payable_group)
    return payable_group
}

export const getPayableGroup = async (auth_req: AuthRequest): Promise<PayableGroup[]> => {
    const user_id = auth_req.user.id
    const payable_group: PayableGroup[] = await getPayableGroupBase(user_id)
    return payable_group
}

export const getPayableGroupById = async (auth_req: AuthRequest, payable_group_id: number): Promise<PayableGroup | null> => {
    const user_id = auth_req.user.id
    const payable_groups = await getPayableGroupBase(user_id)
    const payable_group = payable_groups.find(payable_group => payable_group.id === payable_group_id)
    return payable_group || null
}

export const getPayableGroupByName = async (auth_req: AuthRequest, name: string): Promise<PayableGroup | null> => {
    const user_id = auth_req.user.id
    const payable_groups = await getPayableGroupBase(user_id)
    const payable_group = payable_groups.find(payable_group => payable_group.name.toLowerCase() === name.toLowerCase())
    return payable_group || null
}

export const getActivePayableGroupById = async (auth_req: AuthRequest, payable_group_id: number): Promise<PayableGroup | null> => {
    const user_id = auth_req.user.id
    const payable_groups = await getPayableGroupBase(user_id)
    const payable_group = payable_groups.find(payable_group => payable_group.id === payable_group_id && payable_group.is_active)
    return payable_group || null
}

export const getActivePayableGroup = async (auth_req: AuthRequest): Promise<PayableGroup[]> => {
    const user_id = auth_req.user.id
    const payable_groups = await getPayableGroupBase(user_id)
    const payable_group = payable_groups.filter(payable_group => payable_group.is_active)
    return payable_group
}