import { performance } from 'perf_hooks';
import { AppDataSource } from "../config/typeorm.datasource";
import { CacheKpiBalance } from "../entities/CacheKpiBalance.entity";
import { AuthRequest } from "../types/auth-request";
import { logger } from '../utils/logger.util';
import { cacheKeys } from "./cache-key.service";
import { cache } from "./cache.service";

const base = {
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
  interest_breakdown: 0
}

type KpiBalance = typeof base

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
      year_period: year,
      month_period: month
    }
  } as unknown as AuthRequest
}

export const getHomeKpisCacheAccumulated = async (auth_req: AuthRequest): Promise<KpiBalance> => {
  const user_id = auth_req.user.id
  const year = Number(auth_req.query.year_period || 0)
  const month = Number(auth_req.query.month_period || 0)
  const cache_key = cacheKeys.homeBalanceKpiAccum(user_id, year, month)
  const cached = cache.get<KpiBalance>(cache_key)
  if (cached !== undefined) return cached
  const years = await getHomeAvailableYearsKpiCache(auth_req)
  const real_years = years.filter(y => y !== 0)
  if (!real_years.length) {
    cache.set(cache_key, base)
    return base
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
    interest_breakdown: prev.interest_breakdown + current.interest_breakdown
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
  cache.set(cache_key, f_year)
  return f_year
}

export const getHomeBalanceKpiCache = async (auth_req: AuthRequest): Promise<KpiBalance> => {
  const user_id = auth_req.user.id
  const year_period = Number(auth_req.query.year_period || 0)
  const month_period = Number(auth_req.query.month_period || 0)
  const cache_key = cacheKeys.homeBalanceKpi(user_id, year_period, month_period)
  const cached = cache.get<KpiBalance>(cache_key)
  if (cached !== undefined) return cached
  const repo = AppDataSource.getRepository(CacheKpiBalance)
  const start = performance.now()
  const qb = repo.createQueryBuilder('k').where('k.user_id = :user_id', { user_id })
  if (year_period > 0) qb.andWhere('k.period_year = :year', { year: year_period })
  if (year_period > 0 && month_period > 0) qb.andWhere('k.period_month = :month', { month: month_period })
  const rows = await qb.getMany()
  const end = performance.now()
  const duration_sec = (end - start) / 1000
  logger.debug(`method=[${getHomeBalanceKpiCache.name}], cacheKey=[${cache_key}], user=[${user_id}], entity=[cache-kpi-balance], count=[${rows.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)
  if (!rows.length) return base
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
    return acc
  }, { ...base })
  cache.set(cache_key, result)
  return result
}

export const getHomeTrendKpiCache = async (auth_req: AuthRequest) => {
  const user_id = auth_req.user.id
  const year = Number(auth_req.query.year_period || 0)
  const month = Number(auth_req.query.month_period || 0)
  const cache_key = cacheKeys.homeTrendKpi(user_id, year, month)
  const cached = cache.get(cache_key)
  if (cached !== undefined) return cached
  const years = await getHomeAvailableYearsKpiCache(auth_req)
  const real_years = years.filter(y => y !== 0)
  if (!real_years.length) {
    const result = { current: base, previous: null, trend: null }
    cache.set(cache_key, result)
    return result
  }
  const base_year = Math.min(...real_years)
  const current = await getHomeKpisCacheAccumulated(auth_req)
  if (year <= base_year) {
    const result = { current, previous: null, trend: null }
    cache.set(cache_key, result)
    return result
  }
  const prev_req = buildAuthReq(auth_req, year - 1, 0)
  const previous: KpiBalance = await getHomeKpisCacheAccumulated(prev_req)
  const trend = calcTrendObject(current, previous)
  const result = { current, previous, trend }
  cache.set(cache_key, result)
  return result
}


