import { AppDataSource } from '../config/typeorm.datasource'
import { Account } from '../entities/Account.entity'
import { logger } from '../utils/logger.util'

export class AccountBalanceService {

    static async getNetAvailableBalance(user_id: number): Promise<number> {
        const result = await AppDataSource
            .getRepository(Account)
            .createQueryBuilder('account')
            .select('COALESCE(SUM(account.balance), 0)', 'total')
            .where('account.user_id = :user_id', { user_id })
            .andWhere('account.is_active = :is_active', { is_active: true })
            .andWhere('account.type IN (:...types)', { types: ['cash', 'bank'] })
            .getRawOne()

        logger.info(`${AccountBalanceService.getNetAvailableBalance.name}. `, `Net available balance for user ${user_id}: ${result.total}`)
        return Number(result?.total ?? 0)
    }

}
