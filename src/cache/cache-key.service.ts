import { AuthRequest } from "../types/auth-request"
import { logger } from "../utils/logger.util"
import { cache } from "./cache.service"

export type TypeSource = 'account' | 'category' | 'category_group' | 'payable' | 'payable_group' | 'payable_payment' | 'transaction' | 'home'

export const cacheKeys = {
  accountsByUser: (user_id: number) => `accounts_user_${user_id}`,
  accountsByUserForApi: (user_id: number) => `accounts_api_user_${user_id}`,

  categoriesByUser: (user_id: number) => `categories_user_${user_id}`,
  categoriesByUserForApi: (user_id: number) => `categories_api_user_${user_id}`,

  categoryGroupByUser: (user_id: number) => `category_group_user_${user_id}`,
  categoryGroupByUserForApi: (user_id: number) => `category_group_api_user_${user_id}`,

  payablesByUser: (user_id: number) => `payables_user_${user_id}`,
  payablesByUserForApi: (user_id: number) => `payables_api_user_${user_id}`,
  payableCategoriesByUser: (user_id: number) => `payable_categories_user_${user_id}`,
  payablePaymentCategoriesByUser: (user_id: number) => `payable_payment_categories_user_${user_id}`,

  payableGroupByUser: (user_id: number) => `payable_group_user_${user_id}`,
  payableGroupByUserForApi: (user_id: number) => `payable_group_api_user_${user_id}`,

  paymentsByUser: (user_id: number) => `payment_user_${user_id}`,
  paymentsByUserForApi: (user_id: number) => `payment_api_user_${user_id}`,

  paymentsByPayment: (user_id: number, payment_id: number) => `payment_user_${user_id}_payment_${payment_id}`,
  paymentsByPayableForApi: (user_id: number, payable_id: number) => `payment_api_user_${user_id}_payable_${payable_id}`,
  paymentsByPayablePrefix: (user_id: number) => `payment_api_user_${user_id}_payable_`,

  homeAvailableYearsKpi: (user_id: number) => `home_available_years_kpi_user_${user_id}`,

  homeBalanceKpi: (user_id: number, year: number, month: number) => `home_balance_kpi_user_${user_id}_year_${year}_month_${month}`,
  homeBalanceKpiPrefix: (user_id: number) => `home_balance_kpi_user_${user_id}_`,

  homeCashFlowSummary: (user_id: number, year: number) => `home_cash_flow_summary_user_${user_id}_year_${year}`,
  homeCashFlowSummaryPrefix: (user_id: number) => `home_cash_flow_summary_user_${user_id}_year_`,

  homePayableFlowSummary: (user_id: number, year: number) => `home_payable_flow_summary_user_${user_id}_year_${year}`,
  homePayableFlowSummaryPrefix: (user_id: number) => `home_payable_flow_summary_user_${user_id}_year_`,

  homeTrendKpi: (user_id: number, year: number, month: number) => `home_kpis_trend_user_${user_id}_year_${year}_month_${month}`,
  homeTrendKpiPrefix: (user_id: number) => `home_kpis_trend_user_${user_id}_`,

  homeBalanceKpiAccum: (user_id: number, year: number, month: number) => `home_kpis_balance_accum_user_${user_id}_year_${year}_month_${month}`,
  homeBalanceKpiAccumPrefix: (user_id: number) => `home_kpis_balance_accum_user_${user_id}_`,

  allByUser: (user_id: number) => [
    `accounts_user_${user_id}`,
    `accounts_api_user_${user_id}`,
    `categories_user_${user_id}`,
    `categories_api_user_${user_id}`,
    `category_group_user_${user_id}`,
    `category_group_api_user_${user_id}`,
    `payables_user_${user_id}`,
    `payables_api_user_${user_id}`,
    `payable_categories_user_${user_id}`,
    `payable_payment_categories_user_${user_id}`,
    `payable_group_user_${user_id}`,
    `payable_group_api_user_${user_id}`,
    `payment_user_${user_id}`,
    `payment_api_user_${user_id}`,
    `home_available_years_kpi_user_${user_id}`,
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
  const deleted_kpis = delByPrefix(cacheKeys.homeBalanceKpiPrefix(user_id))
  const deleted_payments = delByPrefix(cacheKeys.paymentsByPayablePrefix(user_id))
  const deleted_kpis_accum = delByPrefix(cacheKeys.homeBalanceKpiAccumPrefix(user_id))
  const deleted_trend = delByPrefix(cacheKeys.homeTrendKpiPrefix(user_id))
  const deleted_cash_flow_summary = delByPrefix(cacheKeys.homeCashFlowSummaryPrefix(user_id))
  const deleted_payable_flow_summary = delByPrefix(cacheKeys.homePayableFlowSummaryPrefix(user_id))
  logger.debug(`Delete Cache All. user=[${user_id}], keysDeleted=[${deleted}], kpisDeleted=[${deleted_kpis}], kpisAccumDeleted=[${deleted_kpis_accum}], trendDeleted=[${deleted_trend}], paymentsDeleted=[${deleted_payments}], cashFlowSummary=[${deleted_cash_flow_summary}], payableFlowSummary=[${deleted_payable_flow_summary}]`)
}