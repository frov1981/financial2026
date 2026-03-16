import { AppDataSource } from "../config/typeorm.datasource"
import { CategoryGroup } from "../entities/CategoryGroups.entity"
import { AuthRequest } from "../types/auth-request"
import { cacheKeys } from "./cache-key.service"
import { cache } from "./cache.service"


const getCategoryGroupBase = async (user_id: number): Promise<CategoryGroup[]> => {
    const cache_key = cacheKeys.categoryGroupByUser(user_id)
    const cached_category_group = cache.get<CategoryGroup[]>(cache_key)
    if (cached_category_group !== undefined) {
        return cached_category_group
    }
    const repo = AppDataSource.getRepository(CategoryGroup)
    const category_group: CategoryGroup[] = await repo.find({
        where: { user: { id: user_id } },
        order: { name: 'ASC' }
    })
    cache.set(cache_key, category_group)
    return category_group
}

export const getCategoryGroup = async (auth_req: AuthRequest): Promise<CategoryGroup[]> => {
    const user_id = auth_req.user.id
    const category_group: CategoryGroup[] = await getCategoryGroupBase(user_id)
    return category_group
}

export const getCategoryGroupById = async (auth_req: AuthRequest, category_group_id: number): Promise<CategoryGroup | null> => {
    const user_id = auth_req.user.id
    const category_groups = await getCategoryGroupBase(user_id)
    const category_group = category_groups.find(category_group => category_group.id === category_group_id)
    return category_group || null
}

export const getCategoryGroupByName = async (auth_req: AuthRequest, name: string): Promise<CategoryGroup | null> => {
    const user_id = auth_req.user.id
    const category_groups = await getCategoryGroupBase(user_id)
    const category_group = category_groups.find(category_group => category_group.name.toLowerCase() === name.toLowerCase())
    return category_group || null
}

export const getActiveCategoryGroupById = async (category_group_id: number, auth_req: AuthRequest): Promise<CategoryGroup | null> => {
    const user_id = auth_req.user.id
    const category_groups = await getCategoryGroupBase(user_id)
    const category_group = category_groups.find(category_group => category_group.id === category_group_id && category_group.is_active)
    return category_group || null
}

export const getActiveCategoryGroup = async (auth_req: AuthRequest): Promise<CategoryGroup[]> => {
    const user_id = auth_req.user.id
    const category_groups = await getCategoryGroupBase(user_id)
    const category_group = category_groups.filter(category_group => category_group.is_active)
    return category_group
}