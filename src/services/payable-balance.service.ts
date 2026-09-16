import { AppDataSource } from '../config/typeorm.datasource'
import { Payable } from '../entities/Payable.entity'
import { cache } from '../cache/cache.service'
import { cacheKeys } from '../cache/cache-key.service'

export class PayableBalanceService {

  static async getPendingPayableBalance(user_id: number): Promise<number> {
    const key = cacheKeys.payableBalanceByUser(user_id)
    const cached = cache.get(key)
    if (cached !== undefined) return Number(cached)

    const result = await AppDataSource
      .getRepository(Payable)
      .createQueryBuilder('payable')
      .select('COALESCE(SUM(payable.balance), 0)', 'total')
      .where('payable.user_id = :user_id', { user_id })
      .andWhere('payable.is_active = :is_active', { is_active: true })
      .getRawOne()

    const total = Number(result?.total ?? 0)
    cache.set(key, total)
    return total
  }

}
