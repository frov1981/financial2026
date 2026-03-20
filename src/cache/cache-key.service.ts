import { AuthRequest } from "../types/auth-request"
import { cache } from "./cache.service"

export type TypeSource = 'account' | 'category' | 'category_group' | 'loan' | 'loan_group' | 'payment' | 'transaction' | 'home'

export const cacheKeys = {
  accountsByUser: (user_id: number) => `accounts_user_${user_id}`,
  accountsByUserForApi: (user_id: number) => `accounts_api_user_${user_id}`,
  categoriesByUser: (user_id: number) => `categories_user_${user_id}`,
  categoriesByUserForApi: (user_id: number) => `categories_api_user_${user_id}`,
  categoryGroupByUser: (user_id: number) => `category_group_user_${user_id}`,
  categoryGroupByUserForApi: (user_id: number) => `category_group_api_user_${user_id}`,
  loansByUser: (user_id: number) => `loans_user_${user_id}`,
  loansByUserForApi: (user_id: number) => `loans_api_user_${user_id}`,
  loanGroupByUser: (user_id: number) => `loan_group_user_${user_id}`,
  loanGroupByUserForApi: (user_id: number) => `loan_group_api_user_${user_id}`,
  homeAvailableKpiYears: (user_id: number) => `home_available_kpi_years_${user_id}`,


  allByUser: (user_id: number) => [
    `accounts_user_${user_id}`,
    `accounts_api_user_${user_id}`,
    `categories_user_${user_id}`,
    `categories_api_user_${user_id}`,
    `category_group_user_${user_id}`,
    `category_group_api_user_${user_id}`,
    `loans_user_${user_id}`,
    `loans_api_user_${user_id}`,
    `loan_group_user_${user_id}`,
    `loan_group_api_user_${user_id}`,
    `home_available_kpi_years_${user_id}`,
  ]
}

export const deleteAll = (auth_req: AuthRequest, source: TypeSource): void => {
  const user_id = auth_req.user.id
  cache.del(cacheKeys.allByUser(user_id))
}