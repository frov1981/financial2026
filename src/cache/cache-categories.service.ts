import { performance } from 'perf_hooks';
import { AppDataSource } from "../config/typeorm.datasource";
import { Category } from "../entities/Category.entity";
import { AuthRequest } from "../types/auth-request";
import { logger } from '../utils/logger.util';
import { cacheKeys } from "./cache-key.service";
import { cache } from "./cache.service";

export type DTOCategory = {
    id: number
    name: string
    type: 'income' | 'expense'
    type_for_loan: 'loan' | 'payment' | null
    is_active: boolean
    category_group: { id: number, name: string } | null
    transactions_count: number
}

const getCategoriesBase = async (user_id: number): Promise<Category[]> => {
    const cache_key = cacheKeys.categoriesByUser(user_id)
    const cached_categories = cache.get<Category[]>(cache_key)
    if (cached_categories !== undefined) {
        return cached_categories
    }
    const repo = AppDataSource.getRepository(Category)
    const categories: Category[] = await repo.find({
        where: { user: { id: user_id } },
        relations: { category_group: true },
        order: { name: 'ASC' }
    })
    cache.set(cache_key, categories)
    return categories
}

export const getCategories = async (auth_req: AuthRequest): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    return categories
}

export const getCategoryById = async (auth_req: AuthRequest, category_id: number): Promise<Category | null> => {
    const user_id = auth_req.user.id
    const categories = await getCategoriesBase(user_id)
    const category = categories.find(category => category.id === category_id)
    return category || null
}

export const getCategoryByName = async (auth_req: AuthRequest, name: string): Promise<Category | null> => {
    const user_id = auth_req.user.id
    const categories = await getCategoriesBase(user_id)
    const category = categories.find(category => category.name.toLowerCase() === name.toLowerCase())
    return category || null
}

export const getActiveCategoryById = async (auth_req: AuthRequest, category_id: number): Promise<Category | null> => {
    const user_id = auth_req.user.id
    const categories = await getCategoriesBase(user_id)
    const category = categories.find(category => category.id === category_id && category.is_active)
    return category || null
}

export const getActiveCategories = async (auth_req: AuthRequest): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    const active_categories: Category[] = categories.filter(category => category.is_active)
    return active_categories
}

export const getActiveIncomeCategories = async (auth_req: AuthRequest): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    const active_income_categories: Category[] = categories.filter(category => category.is_active && category.type === 'income')
    return active_income_categories
}

export const getActiveExpenseCategories = async (auth_req: AuthRequest): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    const active_expense_categories: Category[] = categories.filter(category => category.is_active && category.type === 'expense')
    return active_expense_categories
}

export const getActiveLoanCategories = async (auth_req: AuthRequest): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    const active_loan_categories: Category[] = categories.filter(category => category.is_active && category.type_for_loan === 'loan')
    return active_loan_categories
}

export const getActivePaymentCategories = async (auth_req: AuthRequest): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    const active_payment_categories: Category[] = categories.filter(category => category.is_active && category.type_for_loan === 'payment')
    return active_payment_categories
}

export const getCategoriesForApi = async (auth_req: AuthRequest): Promise<DTOCategory[]> => {
    const user_id = auth_req.user.id
    const cache_key = cacheKeys.categoriesByUserForApi(user_id)
    const cached_categories = cache.get<DTOCategory[]>(cache_key)
    if (cached_categories !== undefined) {
        return cached_categories
    }
    const repository = AppDataSource.getRepository(Category)
    const start = performance.now()
    const result = await repository
        .createQueryBuilder('category')
        .innerJoin('category.user', 'user')
        .innerJoinAndSelect('category.category_group', 'group')
        .where('user.id = :user_id', { user_id })
        .addSelect(subQuery =>
            subQuery
                .select('COUNT(t.id)')
                .from('transactions', 't')
                .where('t.category_id = category.id'),
            'transactions_count'
        )
        .orderBy('group.name', 'ASC')
        .addOrderBy('category.name', 'ASC')
        .getRawAndEntities()

    const categories: DTOCategory[] = result.entities.map((category, index) => ({
        id: category.id,
        name: category.name,
        type: category.type,
        type_for_loan: category.type_for_loan,
        is_active: category.is_active,
        category_group: category.category_group ? { id: category.category_group.id, name: category.category_group.name } : null,
        transactions_count: Number(result.raw[index].transactions_count)
    }))

    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`method=[${getCategoriesForApi.name}], cacheKey=[${cache_key}], user=[${user_id}], entity=[category], count=[${categories.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    cache.set(cache_key, categories)
    return categories
}