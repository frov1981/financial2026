import { AppDataSource } from '../config/typeorm.datasource'
import { Receivable } from '../entities/Receivable.entity'

export class ReceivableBalanceService {

  static async getPendingReceivableBalance(user_id: number): Promise<number> {
    const result = await AppDataSource
      .getRepository(Receivable)
      .createQueryBuilder('receivable')
      .select('COALESCE(SUM(receivable.balance), 0)', 'total')
      .where('receivable.user_id = :user_id', { user_id })
      .andWhere('receivable.is_active = :is_active', { is_active: true })
      .getRawOne()

    return Number(result?.total ?? 0)
  }

}
