import { AppDataSource } from "../../config/typeorm.datasource"
import { Category } from "../../entities/Category.entity"
import { AuthRequest } from "../../types/auth-request"
import { cacheKeys } from "./cache-key.service"
import { cache } from "./cache.service"


const getCategoriesBase = async (user_id: number): Promise<Category[]> => {
    const cache_key = cacheKeys.categoriesByUser(user_id)
    const cached_categories = cache.get<Category[]>(cache_key)

    if (cached_categories) { return cached_categories }

    const repo = AppDataSource.getRepository(Category)
    const categories: Category[] = await repo.find({
        where: { user: { id: user_id } },
        relations: { category_group: true },
        order: { name: 'ASC' }
    })
    cache.set(cache_key, categories)
    return categories
}

export const deleteCategoriesCache = (auth_req: AuthRequest): void => {
    const cache_key = cacheKeys.categoriesByUser(auth_req.user.id)
    cache.del(cache_key)
}

export const getCategories = async (auth_req: AuthRequest): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    return categories
}

export const getActiveCategoryById = async (category_id: number, auth_req: AuthRequest): Promise<Category | null> => {
    const categories = await getCategoriesBase(auth_req.user.id)
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
