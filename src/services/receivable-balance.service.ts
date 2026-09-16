import { AppDataSource } from '../config/typeorm.datasource'
import { Receivable } from '../entities/Receivable.entity'
import { cache } from '../cache/cache.service'
import { cacheKeys } from '../cache/cache-key.service'

export class ReceivableBalanceService {

  static async getPendingReceivableBalance(user_id: number): Promise<number> {
    const key = cacheKeys.receivableBalanceByUser(user_id)
    const cached = cache.get(key)
    if (cached !== undefined) return Number(cached)

    const result = await AppDataSource
      .getRepository(Receivable)
      .createQueryBuilder('receivable')
      .select('COALESCE(SUM(receivable.balance), 0)', 'total')
      .where('receivable.user_id = :user_id', { user_id })
      .andWhere('receivable.is_active = :is_active', { is_active: true })
      .getRawOne()

    const total = Number(result?.total ?? 0)
    cache.set(key, total)
    return total
  }

}
