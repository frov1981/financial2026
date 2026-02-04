import { AppDataSource } from '../../config/typeorm.datasource'
import { Account } from '../../entities/Account.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/auth-request'

/*
  Recalcula los balances de todas las cuentas del usuario
*/
export const recalculateAllAccountBalances = async (authReq: AuthRequest): Promise<void> => {
    const userId = authReq.user.id
    const queryRunner = AppDataSource.createQueryRunner()

    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
        const accounts = await queryRunner.manager.find(Account, {
            where: { user: { id: userId } }
        })

        if (accounts.length === 0) {
            await queryRunner.commitTransaction()
            return
        }

        for (const account of accounts) {
            account.balance = 0
        }

        const transactions = await queryRunner.manager
            .createQueryBuilder(Transaction, 'tx')
            .leftJoinAndSelect('tx.account', 'account')
            .leftJoinAndSelect('tx.to_account', 'to_account')
            .where('tx.user_id = :userId', { userId })
            .getMany()

        const accountMap = new Map<number, Account>()

        for (const account of accounts) {
            accountMap.set(account.id, account)
        }

        for (const tx of transactions) {

            if (tx.type === 'income') {
                const acc = accountMap.get(tx.account.id)
                if (acc) acc.balance += Number(tx.amount)
            }

            if (tx.type === 'expense') {
                const acc = accountMap.get(tx.account.id)
                if (acc) acc.balance -= Number(tx.amount)
            }

            if (tx.type === 'transfer') {
                const fromAcc = accountMap.get(tx.account.id)
                const toAcc = tx.to_account ? accountMap.get(tx.to_account.id) : null

                if (fromAcc) fromAcc.balance -= Number(tx.amount)
                if (toAcc) toAcc.balance += Number(tx.amount)
            }
        }

        for (const account of accounts) {
            await queryRunner.manager.update(
                Account,
                { id: account.id },
                { balance: account.balance }
            )
        }

        await queryRunner.commitTransaction()

    } catch (error) {
        await queryRunner.rollbackTransaction()
        throw error
    } finally {
        await queryRunner.release()
    }
}
