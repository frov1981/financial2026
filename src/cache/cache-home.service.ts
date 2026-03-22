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
    logger.debug(`Query. user=[${user_id}], entity=[cache-kpi-balance], count=[${rows.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    const years = rows.map(r => Number(r.year))
    const f_year = [0, ...years]
    cache.set(cache_key, f_year)
    return f_year
}