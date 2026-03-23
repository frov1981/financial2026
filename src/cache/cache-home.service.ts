import { performance } from 'perf_hooks';
import { AppDataSource } from "../config/typeorm.datasource";
import { CacheKpiBalance } from "../entities/CacheKpiBalance.entity";
import { AuthRequest } from "../types/auth-request";
import { logger } from '../utils/logger.util';
import { cacheKeys } from "./cache-key.service";
import { cache } from "./cache.service";

export const getHomeAvailableKpiYears = async (auth_req: AuthRequest): Promise<number[]> => {
    const user_id = auth_req.user.id
    const cache_key = cacheKeys.homeAvailableKpiYears(user_id)
    const cached_available_kpi_years = cache.get<number[]>(cache_key)
    if (cached_available_kpi_years !== undefined) {
        return cached_available_kpi_years
    }
    const repo = AppDataSource.getRepository(CacheKpiBalance)
    const start = performance.now()
    const rows = await repo.createQueryBuilder('k')
        .select('DISTINCT k.period_year', 'year')
        .where('k.user_id = :user_id', { user_id })
        .orderBy('k.period_year', 'DESC')
        .getRawMany()
    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`method=[${getHomeAvailableKpiYears.name}], cacheKey=[${cache_key}], user=[${user_id}], entity=[cache-kpi-balance], count=[${rows.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    const years = rows.map(r => Number(r.year))
    const f_year = [0, ...years]
    cache.set(cache_key, f_year)
    return f_year
}

export const getHomeKpisCacheBalance = async (auth_req: AuthRequest) => {
    const user_id = auth_req.user.id
    const year_period = Number(auth_req.query.year_period || 0)
    const month_period = Number(auth_req.query.month_period || 0)
    const base = {
        incomes: 0, expenses: 0,
        savings: 0, withdrawals: 0,
        loans: 0, payments: 0,
        total_inflows: 0, total_outflows: 0,
        net_cash_flow: 0, net_savings: 0, available_balance: 0,
        principal_breakdown: 0, interest_breakdown: 0
    }
    const cache_key = cacheKeys.homeKpiBalance(user_id, year_period, month_period)
    const cached = cache.get<typeof base>(cache_key)
    if (cached !== undefined) {
        return cached
    }
    const repo = AppDataSource.getRepository(CacheKpiBalance)
    const start = performance.now()
    const qb = repo.createQueryBuilder('k').where('k.user_id = :user_id', { user_id })
    if (year_period > 0) qb.andWhere('k.period_year = :year', { year: year_period })
    if (year_period > 0 && month_period > 0) qb.andWhere('k.period_month = :month', { month: month_period })
    const rows = await qb.getMany()
    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`method=[${getHomeKpisCacheBalance.name}], cacheKey=[${cache_key}], user=[${user_id}], entity=[cache-kpi-balance], count=[${rows.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)

    if (!rows.length) {
        return base
    }

    const result = rows.reduce((acc, row) => {
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