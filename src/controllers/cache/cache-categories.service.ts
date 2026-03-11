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
        order: { name: 'ASC' }
    })
    cache.set(cache_key, categories)
    return categories
}

export const getCategories = async (authReq: AuthRequest): Promise<Category[]> => {
    const user_id = authReq.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    return categories
}

export const getActiveCategoryById = async (category_id: number, authReq: AuthRequest): Promise<Category | null> => {
    const categories = await getCategoriesBase(authReq.user.id)
    const category = categories.find(category => category.id === category_id && category.is_active)
    return category || null
}

export const getActiveCategories = async (authReq: AuthRequest): Promise<Category[]> => {
    const user_id = authReq.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    const active_categories: Category[] = categories.filter(category => category.is_active)
    return active_categories
}

export const getActiveIncomeCategories = async (authReq: AuthRequest): Promise<Category[]> => {
    const user_id = authReq.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    const active_income_categories: Category[] = categories.filter(category => category.is_active && category.type === 'income')
    return active_income_categories
}

export const getActiveExpenseCategories = async (authReq: AuthRequest): Promise<Category[]> => {
    const user_id = authReq.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    const active_expense_categories: Category[] = categories.filter(category => category.is_active && category.type === 'expense')
    return active_expense_categories
}

export const getActiveLoanCategories = async (authReq: AuthRequest): Promise<Category[]> => {
    const user_id = authReq.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    const active_loan_categories: Category[] = categories.filter(category => category.is_active && category.type_for_loan === 'loan')
    return active_loan_categories
}

export const getActivePaymentCategories = async (authReq: AuthRequest): Promise<Category[]> => {
    const user_id = authReq.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    const active_payment_categories: Category[] = categories.filter(category => category.is_active && category.type_for_loan === 'payment')
    return active_payment_categories
}
