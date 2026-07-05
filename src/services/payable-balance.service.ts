import { AppDataSource } from '../config/typeorm.datasource'
import { Payable } from '../entities/Payable.entity'

export class PayableBalanceService {

  static async getPendingPayableBalance(user_id: number): Promise<number> {
    const result = await AppDataSource
      .getRepository(Payable)
      .createQueryBuilder('payable')
      .select('COALESCE(SUM(payable.balance), 0)', 'total')
      .where('payable.user_id = :user_id', { user_id })
      .andWhere('payable.is_active = :is_active', { is_active: true })
      .getRawOne()

    return Number(result?.total ?? 0)
  }

}
