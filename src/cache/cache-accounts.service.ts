import { performance } from 'perf_hooks';
import { AppDataSource } from "../config/typeorm.datasource";
import { Account } from "../entities/Account.entity";
import { AuthRequest } from "../types/auth-request";
import { cacheKeys } from "./cache-key.service";
import { cache } from "./cache.service";
import { logger } from '../utils/logger.util';

export type DTOAccount = {
    id: number
    name: string
    type: string
    balance: number
    is_active: boolean
    transaction_count: number
}

const getAccountsBase = async (user_id: number): Promise<Account[]> => {
    const cache_key = cacheKeys.accountsByUser(user_id)
    const cached_accounts = cache.get<Account[]>(cache_key)
    if (cached_accounts !== undefined) {
        return cached_accounts
    }
    const repo = AppDataSource.getRepository(Account)
    const accounts: Account[] = await repo.find({
        where: { user: { id: user_id } },
        order: { name: 'ASC' }
    })
    cache.set(cache_key, accounts)
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

export const getAccountsForDisbursement = async (auth_req: AuthRequest): Promise<Account[]> => {
    const user_id = auth_req.user.id
    const accounts: Account[] = await getAccountsBase(user_id)
    const active_accounts_for_disbursement: Account[] = accounts.filter(account => ['cash', 'bank', 'card'].includes(account.type))
    return active_accounts_for_disbursement
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

export const getActiveAccountsIncludeCurrentAccount = async (auth_req: AuthRequest, account_id?: number): Promise<Account[]> => {
    const user_id = auth_req.user.id
    const accounts: Account[] = await getAccountsBase(user_id)
    let active_accounts: Account[]
    if (account_id) {
        active_accounts = accounts.filter(account => (account.is_active && account.balance >= 0 && ['cash', 'bank', 'card'].includes(account.type)) || account.id === account_id)
    } else {
        active_accounts = accounts.filter(account => (account.is_active && account.balance >= 0 && ['cash', 'bank', 'card'].includes(account.type)))
    }
    return active_accounts
}

export const getActiveAccountsForTransfer = async (auth_req: AuthRequest): Promise<Account[]> => {
    const user_id = auth_req.user.id
    const accounts: Account[] = await getAccountsBase(user_id)
    const active_accounts_for_transfer: Account[] = accounts.filter(account => account.is_active && ['cash', 'bank', 'card', 'saving'].includes(account.type))
    return active_accounts_for_transfer
}

export const getActiveAccountsForTransferIncludeCurrentAccount = async (auth_req: AuthRequest, account_id?: number): Promise<Account[]> => {
    const user_id = auth_req.user.id
    const accounts: Account[] = await getAccountsBase(user_id)
    let active_accounts_for_transfer: Account[]
    if (account_id) {
        active_accounts_for_transfer = accounts.filter(account => (account.is_active && ['cash', 'bank', 'card', 'saving'].includes(account.type)) || account.id === account_id)
    } else {
        active_accounts_for_transfer = accounts.filter(account => account.is_active && ['cash', 'bank', 'card', 'saving'].includes(account.type))
    }
    return active_accounts_for_transfer
}

export const getActiveAccountsForDisbursement = async (auth_req: AuthRequest): Promise<Account[]> => {
    const user_id = auth_req.user.id
    const accounts: Account[] = await getAccountsBase(user_id)
    const active_accounts_for_disbursement: Account[] = accounts.filter(account => account.is_active && ['cash', 'bank', 'card'].includes(account.type))
    return active_accounts_for_disbursement
}

export const getAccountsForApi = async (auth_req: AuthRequest): Promise<DTOAccount[]> => {
    const user_id = auth_req.user.id
    const cache_key = cacheKeys.accountsByUserForApi(user_id)
    const cached_accounts = cache.get<DTOAccount[]>(cache_key)
    if (cached_accounts !== undefined) {
        return cached_accounts
    }
    const repository = AppDataSource.getRepository(Account)
    const start = performance.now()
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

    const accounts: DTOAccount[] = result.entities.map((account, index) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        balance: account.balance,
        is_active: account.is_active,
        transaction_count: Number(result.raw[index].transaction_count)
    }))

    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`method=[${getAccountsForApi.name}], cacheKey=[${cache_key}], user=[${user_id}], entity=[account], count=[${accounts.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    cache.set(cache_key, accounts)
    return accounts
}