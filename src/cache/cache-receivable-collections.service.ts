import { AppDataSource } from "../config/typeorm.datasource"
import { Category } from "../entities/Category.entity"
import { ReceivableCollection } from "../entities/ReceivableCollection.entity"
import { AuthRequest } from "../types/auth-request"
import { logger } from "../utils/logger.util"
import { cacheKeys } from "./cache-key.service"
import { cache } from "./cache.service"

export type DTOReceivableCollection = {
    id: number
    collection_number: number
    principal_received: number
    interest_received: number
    collection_date: Date
    note: string | null
    created_at: Date
    account: { id: number, name: string } | null
    category: { id: number, name: string } | null
    receivable: { id: number, name: string } | null
}

const getCollectionsBase = async (user_id: number): Promise<ReceivableCollection[]> => {
    const cache_key = cacheKeys.receivableCollectionsByUser(user_id)
    const cached_collections = cache.get<ReceivableCollection[]>(cache_key)
    if (cached_collections !== undefined) return cached_collections

    const repo = AppDataSource.getRepository(ReceivableCollection)
    const payments: ReceivableCollection[] = await repo.find({
        where: { receivable: { user: { id: user_id } } },
        relations: { receivable: true, category: true, account: true, transaction: true },
    })

    cache.set(cache_key, payments)
    return payments
}

export const getCollections = async (auth_req: AuthRequest): Promise<ReceivableCollection[]> => {
    const user_id = auth_req.user.id
    const payments: ReceivableCollection[] = await getCollectionsBase(user_id)
    return payments
}

export const getActiveCategoriesForReceivableCollectionsByUser = async (auth_req: AuthRequest): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const cache_key = cacheKeys.receivableCollectionsCategoriesByUser(user_id)
    const cached_categories = cache.get<Category[]>(cache_key)
    if (cached_categories !== undefined) {
        return cached_categories
    }

    const repo = AppDataSource.getRepository(Category)
    const categories = await repo.find({
        where: {
            user: { id: user_id },
            is_active: true,
            type_for_payable_or_receivable: 'receivable_collection'
        },
        order: { name: 'ASC' }
    })

    cache.set(cache_key, categories)
    return categories
}

export const getCollectionById = async (auth_req: AuthRequest, collection_id: number): Promise<ReceivableCollection | null> => {
    const user_id = auth_req.user.id
    const collections = await getCollectionsBase(user_id)
    const collection = collections.find(collection => collection.id === collection_id)
    return collection || null
}

export const getCollectionsForApi = async (auth_req: AuthRequest, collection_id: number): Promise<DTOReceivableCollection[]> => {
    const user_id = auth_req.user.id
    const cache_key = cacheKeys.receivableCollectionsByCollectionForApi(user_id, collection_id)

    const cached = cache.get<DTOReceivableCollection[]>(cache_key)
    if (cached !== undefined) return cached

    const repo = AppDataSource.getRepository(ReceivableCollection)
    const start = performance.now()

    const result = await repo.find({
        where: { id: collection_id },
        relations: { receivable: true, account: true, category: true },
        order: { collection_date: 'DESC' }
    })

    const collections: DTOReceivableCollection[] = result.map(p => ({
        id: p.id,
        collection_number: p.collection_number,
        principal_received: p.principal_collected,
        interest_received: p.interest_collected,
        collection_date: p.collection_date,
        note: p.note,
        created_at: p.created_at,
        account: p.account ? { id: p.account.id, name: p.account.name } : null,
        category: p.category ? { id: p.category.id, name: p.category.name } : null,
        receivable: p.receivable ? { id: p.receivable.id, name: p.receivable.name } : null
    }))

    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`method=[${getCollectionsForApi.name}], cacheKey=[${cache_key}], receivable=[${collection_id}], user=[${user_id}], entity=[receivable_payment], count=[${collections.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    cache.set(cache_key, collections)
    return collections
}