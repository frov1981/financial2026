import { performance } from 'perf_hooks';
import { AppDataSource } from "../config/typeorm.datasource";
import { CacheKpiBalance } from "../entities/CacheKpiBalance.entity";
import { AuthRequest } from "../types/auth-request";
import { logger } from '../utils/logger.util';
import { cacheKeys } from "./cache-key.service";
import { cache } from "./cache.service";

type CashFlowSummary = {
  labels: string[]
  total_inflows: number[]
  total_outflows: number[]
  net_cash_flow: number[]
}

type LoanFlowSummary = {
  labels: string[]
  total_loans: number[]
  total_payments: number[]
  net_balance: number[]
}

const base_kpi = {
  incomes: 0,
  expenses: 0,
  loans: 0,
  payments: 0,
  savings: 0,
  withdrawals: 0,
  total_inflows: 0,
  total_outflows: 0,
  net_cash_flow: 0,
  net_savings: 0,
  available_balance: 0,
  principal_breakdown: 0,
  interest_breakdown: 0,
  is_populate: 0
}

type KpiBalance = typeof base_kpi

type TrendValue = {
  diff: number
  percent: number
  direction: 'up' | 'down' | 'equal'
} | null

type KpiTrend = {
  [K in keyof KpiBalance]: TrendValue
}

const buildAuthReq = (auth_req: AuthRequest, year: number, month: number): AuthRequest => {
  return {
    ...auth_req,
    query: {
      ...auth_req.query,
      year_period_for_kpi: year,
      month_period_for_kpi: month
    }
  } as unknown as AuthRequest
}

export const getHomeKpisCacheAccumulated = async (auth_req: AuthRequest): Promise<KpiBalance> => {
  const user_id = auth_req.user.id
  const year = Number(auth_req.query.year_period_for_kpi || 0)
  const month = Number(auth_req.query.month_period_for_kpi || 0)
  const cache_key = cacheKeys.homeBalanceKpiAccum(user_id, year, month)
  const cached = cache.get<KpiBalance>(cache_key)
  if (cached !== undefined) return cached
  const years = await getHomeAvailableYearsKpiCache(auth_req)
  const real_years = years.filter(y => y !== 0)
  if (!real_years.length) {
    cache.set(cache_key, base_kpi)
    return base_kpi
  }
  const base_year = Math.min(...real_years)
  const current = await getHomeBalanceKpiCache(auth_req)
  if (year <= base_year) {
    cache.set(cache_key, current)
    return current
  }
  const prev_req = buildAuthReq(auth_req, year - 1, 0)
  const prev: KpiBalance = await getHomeKpisCacheAccumulated(prev_req)
  const result: KpiBalance = {
    incomes: prev.incomes + current.incomes,
    expenses: prev.expenses + current.expenses,
    savings: prev.savings + current.savings,
    withdrawals: prev.withdrawals + current.withdrawals,
    loans: prev.loans + current.loans,
    payments: prev.payments + current.payments,
    total_inflows: prev.total_inflows + current.total_inflows,
    total_outflows: prev.total_outflows + current.total_outflows,
    net_cash_flow: prev.net_cash_flow + current.net_cash_flow,
    net_savings: prev.net_savings + current.net_savings,
    available_balance: prev.available_balance + current.available_balance,
    principal_breakdown: prev.principal_breakdown + current.principal_breakdown,
    interest_breakdown: prev.interest_breakdown + current.interest_breakdown,
    is_populate: 1
  }
  cache.set(cache_key, result)
  return result
}
const calcTrend = (current: number, previous: number): TrendValue => {
  if (previous === 0) return null
  const diff = Number((current - previous).toFixed(2))
  const percent = Number(((diff / previous) * 100).toFixed(2))
  return {
    diff,
    percent,
    direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'equal'
  }
}

const calcTrendObject = (current: KpiBalance, previous: KpiBalance): KpiTrend => {
  const result = {} as KpiTrend
  for (const key in current) {
    if (key === 'is_populate') continue
    const curr = current[key as keyof KpiBalance]
    const prev = previous[key as keyof KpiBalance]
    result[key as keyof KpiBalance] = calcTrend(curr, prev)
  }
  return result
}

/********************************************************************************************
 * ******************************************************************************************
 *******************************************************************************************/
export const getHomeAvailableYearsKpiCache = async (auth_req: AuthRequest): Promise<number[]> => {
  const user_id = auth_req.user.id
  const cache_key = cacheKeys.homeAvailableYearsKpi(user_id)
  const cached_available_kpi_years = cache.get<number[]>(cache_key)
  if (cached_available_kpi_years !== undefined) return cached_available_kpi_years
  const repo = AppDataSource.getRepository(CacheKpiBalance)
  const start = performance.now()
  const rows = await repo.createQueryBuilder('k')
    .select('DISTINCT k.period_year', 'year')
    .where('k.user_id = :user_id', { user_id })
    .orderBy('k.period_year', 'DESC')
    .getRawMany()
  const end = performance.now()
  const duration_sec = (end - start) / 1000
  logger.debug(`method=[${getHomeAvailableYearsKpiCache.name}], cacheKey=[${cache_key}], user=[${user_id}], entity=[cache-kpi-balance], count=[${rows.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)
  const years = rows.map(r => Number(r.year))
  const f_year = [0, ...years]
  logger.info(`${getHomeAvailableYearsKpiCache.name}. Años disponibles: `, { f_year })
  cache.set(cache_key, f_year)
  return f_year
}

export const getHomeBalanceKpiCache = async (auth_req: AuthRequest): Promise<KpiBalance> => {
  const user_id = auth_req.user.id
  const year_period_for_kpi = Number(auth_req.query.year_period_for_kpi || 0)
  const month_period_for_kpi = Number(auth_req.query.month_period_for_kpi || 0)
  const cache_key = cacheKeys.homeBalanceKpi(user_id, year_period_for_kpi, month_period_for_kpi)
  const cached = cache.get<KpiBalance>(cache_key)
  if (cached !== undefined) return cached
  const repo = AppDataSource.getRepository(CacheKpiBalance)
  const start = performance.now()
  const qb = repo.createQueryBuilder('k').where('k.user_id = :user_id', { user_id })
  if (year_period_for_kpi > 0) qb.andWhere('k.period_year = :year', { year: year_period_for_kpi })
  if (year_period_for_kpi > 0 && month_period_for_kpi > 0) qb.andWhere('k.period_month = :month', { month: month_period_for_kpi })
  const rows = await qb.getMany()
  const end = performance.now()
  const duration_sec = (end - start) / 1000
  logger.debug(`method=[${getHomeBalanceKpiCache.name}], cacheKey=[${cache_key}], user=[${user_id}], entity=[cache-kpi-balance], count=[${rows.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)
  if (!rows.length) return base_kpi
  const result: KpiBalance = rows.reduce((acc, row) => {
    acc.incomes += Number(row.incomes)
    acc.expenses += Number(row.expenses)
    acc.savings += Number(row.savings)
    acc.withdrawals += Number(row.withdrawals)
    acc.loans += Number(row.loans)
    acc.payments += Number(row.payments)
    acc.total_inflows += Number(row.total_inflows)
    acc.total_outflows += Number(row.total_outflows)
    acc.net_cash_flow += Number(row.net_cash_flow)
    acc.net_savings += Number(row.net_savings)
    acc.available_balance += Number(row.available_balance)
    acc.principal_breakdown += Number(row.principal_breakdown)
    acc.interest_breakdown += Number(row.interest_breakdown)
    acc.is_populate = 1
    return acc
  }, { ...base_kpi })
  logger.info(`${getHomeBalanceKpiCache.name}. `, { year_period_for_kpi })
  cache.set(cache_key, result)
  return result
}

export const getHomeTrendKpiCache = async (auth_req: AuthRequest) => {
  const user_id = auth_req.user.id
  const year = Number(auth_req.query.year_period_for_kpi || 0)
  const month = Number(auth_req.query.month_period_for_kpi || 0)
  if (year === 0) {
    return { current: base_kpi, previous: null, trend: null }
  }
  const cache_key = cacheKeys.homeTrendKpi(user_id, year, month)
  const cached = cache.get(cache_key)
  if (cached !== undefined) return cached
  const years = await getHomeAvailableYearsKpiCache(auth_req)
  const real_years = years.filter(y => y !== 0)
  if (!real_years.length) {
    const result = { current: base_kpi, previous: null, trend: null }
    cache.set(cache_key, result)
    return result
  }
  const base_year = Math.min(...real_years)
  const current = await getHomeBalanceKpiCache(auth_req)
  if (year <= base_year) {
    const result = { current, previous: null, trend: null }
    cache.set(cache_key, result)
    return result
  }
  const prev_req = buildAuthReq(auth_req, year - 1, 0)
  const previous: KpiBalance = await getHomeBalanceKpiCache(prev_req)
  const trend = calcTrendObject(current, previous)
  const result = { current, previous, trend }
  cache.set(cache_key, result)
  return result
}

export const getHomeCashFlowSummaryCache = async (auth_req: AuthRequest): Promise<CashFlowSummary> => {
  const user_id = auth_req.user.id
  const year = Number(auth_req.query.year_period_for_cash_summ || 0)

  const cache_key = cacheKeys.homeCashFlowSummary(user_id, year)
  const cached = cache.get<CashFlowSummary>(cache_key)
  if (cached !== undefined) return cached

  const labels: string[] = []
  const total_inflows: number[] = []
  const total_outflows: number[] = []
  const net_cash_flow: number[] = []

  let available_years = cache.get<number[]>(cacheKeys.homeAvailableYearsKpi(user_id)) || []
  available_years.sort((a, b) => a - b)

  if (year === 0) {
    for (const y of available_years) {
      if (y === 0) continue
      let inflows = 0
      let outflows = 0
      let net = 0

      for (let month = 1; month <= 12; month++) {
        const kpi_key = cacheKeys.homeBalanceKpi(user_id, y, month)
        let kpi = cache.get<KpiBalance>(kpi_key)

        if (!kpi) {
          const req = buildAuthReq(auth_req, y, month)
          kpi = await getHomeBalanceKpiCache(req)
          cache.set(kpi_key, kpi)
        }

        inflows += kpi?.total_inflows ?? 0
        outflows += kpi?.total_outflows ?? 0
        net += kpi?.net_cash_flow ?? 0
      }

      labels.push(String(y))
      total_inflows.push(inflows)
      total_outflows.push(outflows)
      net_cash_flow.push(net)
    }
  } else {
    const month_labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

    for (let month = 1; month <= 12; month++) {
      const kpi_key = cacheKeys.homeBalanceKpi(user_id, year, month)
      const kpi = cache.get<KpiBalance>(kpi_key)

      labels.push(month_labels[month - 1])
      total_inflows.push(kpi?.total_inflows ?? 0)
      total_outflows.push(kpi?.total_outflows ?? 0)
      net_cash_flow.push(kpi?.net_cash_flow ?? 0)
    }
  }

  const result: CashFlowSummary = {
    labels,
    total_inflows,
    total_outflows,
    net_cash_flow
  }

  cache.set(cache_key, result)
  return result
}

export const getHomeLoanFlowSummaryCache = async (auth_req: AuthRequest): Promise<LoanFlowSummary> => {
  const user_id = auth_req.user.id
  const year = Number(auth_req.query.year_period_for_loan_summ || 0)

  const cache_key = cacheKeys.homeLoanFlowSummary(user_id, year)
  const cached = cache.get<LoanFlowSummary>(cache_key)
  if (cached !== undefined) return cached

  const labels: string[] = []
  const total_loans: number[] = []
  const total_payments: number[] = []
  const net_balance: number[] = []

  let available_years = cache.get<number[]>(cacheKeys.homeAvailableYearsKpi(user_id)) || []
  available_years.sort((a, b) => a - b)

  if (year === 0) {
    for (const y of available_years) {
      if (y === 0) continue

      let loans = 0
      let payments = 0
      let net = 0

      for (let month = 1; month <= 12; month++) {
        const kpi_key = cacheKeys.homeBalanceKpi(user_id, y, month)
        let kpi = cache.get<KpiBalance>(kpi_key)

        if (!kpi) {
          const req = buildAuthReq(auth_req, y, month)
          kpi = await getHomeBalanceKpiCache(req)
          cache.set(kpi_key, kpi)
        }

        loans += kpi?.loans ?? 0
        payments += kpi?.payments ?? 0
        net += (kpi?.loans ?? 0) - (kpi?.payments ?? 0)
      }

      labels.push(String(y))
      total_loans.push(loans)
      total_payments.push(payments)
      net_balance.push(net)
    }
  } else {
    const month_labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

    for (let month = 1; month <= 12; month++) {
      const kpi_key = cacheKeys.homeBalanceKpi(user_id, year, month)
      const kpi = cache.get<KpiBalance>(kpi_key)

      labels.push(month_labels[month - 1])
      total_loans.push(kpi?.loans ?? 0)
      total_payments.push(kpi?.payments ?? 0)
      net_balance.push((kpi?.loans ?? 0) - (kpi?.payments ?? 0))
    }
  }

  const result: LoanFlowSummary = {
    labels,
    total_loans,
    total_payments,
    net_balance
  }

  cache.set(cache_key, result)
  return result
}
