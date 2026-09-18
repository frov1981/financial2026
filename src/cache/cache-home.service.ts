import { performance } from 'perf_hooks';
import { AppDataSource } from "../config/typeorm.datasource";
import { CacheKpiBalance } from "../entities/CacheKpiBalance.entity";
import { CacheKpiCategory } from "../entities/CacheKpiCategory.entity";
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

type PayableFlowSummary = {
  labels: string[]
  total_payables: number[]
  total_payable_payments: number[]
  net_balance: number[]
}

type ReceivableFlowSummary = {
  labels: string[]
  total_receivables: number[]
  total_receivable_collections: number[]
  net_balance: number[]
}

const base_kpi = {
  incomes: 0,
  expenses: 0,
  payables: 0,
  receivables: 0,
  receivable_collections: 0,
  payable_payments: 0,
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
    payables: prev.payables + current.payables,
    receivables: prev.receivables + current.receivables,
    receivable_collections: prev.receivable_collections + current.receivable_collections,
    payable_payments: prev.payable_payments + current.payable_payments,
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
const calcTrend = (key: string, current: number, previous: number): TrendValue => {
  // If previous is zero and current is also zero, there's no trend to show
  if (previous === 0 && current === 0) return null

  // Compute diff. If previous is zero but current != 0, treat diff as (current - 0) so we can show a direction.
  let diff = Number((current - previous).toFixed(2))
  // For some KPIs (like receivables), an increase is unfavorable — invert sign.
  if (key === 'receivables') diff = Number((-diff).toFixed(2))

  // Percent is undefined when previous is zero; set to null in that case so UI can still show direction.
  const percent = previous === 0 ? null : Number(((diff / previous) * 100).toFixed(2))
  return {
    diff,
    percent: percent as any,
    direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'equal'
  }
}

const calcTrendObject = (current: KpiBalance, previous: KpiBalance): KpiTrend => {
  const result = {} as KpiTrend
  for (const key in current) {
    if (key === 'is_populate') continue
    const curr = current[key as keyof KpiBalance]
    const prev = previous[key as keyof KpiBalance]
    result[key as keyof KpiBalance] = calcTrend(key, curr, prev)
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
    acc.receivables += Number(row.receivables || 0)
    acc.receivable_collections += Number(row.receivable_collections || 0)
    acc.savings += Number(row.savings)
    acc.withdrawals += Number(row.withdrawals)
    acc.payables += Number(row.payables)
    acc.payable_payments += Number(row.payable_payments)
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

export const getHomePayableFlowSummaryCache = async (auth_req: AuthRequest): Promise<PayableFlowSummary> => {
  const user_id = auth_req.user.id
  const year = Number(auth_req.query.year_period_for_payable_summ || 0)

  const cache_key = cacheKeys.homePayableFlowSummary(user_id, year)
  const cached = cache.get<PayableFlowSummary>(cache_key)
  if (cached !== undefined) return cached

  const labels: string[] = []
  const total_payables: number[] = []
  const total_payable_payments: number[] = []
  const net_balance: number[] = []

  let available_years = cache.get<number[]>(cacheKeys.homeAvailableYearsKpi(user_id)) || []
  available_years.sort((a, b) => a - b)

  if (year === 0) {
    for (const y of available_years) {
      if (y === 0) continue

      let payables = 0
      let payable_payments = 0
      let net = 0

      for (let month = 1; month <= 12; month++) {
        const kpi_key = cacheKeys.homeBalanceKpi(user_id, y, month)
        let kpi = cache.get<KpiBalance>(kpi_key)

        if (!kpi) {
          const req = buildAuthReq(auth_req, y, month)
          kpi = await getHomeBalanceKpiCache(req)
          cache.set(kpi_key, kpi)
        }

        payables += kpi?.payables ?? 0
        payable_payments += kpi?.payable_payments ?? 0
        net += (kpi?.payables ?? 0) - (kpi?.payable_payments ?? 0)
      }

      labels.push(String(y))
      total_payables.push(payables)
      total_payable_payments.push(payable_payments)
      net_balance.push(net)
    }
  } else {
    const month_labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

    for (let month = 1; month <= 12; month++) {
      const kpi_key = cacheKeys.homeBalanceKpi(user_id, year, month)
      const kpi = cache.get<KpiBalance>(kpi_key)

      labels.push(month_labels[month - 1])
      total_payables.push(kpi?.payables ?? 0)
      total_payable_payments.push(kpi?.payable_payments ?? 0)
      net_balance.push((kpi?.payables ?? 0) - (kpi?.payable_payments ?? 0))
    }
  }

  const result: PayableFlowSummary = {
    labels,
    total_payables,
    total_payable_payments,
    net_balance
  }

  cache.set(cache_key, result)
  return result
}

export const getHomeReceivableFlowSummaryCache = async (auth_req: AuthRequest): Promise<ReceivableFlowSummary> => {
  const user_id = auth_req.user.id
  const year = Number(auth_req.query.year_period_for_payable_summ || 0)

  const cache_key = cacheKeys.homeReceivableFlowSummary(user_id, year)
  const cached = cache.get<ReceivableFlowSummary>(cache_key)
  if (cached !== undefined) return cached

  const labels: string[] = []
  const total_receivables: number[] = []
  const total_receivable_collections: number[] = []
  const net_balance: number[] = []

  let available_years = cache.get<number[]>(cacheKeys.homeAvailableYearsKpi(user_id)) || []
  available_years.sort((a, b) => a - b)

  if (year === 0) {
    for (const y of available_years) {
      if (y === 0) continue

      let receivables = 0
      let receivable_collections = 0
      let net = 0

      for (let month = 1; month <= 12; month++) {
        const kpi_key = cacheKeys.homeBalanceKpi(user_id, y, month)
        let kpi = cache.get<any>(kpi_key)

        if (!kpi) {
          const req = buildAuthReq(auth_req, y, month)
          kpi = await getHomeBalanceKpiCache(req)
          cache.set(kpi_key, kpi)
        }

        receivables += kpi?.receivables ?? 0
        receivable_collections += kpi?.receivable_collections ?? 0
        net += (kpi?.receivables ?? 0) - (kpi?.receivable_collections ?? 0)
      }

      labels.push(String(y))
      total_receivables.push(receivables)
      total_receivable_collections.push(receivable_collections)
      net_balance.push(net)
    }
  } else {
    const month_labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

    for (let month = 1; month <= 12; month++) {
      const kpi_key = cacheKeys.homeBalanceKpi(user_id, year, month)
      const kpi = cache.get<any>(kpi_key)

      labels.push(month_labels[month - 1])
      total_receivables.push(kpi?.receivables ?? 0)
      total_receivable_collections.push(kpi?.receivable_collections ?? 0)
      net_balance.push((kpi?.receivables ?? 0) - (kpi?.receivable_collections ?? 0))
    }
  }

  const result: ReceivableFlowSummary = {
    labels,
    total_receivables,
    total_receivable_collections,
    net_balance
  }

  cache.set(cache_key, result)
  return result
}

export const getHomeCategoryKpiCache = async (auth_req: AuthRequest) => {
  const user_id = auth_req.user.id
  const year = Number(auth_req.query.year_period_for_kpi || 0)
  const cache_key = cacheKeys.homeCategoryKpi(user_id, year)
  const cached = cache.get<any[]>(cache_key)
  if (cached !== undefined) return cached

  const repo = AppDataSource.getRepository(CacheKpiCategory)
  const start = performance.now()

  const qb = repo.createQueryBuilder('k')
    .select('cg.id', 'category_group_id')
    .addSelect('cat.id', 'category_id')
    .addSelect("COALESCE(cg.name, '')", 'cat_group_name')
    .addSelect("COALESCE(cat.name, '')", 'cat_name')
    .addSelect('SUM(k.amount)', 'amount')
    .addSelect('SUM(k.transaction_count)', 'transaction_count')
    .leftJoin('k.category_group', 'cg')
    .leftJoin('k.category', 'cat')
    .where('k.user_id = :user_id', { user_id })

  if (year > 0) qb.andWhere('k.year_period = :year', { year })

  qb.groupBy('cg.id, cg.name, cat.id, cat.name')
  qb.orderBy('cg.name, cat.name')

  const rows = await qb.getRawMany()
  const end = performance.now()
  const duration_sec = (end - start) / 1000
  logger.debug(`method=[${getHomeCategoryKpiCache.name}], cacheKey=[${cache_key}], user=[${user_id}], entity=[cache-kpi-categories], count=[${rows.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)

  const result = rows.map((r: any) => ({
    category_group_id: Number(r.category_group_id),
    category_id: Number(r.category_id),
    cat_group_name: String(r.cat_group_name || ''),
    cat_name: String(r.cat_name || ''),
    amount: Number(r.amount || 0),
    transaction_count: Number(r.transaction_count || 0)
  }))

  cache.set(cache_key, result)
  return result
}

export const getHomeCategoryKpiDetail = async (auth_req: AuthRequest) => {
  const user_id = auth_req.user.id
  const category_id = Number(auth_req.query.category_id || 0)
  const year = Number(auth_req.query.year_period_for_kpi || 0)
  if (!category_id) return []

  const cache_key = cacheKeys.homeCategoryKpiDetail(user_id, year, category_id)
  const cached = cache.get<any[]>(cache_key)
  if (cached !== undefined) return cached

  const repo = AppDataSource.getRepository(CacheKpiCategory)
  const query = repo.createQueryBuilder('k')
    .select('k.year_period', 'year_period')
    .addSelect('k.month_period', 'month_period')
    .addSelect('SUM(k.amount)', 'amount')
    .addSelect('SUM(k.transaction_count)', 'transaction_count')
    .where('k.user_id = :user_id', { user_id })
    .andWhere('k.category_id = :category_id', { category_id })

  if (year > 0) query.andWhere('k.year_period = :year', { year })

  if (year === 0) {
    query.select('k.year_period', 'year_period')
      .addSelect('SUM(k.amount)', 'amount')
      .addSelect('SUM(k.transaction_count)', 'transaction_count')
  }

  const rows = await query
    .groupBy(year === 0 ? 'k.year_period' : 'k.year_period, k.month_period')
    .orderBy('k.year_period', 'ASC')
    .addOrderBy(year === 0 ? 'k.year_period' : 'k.month_period', 'ASC')
    .getRawMany()

  const result = rows.map((row: any) => ({
    year_period: Number(row.year_period),
    month_period: Number(row.month_period),
    amount: Number(row.amount || 0),
    transaction_count: Number(row.transaction_count || 0)
  }))

  if (year === 0) {
    cache.set(cache_key, result)
    return result
  }

  const byMonth = new Map(result.map(row => [row.month_period, row]))
  const resultWithAllMonths = Array.from({ length: 12 }, (_, index) => byMonth.get(index + 1) || ({
    year_period: year,
    month_period: index + 1,
    amount: 0,
    transaction_count: 0
  }))

  cache.set(cache_key, resultWithAllMonths)
  return resultWithAllMonths
}

export const getHomeCategoryGroupKpi = async (auth_req: AuthRequest) => {
  const user_id = auth_req.user.id
  const year = Number(auth_req.query.year_period_for_kpi || 0)
  const cache_key = cacheKeys.homeCategoryGroupKpi(user_id, year)
  const cached = cache.get<any[]>(cache_key)
  if (cached !== undefined) return cached

  const repo = AppDataSource.getRepository(CacheKpiCategory)
  const query = repo.createQueryBuilder('k')
    .select('cg.id', 'category_group_id')
    .addSelect("COALESCE(cg.name, '')", 'cat_group_name')
    .addSelect('SUM(k.amount)', 'amount')
    .addSelect('SUM(k.transaction_count)', 'transaction_count')
    .leftJoin('k.category_group', 'cg')
    .where('k.user_id = :user_id', { user_id })

  if (year > 0) query.andWhere('k.year_period = :year', { year })

  const rows = await query
    .groupBy('cg.id, cg.name')
    .orderBy('cg.name', 'ASC')
    .getRawMany()

  const result = rows.map((row: any) => ({
    category_group_id: Number(row.category_group_id),
    cat_group_name: String(row.cat_group_name || ''),
    amount: Number(row.amount || 0),
    transaction_count: Number(row.transaction_count || 0)
  }))
  cache.set(cache_key, result)
  return result
}

export const getHomeCategoryGroupKpiDetail = async (auth_req: AuthRequest) => {
  const user_id = auth_req.user.id
  const group_id = Number(auth_req.query.category_group_id || 0)
  const year = Number(auth_req.query.year_period_for_kpi || 0)
  if (!group_id) return []

  const cache_key = cacheKeys.homeCategoryGroupKpiDetail(user_id, year, group_id)
  const cached = cache.get<any[]>(cache_key)
  if (cached !== undefined) return cached

  const repo = AppDataSource.getRepository(CacheKpiCategory)
  const query = repo.createQueryBuilder('k')
    .select('k.year_period', 'year_period')
    .addSelect('k.month_period', 'month_period')
    .addSelect('SUM(k.amount)', 'amount')
    .addSelect('SUM(k.transaction_count)', 'transaction_count')
    .where('k.user_id = :user_id', { user_id })
    .andWhere('k.category_group_id = :group_id', { group_id })

  if (year > 0) query.andWhere('k.year_period = :year', { year })
  if (year === 0) query.select('k.year_period', 'year_period')
    .addSelect('SUM(k.amount)', 'amount')
    .addSelect('SUM(k.transaction_count)', 'transaction_count')

  const rows = await query
    .groupBy(year === 0 ? 'k.year_period' : 'k.year_period, k.month_period')
    .orderBy('k.year_period', 'ASC')
    .addOrderBy(year === 0 ? 'k.year_period' : 'k.month_period', 'ASC')
    .getRawMany()

  const result = rows.map((row: any) => ({
    year_period: Number(row.year_period),
    month_period: Number(row.month_period),
    amount: Number(row.amount || 0),
    transaction_count: Number(row.transaction_count || 0)
  }))
  if (year === 0) {
    cache.set(cache_key, result)
    return result
  }

  const byMonth = new Map(result.map(row => [row.month_period, row]))
  const resultWithAllMonths = Array.from({ length: 12 }, (_, index) => byMonth.get(index + 1) || ({
    year_period: year,
    month_period: index + 1,
    amount: 0,
    transaction_count: 0
  }))
  cache.set(cache_key, resultWithAllMonths)
  return resultWithAllMonths
}
