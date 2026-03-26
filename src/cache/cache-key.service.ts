import { AuthRequest } from "../types/auth-request"
import { logger } from "../utils/logger.util"
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

  paymentsByUser: (user_id: number) => `payment_user_${user_id}`,
  paymentsByUserForApi: (user_id: number) => `payment_api_user_${user_id}`,

  paymentsByLoan: (user_id: number, loan_id: number) => `payment_user_${user_id}_loan_${loan_id}`,
  paymentsByLoanForApi: (user_id: number, loan_id: number) => `payment_api_user_${user_id}_loan_${loan_id}`,

  paymentsByLoanPrefix: (user_id: number) => `payment_api_user_${user_id}_loan_`,

  homeAvailableKpiYears: (user_id: number) => `home_available_kpis_years_${user_id}`,
  homeKpiBalance: (user_id: number, year: number, month: number) => `home_kpis_balance_${user_id}_${year}_${month}`,
  homeKpiBalancePrefix: (user_id: number) => `home_kpis_balance_${user_id}_`,

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
    `payment_user_${user_id}`,
    `payment_api_user_${user_id}`,
    `home_available_kpis_years_${user_id}`,
    `home_kpis_balance_${user_id}_*`,
  ]
}

const delByPrefix = (prefix: string) => {
  const keys = cache.keys()
  const keys_to_delete = keys.filter(k => k.startsWith(prefix))
  return cache.del(keys_to_delete)
}

export const deleteAll = (auth_req: AuthRequest, source: TypeSource): void => {
  const user_id = auth_req.user.id
  const deleted = cache.del(cacheKeys.allByUser(user_id))
  const deleted_kpis = delByPrefix(cacheKeys.homeKpiBalancePrefix(user_id))
  const deleted_payments = delByPrefix(cacheKeys.paymentsByLoanPrefix(user_id))
  logger.debug(`Delete Cache All. user=[${user_id}], keysDeleted=[${deleted}], kpisDeleted=[${deleted_kpis}], paymentsDeleted=[${deleted_payments}]`)
}