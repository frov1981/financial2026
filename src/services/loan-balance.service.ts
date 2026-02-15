import { AppDataSource } from '../config/typeorm.datasource'
import { Loan } from '../entities/Loan.entity'

export class LoanBalanceService {

  static async getPendingLoanBalance(user_id: number): Promise<number> {
    const result = await AppDataSource
      .getRepository(Loan)
      .createQueryBuilder('loan')
      .select('COALESCE(SUM(loan.balance), 0)', 'total')
      .where('loan.user_id = :user_id', { user_id })
      .andWhere('loan.is_active = :is_active', { is_active: true })
      .getRawOne()

    return Number(result?.total ?? 0)
  }

}
