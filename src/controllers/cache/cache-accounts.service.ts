import { AppDataSource } from "../../config/typeorm.datasource";
import { Account } from "../../entities/Account.entity";
import { AuthRequest } from "../../types/auth-request";
import { cacheKeys } from "./cache-key.service";
import { cache } from "./cache.service";


const getAccountsBase = async (user_id: number): Promise<Account[]> => {
    const cache_key = cacheKeys.accountsByUser(user_id)
    const cached_accounts = cache.get<Account[]>(cache_key)

    if (cached_accounts) { return cached_accounts }

    const repo = AppDataSource.getRepository(Account)
    const accounts: Account[] = await repo.find({
        where: { user: { id: user_id } },
        order: { name: 'ASC' }
    })
    cache.set(cache_key, accounts)
    return accounts
}

export const getAccounts = async (authReq: AuthRequest): Promise<Account[]> => {
    const user_id = authReq.user.id
    const accounts: Account[] = await getAccountsBase(user_id)
    return accounts
}

export const getActiveAccountById = async (authReq: AuthRequest, account_id: number): Promise<Account | null> => {
    const accounts = await getAccountsBase(authReq.user.id)
    const account = accounts.find(account => account.id === account_id && account.is_active)
    return account || null
}

export const getActiveAccounts = async (authReq: AuthRequest): Promise<Account[]> => {
    const user_id = authReq.user.id
    const accounts: Account[] = await getAccountsBase(user_id)
    const active_accounts: Account[] = accounts.filter(account => account.is_active && account.balance >= 0 && ['cash', 'bank', 'card'].includes(account.type))
    return active_accounts
}

export const getActiveAccountsForTransfer = async (authReq: AuthRequest): Promise<Account[]> => {
    const user_id = authReq.user.id
    const accounts: Account[] = await getAccountsBase(user_id)
    const active_accounts_for_transfer: Account[] = accounts.filter(account => account.is_active && ['cash', 'bank', 'card', 'saving'].includes(account.type))
    return active_accounts_for_transfer
}

