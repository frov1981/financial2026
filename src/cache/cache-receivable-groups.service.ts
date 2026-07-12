import { AppDataSource } from "../config/typeorm.datasource";
import { ReceivableGroup } from "../entities/ReceivableGroup.entity";
import { AuthRequest } from "../types/auth-request";
import { cacheKeys } from "./cache-key.service";
import { cache } from "./cache.service";

const getReceivableGroupBase = async (user_id: number): Promise<ReceivableGroup[]> => {
    const cache_key = cacheKeys.receivableGroupByUser(user_id)
    const cached_receivable_group = cache.get<ReceivableGroup[]>(cache_key)
    if (cached_receivable_group !== undefined) {
        return cached_receivable_group
    }
    const repo = AppDataSource.getRepository(ReceivableGroup)
    const receivable_group: ReceivableGroup[] = await repo.find({
        where: { user: { id: user_id } },
        order: { name: 'ASC' }
    })
    cache.set(cache_key, receivable_group)
    return receivable_group
}

export const getReceivableGroup = async (auth_req: AuthRequest): Promise<ReceivableGroup[]> => {
    const user_id = auth_req.user.id
    const receivable_group: ReceivableGroup[] = await getReceivableGroupBase(user_id)
    return receivable_group
}

export const getReceivableGroupById = async (auth_req: AuthRequest, receivable_group_id: number): Promise<ReceivableGroup | null> => {
    const user_id = auth_req.user.id
    const receivable_groups = await getReceivableGroupBase(user_id)
    const receivable_group = receivable_groups.find(receivable_group => receivable_group.id === receivable_group_id)
    return receivable_group || null
}

export const getReceivableGroupByName = async (auth_req: AuthRequest, name: string): Promise<ReceivableGroup | null> => {
    const user_id = auth_req.user.id
    const receivable_groups = await getReceivableGroupBase(user_id)
    const receivable_group = receivable_groups.find(receivable_group => receivable_group.name.toLowerCase() === name.toLowerCase())
    return receivable_group || null
}

export const getActiveReceivableGroupById = async (auth_req: AuthRequest, receivable_group_id: number): Promise<ReceivableGroup | null> => {
    const user_id = auth_req.user.id
    const receivable_groups = await getReceivableGroupBase(user_id)
    const receivable_group = receivable_groups.find(receivable_group => receivable_group.id === receivable_group_id && receivable_group.is_active)
    return receivable_group || null
}

export const getActiveReceivableGroup = async (auth_req: AuthRequest): Promise<ReceivableGroup[]> => {
    const user_id = auth_req.user.id
    const receivable_groups = await getReceivableGroupBase(user_id)
    const receivable_group = receivable_groups.filter(receivable_group => receivable_group.is_active)
    return receivable_group
}

export const getActiveParentReceivablesByUser = async (auth_req: AuthRequest): Promise<ReceivableGroup[]> => {
    return getActiveReceivableGroup(auth_req)
}