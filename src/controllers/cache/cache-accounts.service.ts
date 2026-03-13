import { AppDataSource } from "../../config/typeorm.datasource";
import { Account } from "../../entities/Account.entity";
import { AuthRequest } from "../../types/auth-request";
import { logger } from "../../utils/logger.util";
import { cacheKeys } from "./cache-key.service";
import { cache } from "./cache.service";

type AccountWithCount = Account & { transaction_count: number }

const getAccountsBase = async (user_id: number): Promise<Account[]> => {
    const cache_key = cacheKeys.accountsByUser(user_id)
    const cached_accounts = cache.get<Account[]>(cache_key)
    if (cached_accounts) {
        return cached_accounts
    }
    const repo = AppDataSource.getRepository(Account)
    const accounts: Account[] = await repo.find({
        where: { user: { id: user_id } },
        order: { name: 'ASC' }
    })
    cache.set(cache_key, accounts)
    logger.debug('Accounts retrieved from database and cached', { user_id, count: accounts.length })
    return accounts
}

export const getAccounts = async (auth_req: AuthRequest): Promise<Account[]> => {
    const user_id = auth_req.user.id
    const accounts: Account[] = await getAccountsBase(user_id)
    return accounts
}

export const getAccountById = async (auth_req: AuthRequest, account_id: number): Promise<Account | null> => {
    const user_id = auth_req.user.id
    const accounts = await getAccountsBase(user_id)
    const account = accounts.find(account => account.id === account_id)
    return account || null
}

export const getAccountByName = async (auth_req: AuthRequest, name: string): Promise<Account | null> => {
    const user_id = auth_req.user.id
    const accounts = await getAccountsBase(user_id)
    const account = accounts.find(account => account.name === name)
    return account || null
}

export const getActiveAccountById = async (auth_req: AuthRequest, account_id: number): Promise<Account | null> => {
    const user_id = auth_req.user.id
    const accounts = await getAccountsBase(user_id)
    const account = accounts.find(account => account.id === account_id && account.is_active)
    return account || null
}

export const getActiveAccounts = async (auth_req: AuthRequest): Promise<Account[]> => {
    const user_id = auth_req.user.id
    const accounts: Account[] = await getAccountsBase(user_id)
    const active_accounts: Account[] = accounts.filter(account => account.is_active && account.balance >= 0 && ['cash', 'bank', 'card'].includes(account.type))
    return active_accounts
}

export const getActiveAccountsForTransfer = async (auth_req: AuthRequest): Promise<Account[]> => {
    const user_id = auth_req.user.id
    const accounts: Account[] = await getAccountsBase(user_id)
    const active_accounts_for_transfer: Account[] = accounts.filter(account => account.is_active && ['cash', 'bank', 'card', 'saving'].includes(account.type))
    return active_accounts_for_transfer
}

export const deleteAccountsCache = (auth_req: AuthRequest): void => {
    const user_id = auth_req.user.id
    const cache_key = cacheKeys.accountsByUser(user_id)
    cache.del(cache_key)
    logger.debug('Accounts cache deleted', { user_id })
}

export const getAccountsWithCountBase = async (auth_req: AuthRequest): Promise<AccountWithCount[]> => {
    const user_id = auth_req.user.id
    const cache_key = cacheKeys.accountsByUser(user_id)
    const cached_accounts = cache.get<AccountWithCount[]>(cache_key)
    if (cached_accounts) {
        return cached_accounts
    }
    const repository = AppDataSource.getRepository(Account)
    const result = await repository
        .createQueryBuilder('account')
        .where('account.user_id = :user_id', { user_id })
        .addSelect(subQuery =>
            subQuery
                .select('COUNT(t.id)')
                .from('transactions', 't')
                .where('t.account_id = account.id'),
            'transaction_count'
        )
        .orderBy('account.name', 'ASC')
        .getRawAndEntities()
    const accounts: AccountWithCount[] = result.entities.map((account, index) => ({
        ...account,
        transaction_count: Number(result.raw[index].transaction_count)
    }))
    cache.set(cache_key, accounts)
    return accounts
}