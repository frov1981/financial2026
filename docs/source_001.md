# Codigo Fuente Consolidado 
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\app.ts
```
 
```ts
import express, { NextFunction, Request, Response } from 'express'
import helmet from 'helmet'
import session from 'express-session'
import path from 'path'
import { sessionStore } from './config/session-store'
import { apiLimiter } from './config/rate-limiter'
import { csrfProtection, csrfTokenMiddleware } from './middlewares/csrf.middleware'
import { injectLoanBalance } from './middlewares/inject-loan-balance.middleware'
import { injectNetBalance } from './middlewares/inject-net-balance.middleware'
import { httpLogger } from './middlewares/logger.middleware'
import { sessionAuthMiddleware } from './middlewares/session-auth.middleware'
import accountRoutes from './routes/account.route'
import authRoutes from './routes/auth.route'
import categoryGroupRoutes from './routes/category-group.route'
import categoryRoutes from './routes/category.route'
import homeRoutes from './routes/home.route'
import loanGroupRoutes from './routes/loan-group.route'
import loanRoutes from './routes/loan.route'
import paymentRoutes from './routes/loan-payment.route'
import transactionRoutes from './routes/transaction.route'

export const app = express()
const isProd = process.env.NODE_ENV === 'production'

/* =======================
   Middlewares base
======================= */
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(httpLogger)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      scriptSrcAttr: ["'unsafe-inline'"], // Permite event handlers inline (onclick, etc)
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      childSrc: ["'none'"],
    },
  },
}))

/* =======================
   Sesiones (MySQL Store)
======================= */
app.set('trust proxy', 1)
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'nandoappsecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60,
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax'
  }
}))

/* =======================
   Views y estáticos
======================= */
app.set('view engine', 'ejs')
const viewsPath = isProd ? path.join(process.cwd(), 'dist/views') : path.join(process.cwd(), 'src/views')
const publicPath = isProd ? path.join(process.cwd(), 'dist/public') : path.join(process.cwd(), 'src/public')
app.set('views', viewsPath)
app.use(express.static(publicPath))

/* =======================
   Variables globales EJS
======================= */
app.use((req: Request, res: Response, next: NextFunction) => {
  res.locals.errors = {}
  next()
})

/* =======================
   Protección CSRF
======================= */
app.use(csrfTokenMiddleware)

/* =======================
   Routes
======================= */
app.use('/', authRoutes)
app.use('/', homeRoutes)
const protectedRouter = express.Router()
protectedRouter.use(sessionAuthMiddleware)
protectedRouter.use(injectNetBalance)
protectedRouter.use(apiLimiter)
protectedRouter.use(csrfProtection) // Aplicar CSRF a rutas protegidas
protectedRouter.use('/accounts', accountRoutes)
protectedRouter.use('/categories', categoryRoutes)
protectedRouter.use('/category-groups', categoryGroupRoutes)
protectedRouter.use('/transactions', transactionRoutes)
protectedRouter.use('/loans', injectLoanBalance, loanRoutes)
protectedRouter.use('/loan-groups', loanGroupRoutes)
protectedRouter.use('/payments', injectLoanBalance, paymentRoutes)
app.use(protectedRouter)
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\server.ts
```
 
```ts
import 'reflect-metadata'
import 'dotenv/config'

import { app } from './app'
import { AppDataSource } from './config/typeorm.datasource'
import { logger } from './utils/logger.util'
import { parseError } from './utils/error.util'

const PORT = process.env.NODE_PORT ? parseInt(process.env.NODE_PORT, 10) : 3000

AppDataSource.initialize().then(() => {
  const ormLimit = process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT, 10) : 3
  const sessionLimit = process.env.SESSION_DB_CONNECTION_LIMIT ? parseInt(process.env.SESSION_DB_CONNECTION_LIMIT, 10) : 1
  logger.info('Configured connection limits', { ormLimit, sessionLimit, estimatedTotal: ormLimit + sessionLimit })

  app.listen(PORT, () => {
    logger.info('Server started on port', { port: PORT })
  })
}).catch(error => {
  logger.error('Error initializing backend', parseError(error))
})
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\cache\cache-accounts.service.ts
```
 
```ts
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
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\cache\cache-categories.service.ts
```
 
```ts
import { performance } from 'perf_hooks';
import { AppDataSource } from "../config/typeorm.datasource";
import { Category } from "../entities/Category.entity";
import { AuthRequest } from "../types/auth-request";
import { logger } from '../utils/logger.util';
import { cacheKeys } from "./cache-key.service";
import { cache } from "./cache.service";

export type DTOCategory = {
    id: number
    name: string
    type: 'income' | 'expense'
    type_for_loan: 'loan' | 'payment' | 'receivable' | 'collection' | null
    is_active: boolean
    category_group: { id: number, name: string } | null
    transactions_count: number
}

const getCategoriesBase = async (user_id: number): Promise<Category[]> => {
    const cache_key = cacheKeys.categoriesByUser(user_id)
    const cached_categories = cache.get<Category[]>(cache_key)
    if (cached_categories !== undefined) {
        return cached_categories
    }
    const repo = AppDataSource.getRepository(Category)
    const categories: Category[] = await repo.find({
        where: { user: { id: user_id } },
        relations: { category_group: true },
        order: { name: 'ASC' }
    })
    cache.set(cache_key, categories)
    return categories
}

export const getCategories = async (auth_req: AuthRequest): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    return categories
}

export const getCategoryById = async (auth_req: AuthRequest, category_id: number): Promise<Category | null> => {
    const user_id = auth_req.user.id
    const categories = await getCategoriesBase(user_id)
    const category = categories.find(category => category.id === category_id)
    return category || null
}

export const getCategoryByName = async (auth_req: AuthRequest, name: string): Promise<Category | null> => {
    const user_id = auth_req.user.id
    const categories = await getCategoriesBase(user_id)
    const category = categories.find(category => category.name.toLowerCase() === name.toLowerCase())
    return category || null
}

export const getActiveCategoryById = async (auth_req: AuthRequest, category_id: number): Promise<Category | null> => {
    const user_id = auth_req.user.id
    const categories = await getCategoriesBase(user_id)
    const category = categories.find(category => category.id === category_id && category.is_active)
    return category || null
}

export const getActiveCategories = async (auth_req: AuthRequest): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    const active_categories: Category[] = categories.filter(category => category.is_active)
    return active_categories
}

export const getActiveIncomeCategories = async (auth_req: AuthRequest): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    const active_income_categories: Category[] = categories.filter(category => category.is_active && category.type === 'income')
    return active_income_categories
}

export const getActiveIncomeCategoriesIncludeCurrentCategory = async (auth_req: AuthRequest, category_id?: number): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    let active_income_categories: Category[]
    if (category_id) {
        active_income_categories = categories.filter(category => (category.is_active && category.type === 'income') || category.id === category_id)
    } else {
        active_income_categories = categories.filter(category => (category.is_active && category.type === 'income'))
    }
    return active_income_categories
}

export const getActiveExpenseCategories = async (auth_req: AuthRequest): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    const active_expense_categories: Category[] = categories.filter(category => category.is_active && category.type === 'expense')
    return active_expense_categories
}

export const getActiveExpenseCategoriesIncludeCurrentCategory = async (auth_req: AuthRequest, category_id?: number): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    let active_expense_categories: Category[]
    if (category_id) {
        active_expense_categories = categories.filter(category => (category.is_active && category.type === 'expense') || category.id === category_id)
    } else {
        active_expense_categories = categories.filter(category => (category.is_active && category.type === 'expense'))
    }
    return active_expense_categories
}

export const getActiveLoanCategories = async (auth_req: AuthRequest): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    const active_loan_categories: Category[] = categories.filter(category => category.is_active && category.type_for_loan === 'loan')
    return active_loan_categories
}

export const getActivePaymentCategories = async (auth_req: AuthRequest): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    const active_payment_categories: Category[] = categories.filter(category => category.is_active && category.type_for_loan === 'payment')
    return active_payment_categories
}

export const getCategoriesForApi = async (auth_req: AuthRequest): Promise<DTOCategory[]> => {
    const user_id = auth_req.user.id
    const cache_key = cacheKeys.categoriesByUserForApi(user_id)
    const cached_categories = cache.get<DTOCategory[]>(cache_key)
    if (cached_categories !== undefined) {
        return cached_categories
    }
    const repository = AppDataSource.getRepository(Category)
    const start = performance.now()
    const result = await repository
        .createQueryBuilder('category')
        .innerJoin('category.user', 'user')
        .innerJoinAndSelect('category.category_group', 'group')
        .where('user.id = :user_id', { user_id })
        .addSelect(subQuery =>
            subQuery
                .select('COUNT(t.id)')
                .from('transactions', 't')
                .where('t.category_id = category.id'),
            'transactions_count'
        )
        .orderBy('group.name', 'ASC')
        .addOrderBy('category.name', 'ASC')
        .getRawAndEntities()

    const categories: DTOCategory[] = result.entities.map((category, index) => ({
        id: category.id,
        name: category.name,
        type: category.type,
        type_for_loan: category.type_for_loan,
        is_active: category.is_active,
        category_group: category.category_group ? { id: category.category_group.id, name: category.category_group.name } : null,
        transactions_count: Number(result.raw[index].transactions_count)
    }))

    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`method=[${getCategoriesForApi.name}], cacheKey=[${cache_key}], user=[${user_id}], entity=[category], count=[${categories.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    cache.set(cache_key, categories)
    return categories
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\cache\cache-category-groups.service.ts
```
 
```ts
import { AppDataSource } from "../config/typeorm.datasource";
import { CategoryGroup } from "../entities/CategoryGroups.entity";
import { AuthRequest } from "../types/auth-request";
import { cacheKeys } from "./cache-key.service";
import { cache } from "./cache.service";


const getCategoryGroupBase = async (user_id: number): Promise<CategoryGroup[]> => {
    const cache_key = cacheKeys.categoryGroupByUser(user_id)
    const cached_category_group = cache.get<CategoryGroup[]>(cache_key)
    if (cached_category_group !== undefined) {
        return cached_category_group
    }
    const repo = AppDataSource.getRepository(CategoryGroup)
    const category_group: CategoryGroup[] = await repo.find({
        where: { user: { id: user_id } },
        order: { name: 'ASC' }
    })
    cache.set(cache_key, category_group)
    return category_group
}

export const getCategoryGroup = async (auth_req: AuthRequest): Promise<CategoryGroup[]> => {
    const user_id = auth_req.user.id
    const category_group: CategoryGroup[] = await getCategoryGroupBase(user_id)
    return category_group
}

export const getCategoryGroupById = async (auth_req: AuthRequest, category_group_id: number): Promise<CategoryGroup | null> => {
    const user_id = auth_req.user.id
    const category_groups = await getCategoryGroupBase(user_id)
    const category_group = category_groups.find(category_group => category_group.id === category_group_id)
    return category_group || null
}

export const getCategoryGroupByName = async (auth_req: AuthRequest, name: string): Promise<CategoryGroup | null> => {
    const user_id = auth_req.user.id
    const category_groups = await getCategoryGroupBase(user_id)
    const category_group = category_groups.find(category_group => category_group.name.toLowerCase() === name.toLowerCase())
    return category_group || null
}

export const getActiveCategoryGroupById = async (category_group_id: number, auth_req: AuthRequest): Promise<CategoryGroup | null> => {
    const user_id = auth_req.user.id
    const category_groups = await getCategoryGroupBase(user_id)
    const category_group = category_groups.find(category_group => category_group.id === category_group_id && category_group.is_active)
    return category_group || null
}

export const getActiveCategoryGroup = async (auth_req: AuthRequest): Promise<CategoryGroup[]> => {
    const user_id = auth_req.user.id
    const category_groups = await getCategoryGroupBase(user_id)
    const category_group = category_groups.filter(category_group => category_group.is_active)
    return category_group
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\cache\cache-home.service.ts
```
 
```ts
import { performance } from 'perf_hooks';
import { AppDataSource } from "../config/typeorm.datasource";
import { CacheKpiBalance } from "../entities/CacheKpiBalance.entity";
import { AuthRequest } from "../types/auth-request";
import { logger } from '../utils/logger.util';
import { cacheKeys } from "./cache-key.service";
import { cache } from "./cache.service";

type CashFlowSummary = {
  labels: string[]
  total_inflows: number[]
  total_outflows: number[]
  net_cash_flow: number[]
}

type LoanFlowSummary = {
  labels: string[]
  total_loans: number[]
  total_payments: number[]
  net_balance: number[]
}

const base_kpi = {
  incomes: 0,
  expenses: 0,
  loans: 0,
  payments: 0,
  savings: 0,
  withdrawals: 0,
  total_inflows: 0,
  total_outflows: 0,
  net_cash_flow: 0,
  net_savings: 0,
  available_balance: 0,
  principal_breakdown: 0,
  interest_breakdown: 0,
  is_populate: 0
}

type KpiBalance = typeof base_kpi

type TrendValue = {
  diff: number
  percent: number
  direction: 'up' | 'down' | 'equal'
} | null

type KpiTrend = {
  [K in keyof KpiBalance]: TrendValue
}

const buildAuthReq = (auth_req: AuthRequest, year: number, month: number): AuthRequest => {
  return {
    ...auth_req,
    query: {
      ...auth_req.query,
      year_period_for_kpi: year,
      month_period_for_kpi: month
    }
  } as unknown as AuthRequest
}

export const getHomeKpisCacheAccumulated = async (auth_req: AuthRequest): Promise<KpiBalance> => {
  const user_id = auth_req.user.id
  const year = Number(auth_req.query.year_period_for_kpi || 0)
  const month = Number(auth_req.query.month_period_for_kpi || 0)
  const cache_key = cacheKeys.homeBalanceKpiAccum(user_id, year, month)
  const cached = cache.get<KpiBalance>(cache_key)
  if (cached !== undefined) return cached
  const years = await getHomeAvailableYearsKpiCache(auth_req)
  const real_years = years.filter(y => y !== 0)
  if (!real_years.length) {
    cache.set(cache_key, base_kpi)
    return base_kpi
  }
  const base_year = Math.min(...real_years)
  const current = await getHomeBalanceKpiCache(auth_req)
  if (year <= base_year) {
    cache.set(cache_key, current)
    return current
  }
  const prev_req = buildAuthReq(auth_req, year - 1, 0)
  const prev: KpiBalance = await getHomeKpisCacheAccumulated(prev_req)
  const result: KpiBalance = {
    incomes: prev.incomes + current.incomes,
    expenses: prev.expenses + current.expenses,
    savings: prev.savings + current.savings,
    withdrawals: prev.withdrawals + current.withdrawals,
    loans: prev.loans + current.loans,
    payments: prev.payments + current.payments,
    total_inflows: prev.total_inflows + current.total_inflows,
    total_outflows: prev.total_outflows + current.total_outflows,
    net_cash_flow: prev.net_cash_flow + current.net_cash_flow,
    net_savings: prev.net_savings + current.net_savings,
    available_balance: prev.available_balance + current.available_balance,
    principal_breakdown: prev.principal_breakdown + current.principal_breakdown,
    interest_breakdown: prev.interest_breakdown + current.interest_breakdown,
    is_populate: 1
  }
  cache.set(cache_key, result)
  return result
}
const calcTrend = (current: number, previous: number): TrendValue => {
  if (previous === 0) return null
  const diff = Number((current - previous).toFixed(2))
  const percent = Number(((diff / previous) * 100).toFixed(2))
  return {
    diff,
    percent,
    direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'equal'
  }
}

const calcTrendObject = (current: KpiBalance, previous: KpiBalance): KpiTrend => {
  const result = {} as KpiTrend
  for (const key in current) {
    if (key === 'is_populate') continue
    const curr = current[key as keyof KpiBalance]
    const prev = previous[key as keyof KpiBalance]
    result[key as keyof KpiBalance] = calcTrend(curr, prev)
  }
  return result
}

/********************************************************************************************
 * ******************************************************************************************
 *******************************************************************************************/
export const getHomeAvailableYearsKpiCache = async (auth_req: AuthRequest): Promise<number[]> => {
  const user_id = auth_req.user.id
  const cache_key = cacheKeys.homeAvailableYearsKpi(user_id)
  const cached_available_kpi_years = cache.get<number[]>(cache_key)
  if (cached_available_kpi_years !== undefined) return cached_available_kpi_years
  const repo = AppDataSource.getRepository(CacheKpiBalance)
  const start = performance.now()
  const rows = await repo.createQueryBuilder('k')
    .select('DISTINCT k.period_year', 'year')
    .where('k.user_id = :user_id', { user_id })
    .orderBy('k.period_year', 'DESC')
    .getRawMany()
  const end = performance.now()
  const duration_sec = (end - start) / 1000
  logger.debug(`method=[${getHomeAvailableYearsKpiCache.name}], cacheKey=[${cache_key}], user=[${user_id}], entity=[cache-kpi-balance], count=[${rows.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)
  const years = rows.map(r => Number(r.year))
  const f_year = [0, ...years]
  logger.info(`${getHomeAvailableYearsKpiCache.name}. Años disponibles: `, { f_year })
  cache.set(cache_key, f_year)
  return f_year
}

export const getHomeBalanceKpiCache = async (auth_req: AuthRequest): Promise<KpiBalance> => {
  const user_id = auth_req.user.id
  const year_period_for_kpi = Number(auth_req.query.year_period_for_kpi || 0)
  const month_period_for_kpi = Number(auth_req.query.month_period_for_kpi || 0)
  const cache_key = cacheKeys.homeBalanceKpi(user_id, year_period_for_kpi, month_period_for_kpi)
  const cached = cache.get<KpiBalance>(cache_key)
  if (cached !== undefined) return cached
  const repo = AppDataSource.getRepository(CacheKpiBalance)
  const start = performance.now()
  const qb = repo.createQueryBuilder('k').where('k.user_id = :user_id', { user_id })
  if (year_period_for_kpi > 0) qb.andWhere('k.period_year = :year', { year: year_period_for_kpi })
  if (year_period_for_kpi > 0 && month_period_for_kpi > 0) qb.andWhere('k.period_month = :month', { month: month_period_for_kpi })
  const rows = await qb.getMany()
  const end = performance.now()
  const duration_sec = (end - start) / 1000
  logger.debug(`method=[${getHomeBalanceKpiCache.name}], cacheKey=[${cache_key}], user=[${user_id}], entity=[cache-kpi-balance], count=[${rows.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)
  if (!rows.length) return base_kpi

  logger.debug('HOME_KPI_ROWS', rows.map(row => ({ year: row.period_year, month: row.period_month, available_balance: row.available_balance })))
  const result: KpiBalance = rows.reduce((acc, row) => {
    acc.incomes += Number(row.incomes)
    acc.expenses += Number(row.expenses)
    acc.savings += Number(row.savings)
    acc.withdrawals += Number(row.withdrawals)
    acc.loans += Number(row.loans)
    acc.payments += Number(row.payments)
    acc.total_inflows += Number(row.total_inflows)
    acc.total_outflows += Number(row.total_outflows)
    acc.net_cash_flow += Number(row.net_cash_flow)
    acc.net_savings += Number(row.net_savings)
    acc.available_balance += Number(row.available_balance)
    acc.principal_breakdown += Number(row.principal_breakdown)
    acc.interest_breakdown += Number(row.interest_breakdown)
    acc.is_populate = 1
    return acc
  }, { ...base_kpi })
  logger.info(`${getHomeBalanceKpiCache.name}. `, { year_period_for_kpi, available_balance: result.available_balance })
  cache.set(cache_key, result)
  return result
}

export const getHomeTrendKpiCache = async (auth_req: AuthRequest) => {
  const user_id = auth_req.user.id
  const year = Number(auth_req.query.year_period_for_kpi || 0)
  const month = Number(auth_req.query.month_period_for_kpi || 0)
  if (year === 0) {
    return { current: base_kpi, previous: null, trend: null }
  }
  const cache_key = cacheKeys.homeTrendKpi(user_id, year, month)
  const cached = cache.get(cache_key)
  if (cached !== undefined) return cached
  const years = await getHomeAvailableYearsKpiCache(auth_req)
  const real_years = years.filter(y => y !== 0)
  if (!real_years.length) {
    const result = { current: base_kpi, previous: null, trend: null }
    cache.set(cache_key, result)
    return result
  }
  const base_year = Math.min(...real_years)
  const current = await getHomeBalanceKpiCache(auth_req)
  if (year <= base_year) {
    const result = { current, previous: null, trend: null }
    cache.set(cache_key, result)
    return result
  }
  const prev_req = buildAuthReq(auth_req, year - 1, 0)
  const previous: KpiBalance = await getHomeBalanceKpiCache(prev_req)
  const trend = calcTrendObject(current, previous)
  const result = { current, previous, trend }
  cache.set(cache_key, result)
  return result
}

export const getHomeCashFlowSummaryCache = async (auth_req: AuthRequest): Promise<CashFlowSummary> => {
  const user_id = auth_req.user.id
  const year = Number(auth_req.query.year_period_for_cash_summ || 0)

  const cache_key = cacheKeys.homeCashFlowSummary(user_id, year)
  const cached = cache.get<CashFlowSummary>(cache_key)
  if (cached !== undefined) return cached

  const labels: string[] = []
  const total_inflows: number[] = []
  const total_outflows: number[] = []
  const net_cash_flow: number[] = []

  let available_years = cache.get<number[]>(cacheKeys.homeAvailableYearsKpi(user_id)) || []
  available_years.sort((a, b) => a - b)

  if (year === 0) {
    for (const y of available_years) {
      if (y === 0) continue
      let inflows = 0
      let outflows = 0
      let net = 0

      for (let month = 1; month <= 12; month++) {
        const kpi_key = cacheKeys.homeBalanceKpi(user_id, y, month)
        let kpi = cache.get<KpiBalance>(kpi_key)

        if (!kpi) {
          const req = buildAuthReq(auth_req, y, month)
          kpi = await getHomeBalanceKpiCache(req)
          cache.set(kpi_key, kpi)
        }

        inflows += kpi?.total_inflows ?? 0
        outflows += kpi?.total_outflows ?? 0
        net += kpi?.net_cash_flow ?? 0
      }

      labels.push(String(y))
      total_inflows.push(inflows)
      total_outflows.push(outflows)
      net_cash_flow.push(net)
    }
  } else {
    const month_labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

    for (let month = 1; month <= 12; month++) {
      const kpi_key = cacheKeys.homeBalanceKpi(user_id, year, month)
      const kpi = cache.get<KpiBalance>(kpi_key)

      labels.push(month_labels[month - 1])
      total_inflows.push(kpi?.total_inflows ?? 0)
      total_outflows.push(kpi?.total_outflows ?? 0)
      net_cash_flow.push(kpi?.net_cash_flow ?? 0)
    }
  }

  const result: CashFlowSummary = {
    labels,
    total_inflows,
    total_outflows,
    net_cash_flow
  }

  cache.set(cache_key, result)
  return result
}

export const getHomeLoanFlowSummaryCache = async (auth_req: AuthRequest): Promise<LoanFlowSummary> => {
  const user_id = auth_req.user.id
  const year = Number(auth_req.query.year_period_for_loan_summ || 0)

  const cache_key = cacheKeys.homeLoanFlowSummary(user_id, year)
  const cached = cache.get<LoanFlowSummary>(cache_key)
  if (cached !== undefined) return cached

  const labels: string[] = []
  const total_loans: number[] = []
  const total_payments: number[] = []
  const net_balance: number[] = []

  let available_years = cache.get<number[]>(cacheKeys.homeAvailableYearsKpi(user_id)) || []
  available_years.sort((a, b) => a - b)

  if (year === 0) {
    for (const y of available_years) {
      if (y === 0) continue

      let loans = 0
      let payments = 0
      let net = 0

      for (let month = 1; month <= 12; month++) {
        const kpi_key = cacheKeys.homeBalanceKpi(user_id, y, month)
        let kpi = cache.get<KpiBalance>(kpi_key)

        if (!kpi) {
          const req = buildAuthReq(auth_req, y, month)
          kpi = await getHomeBalanceKpiCache(req)
          cache.set(kpi_key, kpi)
        }

        loans += kpi?.loans ?? 0
        payments += kpi?.payments ?? 0
        net += (kpi?.loans ?? 0) - (kpi?.payments ?? 0)
      }

      labels.push(String(y))
      total_loans.push(loans)
      total_payments.push(payments)
      net_balance.push(net)
    }
  } else {
    const month_labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

    for (let month = 1; month <= 12; month++) {
      const kpi_key = cacheKeys.homeBalanceKpi(user_id, year, month)
      const kpi = cache.get<KpiBalance>(kpi_key)

      labels.push(month_labels[month - 1])
      total_loans.push(kpi?.loans ?? 0)
      total_payments.push(kpi?.payments ?? 0)
      net_balance.push((kpi?.loans ?? 0) - (kpi?.payments ?? 0))
    }
  }

  const result: LoanFlowSummary = {
    labels,
    total_loans,
    total_payments,
    net_balance
  }

  cache.set(cache_key, result)
  return result
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\cache\cache-key.service.ts
```
 
```ts
import { AuthRequest } from "../types/auth-request"
import { logger } from "../utils/logger.util"
import { cache } from "./cache.service"

export type TypeSource = 'account' | 'category' | 'category_group' | 'loan' | 'loan_group' | 'payment' | 'transaction' | 'home'

export const cacheKeys = {
  accountsByUser: (user_id: number) => `accounts_user_${user_id}`,
  accountsByUserForApi: (user_id: number) => `accounts_api_user_${user_id}`,

  categoriesByUser: (user_id: number) => `categories_user_${user_id}`,
  categoriesByUserForApi: (user_id: number) => `categories_api_user_${user_id}`,

  categoryGroupByUser: (user_id: number) => `category_group_user_${user_id}`,
  categoryGroupByUserForApi: (user_id: number) => `category_group_api_user_${user_id}`,

  loansByUser: (user_id: number) => `loans_user_${user_id}`,
  loansByUserForApi: (user_id: number) => `loans_api_user_${user_id}`,

  loanGroupByUser: (user_id: number) => `loan_group_user_${user_id}`,
  loanGroupByUserForApi: (user_id: number) => `loan_group_api_user_${user_id}`,

  paymentsByUser: (user_id: number) => `payment_user_${user_id}`,
  paymentsByUserForApi: (user_id: number) => `payment_api_user_${user_id}`,

  paymentsByLoan: (user_id: number, loan_id: number) => `payment_user_${user_id}_loan_${loan_id}`,
  paymentsByLoanForApi: (user_id: number, loan_id: number) => `payment_api_user_${user_id}_loan_${loan_id}`,
  paymentsByLoanPrefix: (user_id: number) => `payment_api_user_${user_id}_loan_`,

  homeAvailableYearsKpi: (user_id: number) => `home_available_years_kpi_user_${user_id}`,

  homeBalanceKpi: (user_id: number, year: number, month: number) => `home_balance_kpi_user_${user_id}_year_${year}_month_${month}`,
  homeBalanceKpiPrefix: (user_id: number) => `home_balance_kpi_user_${user_id}_`,

  homeCashFlowSummary: (user_id: number, year: number) => `home_cash_flow_summary_user_${user_id}_year_${year}`,
  homeCashFlowSummaryPrefix: (user_id: number) => `home_cash_flow_summary_user_${user_id}_year_`,

  homeLoanFlowSummary: (user_id: number, year: number) => `home_loan_flow_summary_user_${user_id}_year_${year}`,
  homeLoanFlowSummaryPrefix: (user_id: number) => `home_loan_flow_summary_user_${user_id}_year_`,

  homeTrendKpi: (user_id: number, year: number, month: number) => `home_kpis_trend_user_${user_id}_year_${year}_month_${month}`,
  homeTrendKpiPrefix: (user_id: number) => `home_kpis_trend_user_${user_id}_`,

  homeBalanceKpiAccum: (user_id: number, year: number, month: number) => `home_kpis_balance_accum_user_${user_id}_year_${year}_month_${month}`,
  homeBalanceKpiAccumPrefix: (user_id: number) => `home_kpis_balance_accum_user_${user_id}_`,

  allByUser: (user_id: number) => [
    `accounts_user_${user_id}`,
    `accounts_api_user_${user_id}`,
    `categories_user_${user_id}`,
    `categories_api_user_${user_id}`,
    `category_group_user_${user_id}`,
    `category_group_api_user_${user_id}`,
    `loans_user_${user_id}`,
    `loans_api_user_${user_id}`,
    `loan_group_user_${user_id}`,
    `loan_group_api_user_${user_id}`,
    `payment_user_${user_id}`,
    `payment_api_user_${user_id}`,
    `home_available_years_kpi_user_${user_id}`,
  ]
}

const delByPrefix = (prefix: string) => {
  const keys = cache.keys()
  const keys_to_delete = keys.filter(k => k.startsWith(prefix))
  return cache.del(keys_to_delete)
}

export const deleteAll = (auth_req: AuthRequest, source: TypeSource): void => {
  const user_id = auth_req.user.id
  const deleted = cache.del(cacheKeys.allByUser(user_id))
  const deleted_kpis = delByPrefix(cacheKeys.homeBalanceKpiPrefix(user_id))
  const deleted_payments = delByPrefix(cacheKeys.paymentsByLoanPrefix(user_id))
  const deleted_kpis_accum = delByPrefix(cacheKeys.homeBalanceKpiAccumPrefix(user_id))
  const deleted_trend = delByPrefix(cacheKeys.homeTrendKpiPrefix(user_id))
  const deleted_cash_flow_summary = delByPrefix(cacheKeys.homeCashFlowSummaryPrefix(user_id))
  const deleted_loan_flow_summary = delByPrefix(cacheKeys.homeLoanFlowSummaryPrefix(user_id))
  logger.debug(`Delete Cache All. user=[${user_id}], keysDeleted=[${deleted}], kpisDeleted=[${deleted_kpis}], kpisAccumDeleted=[${deleted_kpis_accum}], trendDeleted=[${deleted_trend}], paymentsDeleted=[${deleted_payments}], cashFlowSummary=[${deleted_cash_flow_summary}], loanFlowSummary=[${deleted_loan_flow_summary}]`)
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\cache\cache-loan-groups.service.ts
```
 
```ts
import { AppDataSource } from "../config/typeorm.datasource";
import { LoanGroup } from "../entities/PayableGroup.entity";
import { AuthRequest } from "../types/auth-request";
import { cacheKeys } from "./cache-key.service";
import { cache } from "./cache.service";

const getLoanGroupBase = async (user_id: number): Promise<LoanGroup[]> => {
    const cache_key = cacheKeys.loanGroupByUser(user_id)
    const cached_loan_group = cache.get<LoanGroup[]>(cache_key)
    if (cached_loan_group !== undefined) {
        return cached_loan_group
    }
    const repo = AppDataSource.getRepository(LoanGroup)
    const loan_group: LoanGroup[] = await repo.find({
        where: { user: { id: user_id } },
        order: { name: 'ASC' }
    })
    cache.set(cache_key, loan_group)
    return loan_group
}

export const getLoanGroup = async (auth_req: AuthRequest): Promise<LoanGroup[]> => {
    const user_id = auth_req.user.id
    const loan_group: LoanGroup[] = await getLoanGroupBase(user_id)
    return loan_group
}

export const getLoanGroupById = async (auth_req: AuthRequest, loan_group_id: number): Promise<LoanGroup | null> => {
    const user_id = auth_req.user.id
    const loan_groups = await getLoanGroupBase(user_id)
    const loan_group = loan_groups.find(loan_group => loan_group.id === loan_group_id)
    return loan_group || null
}

export const getLoanGroupByName = async (auth_req: AuthRequest, name: string): Promise<LoanGroup | null> => {
    const user_id = auth_req.user.id
    const loan_groups = await getLoanGroupBase(user_id)
    const loan_group = loan_groups.find(loan_group => loan_group.name.toLowerCase() === name.toLowerCase())
    return loan_group || null
}

export const getActiveLoanGroupById = async (auth_req: AuthRequest, loan_group_id: number): Promise<LoanGroup | null> => {
    const user_id = auth_req.user.id
    const loan_groups = await getLoanGroupBase(user_id)
    const loan_group = loan_groups.find(loan_group => loan_group.id === loan_group_id && loan_group.is_active)
    return loan_group || null
}

export const getActiveLoanGroup = async (auth_req: AuthRequest): Promise<LoanGroup[]> => {
    const user_id = auth_req.user.id
    const loan_groups = await getLoanGroupBase(user_id)
    const loan_group = loan_groups.filter(loan_group => loan_group.is_active)
    return loan_group
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\cache\cache-loan-payments.service.ts
```
 
```ts
import { AppDataSource } from "../config/typeorm.datasource"
import { LoanPayment } from "../entities/PayablePayment.entity"
import { AuthRequest } from "../types/auth-request"
import { logger } from "../utils/logger.util"
import { cacheKeys } from "./cache-key.service"
import { cache } from "./cache.service"

export type DTOLoanPayment = {
    id: number
    payment_number: number
    principal_paid: number
    interest_paid: number
    payment_date: Date
    note: string | null
    created_at: Date
    account: { id: number, name: string } | null
    category: { id: number, name: string } | null
    loan: { id: number, name: string } | null
}

const getPaymentsBase = async (user_id: number): Promise<LoanPayment[]> => {
    const cache_key = cacheKeys.paymentsByUser(user_id)
    const cached_payments = cache.get<LoanPayment[]>(cache_key)
    if (cached_payments !== undefined) return cached_payments

    const repo = AppDataSource.getRepository(LoanPayment)
    const payments: LoanPayment[] = await repo.find({
        where: { loan: { user: { id: user_id } } },
        relations: { loan: true, category: true, account: true, transaction: true },
    })

    cache.set(cache_key, payments)
    return payments
}

export const getPayments = async (auth_req: AuthRequest): Promise<LoanPayment[]> => {
    const user_id = auth_req.user.id
    const payments: LoanPayment[] = await getPaymentsBase(user_id)
    return payments
}

export const getPaymentById = async (auth_req: AuthRequest, payment_id: number): Promise<LoanPayment | null> => {
    const user_id = auth_req.user.id
    const payments = await getPaymentsBase(user_id)
    const payment = payments.find(payment => payment.id === payment_id)
    return payment || null
}

export const getPaymentsForApi = async (auth_req: AuthRequest, loan_id: number): Promise<DTOLoanPayment[]> => {
    const user_id = auth_req.user.id
    const cache_key = cacheKeys.paymentsByLoanForApi(user_id, loan_id)

    const cached = cache.get<DTOLoanPayment[]>(cache_key)
    if (cached !== undefined) return cached

    const repo = AppDataSource.getRepository(LoanPayment)
    const start = performance.now()

    const result = await repo.find({
        where: { loan: { id: loan_id } },
        relations: { loan: true, account: true, category: true },
        order: { payment_date: 'DESC' }
    })

    const payments: DTOLoanPayment[] = result.map(p => ({
        id: p.id,
        payment_number: p.payment_number,
        principal_paid: p.principal_paid,
        interest_paid: p.interest_paid,
        payment_date: p.payment_date,
        note: p.note,
        created_at: p.created_at,
        account: p.account ? { id: p.account.id, name: p.account.name } : null,
        category: p.category ? { id: p.category.id, name: p.category.name } : null,
        loan: p.loan ? { id: p.loan.id, name: p.loan.name } : null
    }))

    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`method=[${getPaymentsForApi.name}], cacheKey=[${cache_key}], loan=[${loan_id}], user=[${user_id}], entity=[loan_payment], count=[${payments.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    cache.set(cache_key, payments)
    return payments
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\cache\cache-loans.service.ts
```
 
```ts
import { performance } from 'perf_hooks';
import { AppDataSource } from "../config/typeorm.datasource";
import { Loan } from "../entities/Payable.entity";
import { AuthRequest } from "../types/auth-request";
import { logger } from '../utils/logger.util';
import { cacheKeys } from "./cache-key.service";
import { cache } from "./cache.service";

type DTOLoan = {
    id: number
    name: string
    total_amount: number
    principal_paid: number
    interest_paid: number
    balance: number
    start_date: Date
    end_date: Date | null
    is_active: boolean
    created_at: Date
    note: string | null
    disbursement_account: { id: number, name: string } | null
    category: { id: number, name: string } | null
    loan_group: { id: number, name: string } | null
}

type DTOLoanGroupTotal = {
    loan_group_id: number
    loan_group_name: string
    total_balance: number
}

const getLoansBase = async (user_id: number): Promise<Loan[]> => {
    const cache_key = cacheKeys.loansByUser(user_id)
    const cached_loans = cache.get<Loan[]>(cache_key)
    if (cached_loans !== undefined) {
        return cached_loans
    }
    const repo = AppDataSource.getRepository(Loan)
    const loans: Loan[] = await repo.find({
        where: { user: { id: user_id } },
        relations: { loan_group: true, category: true, disbursement_account: true, transaction: true, payments: true },
        order: { name: 'ASC' }
    })
    cache.set(cache_key, loans)
    return loans
}

export const getLoans = async (auth_req: AuthRequest): Promise<Loan[]> => {
    const user_id = auth_req.user.id
    const loans: Loan[] = await getLoansBase(user_id)
    return loans
}

export const getLoanById = async (auth_req: AuthRequest, loan_id: number): Promise<Loan | null> => {
    const user_id = auth_req.user.id
    const loans = await getLoansBase(user_id)
    const loan = loans.find(loan => loan.id === loan_id)
    return loan || null
}

export const getLoanByName = async (auth_req: AuthRequest, name: string): Promise<Loan | null> => {
    const user_id = auth_req.user.id
    const loans = await getLoansBase(user_id)
    const loan = loans.find(loan => loan.name.toLowerCase() === name.toLowerCase())
    return loan || null
}

export const getActiveLoanById = async (auth_req: AuthRequest, loan_id: number): Promise<Loan | null> => {
    const user_id = auth_req.user.id
    const loans = await getLoansBase(user_id)
    const loan = loans.find(loan => loan.id === loan_id && loan.is_active)
    return loan || null
}

export const getActiveLoans = async (auth_req: AuthRequest): Promise<Loan[]> => {
    const user_id = auth_req.user.id
    const loans: Loan[] = await getLoansBase(user_id)
    const active_loans: Loan[] = loans.filter(loan => loan.is_active)
    return active_loans
}

export const getInactiveLoans = async (auth_req: AuthRequest): Promise<Loan[]> => {
    const user_id = auth_req.user.id
    const loans: Loan[] = await getLoansBase(user_id)
    const inactive_loans: Loan[] = loans.filter(loan => !loan.is_active)
    return inactive_loans
}

export const getLoansForApi = async (auth_req: AuthRequest): Promise<{ loans: DTOLoan[], group_totals: DTOLoanGroupTotal[] }> => {
    const user_id = auth_req.user.id
    const cache_key = cacheKeys.loansByUserForApi(user_id)
    const cached_loans = cache.get<{ loans: DTOLoan[], group_totals: DTOLoanGroupTotal[] }>(cache_key)
    if (cached_loans !== undefined) {
        return cached_loans
    }

    const repository = AppDataSource.getRepository(Loan)
    const start = performance.now()
    const result = await repository
        .createQueryBuilder('loan')
        .leftJoinAndSelect('loan.loan_group', 'loan_group')
        .leftJoinAndSelect('loan.disbursement_account', 'disbursement_account')
        .leftJoinAndSelect('loan.category', 'category')
        .where('loan.user_id = :user_id', { user_id })
        .orderBy('loan_group.name', 'ASC')
        .addOrderBy('loan.name', 'ASC')
        .getMany()

    const loans: DTOLoan[] = result.map(loan => ({
        id: loan.id,
        name: loan.name,
        total_amount: loan.total_amount,
        principal_paid: loan.principal_paid,
        interest_paid: loan.interest_paid,
        balance: loan.balance,
        start_date: loan.start_date,
        end_date: loan.end_date,
        is_active: loan.is_active,
        created_at: loan.created_at,
        note: loan.note,
        disbursement_account: loan.disbursement_account ? { id: loan.disbursement_account.id, name: loan.disbursement_account.name } : null,
        category: loan.category ? { id: loan.category.id, name: loan.category.name } : null,
        loan_group: loan.loan_group ? { id: loan.loan_group.id, name: loan.loan_group.name } : null
    }))

    const group_totals_map: Record<number, DTOLoanGroupTotal> = {}

    for (const loan of result) {
        if (!loan.loan_group) continue
        const group_id = loan.loan_group.id

        if (!group_totals_map[group_id]) {
            group_totals_map[group_id] = {
                loan_group_id: group_id,
                loan_group_name: loan.loan_group.name,
                total_balance: 0
            }
        }

        group_totals_map[group_id].total_balance += Number(loan.balance)
    }

    const group_totals = Object.values(group_totals_map)
    const response = { loans, group_totals }
    
    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`method=[${getLoansForApi.name}], cacheKey=[${cache_key}], user=[${user_id}], entity=[loan], count=[${loans.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    cache.set(cache_key, response)
    return response
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\cache\cache.service.ts
```
 
```ts
import NodeCache from 'node-cache'

export const cache = new NodeCache({
    stdTTL: 14400, // 4 horas
    checkperiod: 120 // 2 minutos
}) 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\config\rate-limiter.ts
```
 
```ts
import rateLimit from 'express-rate-limit'
import { Request, Response } from 'express'

/**
 * Handler personalizado para respuestas de rate limit en JSON
 */
const createJsonHandler = (message: string) => {
  return (req: Request, res: Response) => {
    const rateLimitData = (req as any).rateLimit
    const retryAfter = rateLimitData?.resetTime ? 
      Math.ceil((rateLimitData.resetTime - Date.now()) / 1000) : 60
    
    res.status(429).json({
      success: false,
      error: message,
      retryAfter, // segundos antes de reintentar
      resetTime: rateLimitData?.resetTime
    })
  }
}

/**
 * Rate limiter para login (5 intentos por 15 minutos)
 * Previene ataques de fuerza bruta en credenciales
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos máximo
  message: 'Demasiados intentos de login. Intenta nuevamente en 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createJsonHandler('Demasiados intentos de login. Espera antes de intentar nuevamente.'),
  skip: (req) => {
    return process.env.NODE_SKIP_LOGIN === 'true'
  }
})

/**
 * Rate limiter para 2FA (5 intentos por 15 minutos)
 * Previene ataques de fuerza bruta en códigos de verificación
 */
export const twoFALimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos máximo
  message: 'Demasiados intentos de 2FA. Intenta nuevamente en 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createJsonHandler('Demasiados intentos de 2FA. Espera antes de intentar nuevamente.'),
  skip: (req) => {
    return process.env.NODE_SKIP_LOGIN === 'true'
  }
})

/**
 * Rate limiter general para APIs (100 solicitudes por minuto)
 * Protege contra DOS en endpoints de lectura
 * Más permisivo que login/2FA para no afectar navegación normal
 */
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 solicitudes máximo (suficiente para navegación)
  message: 'Demasiadas solicitudes. Espera antes de enviar más.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createJsonHandler('Límite de solicitudes excedido. Espera antes de intentar nuevamente.'),
  // Removido keyGenerator personalizado para usar el por defecto que maneja IPv6 correctamente
})
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\config\session-store.ts
```
 
```ts
import MySQLStoreFactory from 'express-mysql-session'
import session from 'express-session'
import mysql from 'mysql2/promise'

const MySQLStore = MySQLStoreFactory(session)

/* ============================
   Pool MySQL para sesiones
============================ */
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: 'Z',
  connectionLimit: process.env.SESSION_DB_CONNECTION_LIMIT ? parseInt(process.env.SESSION_DB_CONNECTION_LIMIT, 10) : 1
})

/* ============================
   Store de sesiones
============================ */
export const sessionStore = new MySQLStore(
  {
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: 60 * 60 * 1000,
    createDatabaseTable: true,
    schema: {
      tableName: 'sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data'
      }
    }
  },
  pool as any
)
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\config\typeorm-decimal.transformer.ts
```
 
```ts
import { ValueTransformer } from 'typeorm'

export const DecimalTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => value === null ? null : Number(value)
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\config\typeorm.datasource.ts
```
 
```ts
import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { Account } from '../entities/Account.entity'
import { AuthCode } from '../entities/AuthCode.entity'
import { CacheKpiBalance } from '../entities/CacheKpiBalance.entity'
import { CacheKpiCategory } from '../entities/CacheKpiCategory.entity'
import { Category } from '../entities/Category.entity'
import { CategoryGroup } from '../entities/CategoryGroups.entity'
import { Payable } from '../entities/Payable.entity'
import { PayableGroup } from '../entities/PayableGroup.entity'
import { PayablePayment } from '../entities/PayablePayment.entity'
import { Receivable } from '../entities/Receivable.entity'
import { ReceivableCollection } from '../entities/ReceivableCollection.entity'
import { ReceivableGroup } from '../entities/ReceivableGroup.entity'
import { Transaction } from '../entities/Transaction.entity'
import { User } from '../entities/User.entity'
import { OneLineSqlLogger } from './typeorm.logger'

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [
    User,
    AuthCode,
    Account,
    Category,
    CategoryGroup,
    Payable,
    PayableGroup,
    PayablePayment,
    Transaction,
    CacheKpiBalance,
    CacheKpiCategory,
    Receivable,
    ReceivableCollection,
    ReceivableGroup
  ],
  synchronize: false,
  timezone: 'Z',
  extra: {
    timezone: 'Z',
    connectionLimit: process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT, 10) : 3
  },
  logging: process.env.DB_LOGGING === 'true' ? true : false,
  logger: new OneLineSqlLogger()
})
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\config\typeorm.logger.ts
```
 
```ts
import { QueryRunner, Logger as TypeOrmLogger } from 'typeorm';
import { logger } from '../utils/logger.util';

export class OneLineSqlLogger implements TypeOrmLogger {
  private enabled = process.env.DB_LOGGING === 'true';

  logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner) {
    if (!this.enabled) return;
    const oneLine = query.replace(/\s+/g, ' ').trim()
    logger.debug('QUERY', { query: oneLine, parameters })
  }

  logQueryError(error: string | Error, query: string, parameters?: any[], queryRunner?: QueryRunner) {
    if (!this.enabled) return;
    logger.error('QUERY ERROR', { query, parameters, error })
  }

  logQuerySlow(time: number, query: string, parameters?: any[], queryRunner?: QueryRunner) {
    if (!this.enabled) return;
    logger.warn('SLOW QUERY', { time, query, parameters })
  }

  logSchemaBuild(message: string, queryRunner?: QueryRunner) {
    if (!this.enabled) return;
    logger.info('SCHEMA BUILD', { message })
  }
  logMigration(message: string, queryRunner?: QueryRunner) {
    if (!this.enabled) return;
    logger.info('MIGRATION', { message })
  }

  log(level: 'log' | 'info' | 'warn', message: any, queryRunner?: QueryRunner) {
    if (level === 'log' || level === 'info') logger.info(message)
    if (level === 'warn') logger.warn(message)
  }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\config\genhash.js
```
 
```js
import bcrypt from 'bcryptjs'

async function run() {
  const password = '12345'
  const hash = await bcrypt.hash(password, 10)
  console.log(hash)
}

run()

/* Para ejecutar: node src/config/genhash.js */ 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\account\account.controller.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express'
import { DTOAccount, getAccountById, getAccountsForApi } from '../../cache/cache-accounts.service'
import { accountFormMatrix } from '../../policies/account-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { BaseFormViewParams } from '../../types/form-view-params'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'
export { saveAccount as apiForSavingAccount } from './account.saving'

type AccountFormViewParams = BaseFormViewParams & {
  account: any
}

const renderAccountForm = async (res: Response, params: AccountFormViewParams) => {
  const { title, view, account, errors, mode, auth_req } = params
  const account_form_policy = accountFormMatrix[mode]
  return res.render('layouts/main', {
    title,
    view,
    errors,
    mode,
    auth_req,
    account,
    account_form_policy,
  })
}

export const routeToPageAccount: RequestHandler = (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  res.render('layouts/main', {
    title: 'Cuentas',
    view: 'pages/accounts/index',
    USER_ID: auth_req.user?.id || 'guest'
  })
}

export const routeToFormInsertAccount: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  return renderAccountForm(res, {
    title: 'Insertar Cuenta',
    view: 'pages/accounts/form',
    errors: {},
    mode,
    auth_req,
    account: {
      type: null,
      is_active: true
    },
  })
}

export const routeToFormUpdateAccount: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'update'
  const auth_req = req as AuthRequest
  const account_id = Number(req.params.id)
  const account = await getAccountById(auth_req, account_id)
  if (!account) {
    return res.redirect('/accounts')
  }
  return renderAccountForm(res, {
    title: 'Editar Cuenta',
    view: 'pages/accounts/form',
    errors: {},
    mode,
    auth_req,
    account,
  })
}

export const routeToFormDeleteAccount: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'delete'
  const auth_req = req as AuthRequest
  const account_id = Number(req.params.id)
  const account = await getAccountById(auth_req, account_id)
  if (!account) {
    return res.redirect('/accounts')
  }
  return renderAccountForm(res, {
    title: 'Eliminar Cuenta',
    view: 'pages/accounts/form',
    errors: {},
    mode,
    auth_req,
    account,
  })
}

/*=================================================
Api para devolver el DTO Account en JSON
==================================================*/
export const apiForGettingAccounts: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  try {
    const accounts: DTOAccount[] = await getAccountsForApi(auth_req)
    res.json(accounts)
  } catch (error) {
    logger.error(`${apiForGettingAccounts.name}-Error. `, parseError(error))
    res.status(500).json({ error: 'Error al listar cuentas' })
  } finally {
  }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\account\account.saving.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express';
import { performance } from 'perf_hooks';
import { getAccountById } from '../../cache/cache-accounts.service';
import { deleteAll } from '../../cache/cache-key.service';
import { AppDataSource } from '../../config/typeorm.datasource';
import { Account } from '../../entities/Account.entity';
import { accountFormMatrix } from '../../policies/account-form.policy';
import { AuthRequest } from '../../types/auth-request';
import { AccountFormMode } from '../../types/form-view-params';
import { parseBoolean } from '../../utils/bool.util';
import { parseError } from '../../utils/error.util';
import { logger } from '../../utils/logger.util';
import { validateDeleteAccount, validateSaveAccount } from './account.validator';

/* ============================
   Título según modo
============================ */
const getTitle = (mode: AccountFormMode) => {
  switch (mode) {
    case 'insert': return 'Insertar Cuenta'
    case 'update': return 'Editar Cuenta'
    case 'delete': return 'Eliminar Cuenta'
    default: return 'Indefinido'
  }
}

/* ============================
   Sanitizar payload según policy
============================ */
const sanitizeByPolicy = (mode: AccountFormMode, body: any) => {
  const policy = accountFormMatrix[mode]
  const clean: any = {}
  for (const field in policy) {
    if ((policy[field] === 'editable' || policy[field] === 'readonly') && body[field] !== undefined) {
      clean[field] = body[field]
    }
  }
  return clean
}

/* ============================
   Construir objeto para la vista
============================ */
const buildAccountView = (body: any) => {
  return {
    ...body,
    is_active: parseBoolean(body.is_active)
  }
}

export const saveAccount: RequestHandler = async (req: Request, res: Response) => {
  const start = performance.now()
  logger.info(`${saveAccount.name} called`, { body: req.body, param: req.params })
  const auth_req = req as AuthRequest
  const user_id = auth_req.user.id
  const account_id = req.body.id ? Number(req.body.id) : undefined
  const mode: AccountFormMode = req.body.mode || 'insert'
  const repo_account = AppDataSource.getRepository(Account)

  const form_state = {
    account: buildAccountView(req.body),
    account_form_policy: accountFormMatrix[mode],
    mode
  }
  try {
    let existing: Account | null = null
    if (account_id) {
      existing = await getAccountById(auth_req, account_id)
      if (!existing) throw new Error('Cuenta no encontrada')
    }
    /* ============================
       DELETE
    ============================ */
    if (mode === 'delete') {
      if (!existing) throw new Error('Cuenta no encontrada')
      const errors = await validateDeleteAccount(auth_req, existing)
      if (errors) throw { validationErrors: errors }
      await repo_account.delete(existing.id)
      deleteAll(auth_req, 'account')
      return res.redirect('/accounts')
    }
    /* ============================
       INSERT / UPDATE
    ============================ */
    let account: Account
    if (mode === 'insert') {
      account = repo_account.create({
        user: { id: auth_req.user.id } as any,
        type: req.body.type,
        name: req.body.name,
        is_active: true,
        balance: 0
      })
    } else {
      if (!existing) throw new Error('Cuenta no encontrada')
      account = existing
    }
    /*=================================
      Aplicar sanitización por policy
    =================================*/
    const clean = sanitizeByPolicy(mode, req.body)
    if (clean.type !== undefined) { account.type = clean.type }
    if (clean.name !== undefined) { account.name = clean.name }
    if (clean.is_active !== undefined) { account.is_active = parseBoolean(clean.is_active) }
    const errors = await validateSaveAccount(auth_req, account)
    if (errors) throw { validationErrors: errors }
    /*=================================
      Guardar en base de datos y limpiar cache
    =================================*/
    await repo_account.save(account)
    deleteAll(auth_req, 'account')
    return res.redirect('/accounts')
  } catch (error: any) {
    /* ============================
       Manejo de errores
    ============================ */
    logger.error('Error saving account', { user_id: auth_req.user.id, account_id, mode, error: parseError(error) })
    const validation_errors = error?.validationErrors || null
    return res.render('layouts/main', {
      title: getTitle(mode),
      view: 'pages/accounts/form',
      ...form_state,
      errors: validation_errors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
    })
  } finally {
    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`${saveAccount.name}. user=[${user_id}], elapsedTime=[${duration_sec.toFixed(4)}]`)
  }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\account\account.validator.ts
```
 
```ts
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Account } from '../../entities/Account.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'
import { getAccountByName } from '../../cache/cache-accounts.service'

export const validateSaveAccount = async (auth_req: AuthRequest, account: Account): Promise<Record<string, string> | null> => {
    const user_id = auth_req.user.id
    const account_instance = plainToInstance(Account, account)
    const errors = await validate(account_instance)
    const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}
    // BALANCE VALIDATION
    if (account.id && account.is_active === false && account.balance !== 0) {
        field_errors.is_active = 'No se puede desactivar la cuenta si tiene un balance mayor a cero'
    }
    // NAME UNIQUENESS VALIDATION
    if (account.name && user_id) {
        const existing = await getAccountByName(auth_req, account.name)
        if (existing && existing.id !== account.id) {
            field_errors.name = 'Ya existe una cuenta con este nombre'
        }
    }
    return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeleteAccount = async (auth_req: AuthRequest, account: Account): Promise<Record<string, string> | null> => {
    const user_id = auth_req.user.id
    const field_errors: Record<string, string> = {}
    // BALANCE VALIDATION
    if (account.balance !== 0) {
        field_errors.general = 'No se puede eliminar la cuenta porque tiene balance distinto de cero'
    }
    // TRANSACTION REFERENCE VALIDATION
    const transaction_repo = AppDataSource.getRepository(Transaction)
    const used_in_transactions = await transaction_repo.existsBy([
        { user: { id: user_id }, account: { id: account.id } },
        { user: { id: user_id }, to_account: { id: account.id } }
    ])
    if (used_in_transactions) {
        if (field_errors.general) {
            field_errors.general += ' y tiene transacciones asociadas'
        } else {
            field_errors.general = 'No se puede eliminar la cuenta porque tiene transacciones asociadas'
        }
    }
    return Object.keys(field_errors).length > 0 ? field_errors : null
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\category\category.controller.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express'
import { DTOCategory, getCategoriesForApi, getCategoryById } from '../../cache/cache-categories.service'
import { categoryFormMatrix } from '../../policies/category-form.policy'
import { getActiveParentCategoriesByUser } from '../../services/populate-items.service'
import { AuthRequest } from '../../types/auth-request'
import { BaseFormViewParams } from '../../types/form-view-params'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'
export { saveCategory as apiForSavingCategory } from './category.saving'

type CategoryFormViewParams = BaseFormViewParams & {
  category: any
}

const renderCategoryForm = async (res: Response, params: CategoryFormViewParams) => {
  const { title, view, category, errors, mode, auth_req } = params
  const category_group_list = await getActiveParentCategoriesByUser(auth_req)
  const category_form_policy = categoryFormMatrix[mode]
  return res.render('layouts/main', {
    title,
    view,
    errors,
    mode,
    auth_req,
    category,
    category_form_policy,
    category_group_list,
  })
}

export const routeToPageCategory: RequestHandler = (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  res.render('layouts/main', {
    title: 'Categorías',
    view: 'pages/categories/index',
    USER_ID: auth_req.user?.id || 'guest'
  })
}

export const routeToFormInsertCategory: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  return renderCategoryForm(res, {
    title: 'Insertar Categoría',
    view: 'pages/categories/form',
    errors: {},
    mode,
    auth_req,
    category: {
      type: null,
      type_for_loan: null,
      category_group: null,
      is_active: true
    },
  })
}

export const routeToFormUpdateCategory: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'update'
  const auth_req = req as AuthRequest
  const category_id = Number(req.params.id)
  const category = await getCategoryById(auth_req, category_id)
  if (!category) {
    return res.redirect('/categories')
  }
  return renderCategoryForm(res, {
    title: 'Editar Categoría',
    view: 'pages/categories/form',
    errors: {},
    mode,
    auth_req,
    category,
  })
}

export const routeToFormDeleteCategory: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'delete'
  const auth_req = req as AuthRequest
  const category_id = Number(req.params.id)
  const category = await getCategoryById(auth_req, category_id)
  if (!category) {
    return res.redirect('/categories')
  }
  return renderCategoryForm(res, {
    title: 'Eliminar Categoría',
    view: 'pages/categories/form',
    errors: {},
    mode,
    auth_req,
    category,
  })
}

/*=================================================
Api para devolver el DTO Category en JSON
==================================================*/
export const apiForGettingCategories: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  try {
    const categories: DTOCategory[] = await getCategoriesForApi(auth_req)
    res.json(categories)
  } catch (error) {
    logger.error(`${apiForGettingCategories.name}-Error. `, parseError(error))
    res.status(500).json({ error: 'Error al listar categorías' })
  } finally {
  }
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\category\category.saving.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express';
import { performance } from 'perf_hooks';
import { getCategoryById } from '../../cache/cache-categories.service';
import { getActiveCategoryGroup, getCategoryGroupById } from '../../cache/cache-category-groups.service';
import { deleteAll } from '../../cache/cache-key.service';
import { AppDataSource } from '../../config/typeorm.datasource';
import { Category } from '../../entities/Category.entity';
import { categoryFormMatrix } from '../../policies/category-form.policy';
import { AuthRequest } from '../../types/auth-request';
import { CategoryFormMode } from '../../types/form-view-params';
import { parseBoolean } from '../../utils/bool.util';
import { parseError } from '../../utils/error.util';
import { logger } from '../../utils/logger.util';
import { validateCategory, validateDeleteCategory } from './category.validator';

/* ============================
   Obtener título según el modo del formulario
============================ */
const getTitle = (mode: string) => {
  switch (mode) {
    case 'insert': return 'Insertar Categoría'
    case 'update': return 'Editar Categoría'
    case 'delete': return 'Eliminar Categoría'
    default: return 'Indefinido'
  }
}

/* ============================
   Sanitizar payload según policy
============================ */
const sanitizeByPolicy = (mode: CategoryFormMode, body: any) => {
  const policy = categoryFormMatrix[mode]
  const clean: any = {}
  for (const field in policy) {
    if ((policy[field] === 'editable' || policy[field] === 'readonly') && body[field] !== undefined) {
      clean[field] = body[field]
    }
  }
  return clean
}

/* ============================
   Construir objeto para la vista
============================ */
const buildCategoryView = async (auth_req: AuthRequest, body: any) => {
  const category_group_id = Number(body.category_group_id)
  const category_group = await getCategoryGroupById(auth_req, category_group_id)
  return {
    ...body,
    is_active: parseBoolean(body.is_active),
    category_group,
  }
}

/* ============================
   Renderizar formulario de categoría para Insertar, Editar, Eliminar o Cambiar Estado
============================ */
export const saveCategory: RequestHandler = async (req: Request, res: Response) => {
  const start = performance.now()
  logger.info(`${saveCategory.name} called`, { body: req.body, param: req.params })
  const auth_req = req as AuthRequest
  const user_id = auth_req.user.id
  const mode: CategoryFormMode = req.body.mode || 'insert'
  const category_id = Number(req.body.id)
  const category_group_id = Number(req.body.category_group_id)
  const repo_category = AppDataSource.getRepository(Category)
  const form_state = {
    category: await buildCategoryView(auth_req, req.body),
    category_group_list: await getActiveCategoryGroup(auth_req),
    category_form_policy: categoryFormMatrix[mode],
    mode
  }
  try {
    let existing: Category | null = null
    if (category_id) {
      existing = await getCategoryById(auth_req, category_id)
      if (!existing) throw new Error('Categoría no encontrada')
    }
    /* =========================
       DELETE
    ============================ */
    if (mode === 'delete') {
      if (!existing) throw new Error('Categoría no encontrada')
      const errors = await validateDeleteCategory(auth_req, existing)
      if (errors) throw { validationErrors: errors }
      await repo_category.delete(existing.id)
      deleteAll(auth_req, 'category')
      return res.redirect('/categories')
    }
    /* =========================
       INSERT / UPDATE
    ============================ */
    let category: Category
    if (mode === 'insert') {
      const selected_group = await getCategoryGroupById(auth_req, category_group_id)
      category = repo_category.create({
        user: { id: auth_req.user.id } as any,
        type: req.body.type,
        type_for_loan: req.body.type_for_loan,
        name: req.body.name,
        category_group: selected_group,
        is_active: true
      })
    } else {
      if (!existing) throw new Error('Categoría no encontrada')
      category = existing
    }
    /*=================================
      Aplicar sanitización por policy
    =================================*/
    const clean = sanitizeByPolicy(mode, req.body)
    if (clean.name !== undefined) category.name = clean.name
    if (clean.type !== undefined) category.type = clean.type
    if (clean.type_for_loan !== undefined) { category.type_for_loan = clean.type_for_loan === '' ? null : clean.type_for_loan }
    if (clean.category_group_id !== undefined) { category.category_group = await getCategoryGroupById(auth_req, Number(clean.category_group_id)) }
    if (clean.is_active !== undefined) { category.is_active = parseBoolean(clean.is_active) }
    const errors = await validateCategory(auth_req, category)
    if (errors) throw { validationErrors: errors }
    /*=================================
      Guardar en base de datos y limpiar cache
    =================================*/
    await repo_category.save(category)
    deleteAll(auth_req, 'category')
    return res.redirect('/categories')
  } catch (error: any) {
    /* ============================
       Manejo de errores
    ============================ */
    logger.error(`${saveCategory.name}-Error. `, { user_id: auth_req.user.id, category_id, mode, error: parseError(error), })
    const validationErrors = error?.validationErrors || null
    return res.render('layouts/main', {
      title: getTitle(mode),
      view: 'pages/categories/form',
      ...form_state,
      errors: validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
    })
  } finally {
    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`${saveCategory.name}. user=[${user_id}], elapsedTime=[${duration_sec.toFixed(4)}]`)
  }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\category\category.validator.ts
```
 
```ts
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { getCategoryByName } from '../../cache/cache-categories.service'
import { getCategoryGroupById } from '../../cache/cache-category-groups.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Category } from '../../entities/Category.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validateCategory = async (auth_req: AuthRequest, category: Category): Promise<Record<string, string> | null> => {
  const category_instance = plainToInstance(Category, category)
  const errors = await validate(category_instance)
  const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}
  // Nombre único por usuario
  if (category.name) {
    const existing = await getCategoryByName(auth_req, category.name)
    if (existing && existing.id !== category.id) {
      field_errors.name = 'Ya existe una categoría con este nombre'
    }
  }
  // Validación de tipo (SIEMPRE)
  if (!category.type) {
    field_errors.type = 'El tipo es obligatorio'
  }
  // Validación de grupo (OBLIGATORIO)
  if (!category.category_group || !category.category_group.id) {
    field_errors.category_group = 'El grupo de categoría es obligatorio'
  } else {
    const category_group = await getCategoryGroupById(auth_req, category.category_group.id)
    if (!category_group) {
      field_errors.category_group = 'El grupo de categoría seleccionado no es válido'
    }
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeleteCategory = async (auth_req: AuthRequest, category: Category): Promise<Record<string, string> | null> => {
  const user_id = auth_req.user.id
  const field_errors: Record<string, string> = {}
  const tx_repo = AppDataSource.getRepository(Transaction)
  const category_repo = AppDataSource.getRepository(Category)
  // Validación: transacciones asociadas
  const tx_count = await tx_repo.count({
    where: {
      category: { id: category.id },
      user: { id: user_id }
    }
  })
  if (tx_count > 0) {
    field_errors.general = `No se puede eliminar la categoría porque tiene ${tx_count} transacción(es) asociada(s)`
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\category-group\category-group.controller.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express'
import { getCategoryGroupById } from '../../cache/cache-category-groups.service'
import { categoryGroupFormMatrix } from '../../policies/category-group-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { BaseFormViewParams } from '../../types/form-view-params'
export { saveCategoryGroup as apiForSavingCategoryGroup } from './category-group.saving'

type CategoryGroupFormViewParams = BaseFormViewParams & {
  category_group: any
}

const renderCategoryGroupForm = async (res: Response, params: CategoryGroupFormViewParams) => {
  const { title, view, category_group, errors, mode, auth_req } = params
  const category_group_form_policy = categoryGroupFormMatrix[mode]
  return res.render('layouts/main', {
    title,
    view,
    errors,
    mode,
    auth_req,
    category_group,
    category_group_form_policy,
  })
}

export const routeToFormInsertCategoryGroup: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  return renderCategoryGroupForm(res, {
    title: 'Insertar Grupo de Categoría',
    view: 'pages/category-groups/form',
    errors: {},
    mode,
    auth_req,
    category_group: {
      is_active: true
    },
  })
}

export const routeToFormUpdateCategoryGroup: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'update'
  const auth_req = req as AuthRequest
  const category_group_id = Number(req.params.id)
  const category_group = await getCategoryGroupById(auth_req, category_group_id)
  if (!category_group) {
    return res.redirect('/categories')
  }
  return renderCategoryGroupForm(res, {
    title: 'Editar Grupo de Categoría',
    view: 'pages/category-groups/form',
    errors: {},
    mode,
    auth_req,
    category_group,
  })
}

export const routeToFormDeleteCategoryGroup: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'delete'
  const auth_req = req as AuthRequest
  const category_group_id = Number(req.params.id)
  const category_group = await getCategoryGroupById(auth_req, category_group_id)
  if (!category_group) {
    return res.redirect('/categories')
  }
  return renderCategoryGroupForm(res, {
    title: 'Eliminar Grupo de Categoría',
    view: 'pages/category-groups/form',
    errors: {},
    mode,
    auth_req,
    category_group,
  })
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\category-group\category-group.saving.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express';
import { performance } from 'perf_hooks';
import { getCategoryGroupById } from '../../cache/cache-category-groups.service';
import { deleteAll } from '../../cache/cache-key.service';
import { AppDataSource } from '../../config/typeorm.datasource';
import { CategoryGroup } from '../../entities/CategoryGroups.entity';
import { categoryGroupFormMatrix } from '../../policies/category-group-form.policy';
import { AuthRequest } from '../../types/auth-request';
import { CategoryGroupFormMode } from '../../types/form-view-params';
import { parseBoolean } from '../../utils/bool.util';
import { parseError } from '../../utils/error.util';
import { logger } from '../../utils/logger.util';
import { validateCategoryGroup, validateDeleteCategoryGroup } from './category-group.validator';

/* ============================
   Obtener título según el modo del formulario
============================ */
const getTitle = (mode: string) => {
  switch (mode) {
    case 'insert': return 'Insertar Grupo de Categoría'
    case 'update': return 'Editar Grupo de Categoría'
    case 'delete': return 'Eliminar Grupo de Categoría'
    default: return 'Indefinido'
  }
}

/* ============================
   Sanitizar payload según policy
============================ */
const sanitizeByPolicy = (mode: CategoryGroupFormMode, body: any) => {
  const policy = categoryGroupFormMatrix[mode]
  const clean: any = {}
  for (const field in policy) {
    if ((policy[field] === 'editable' || policy[field] === 'readonly') && body[field] !== undefined) {
      clean[field] = body[field]
    }
  }
  return clean
}

/* ============================
   Construir objeto para la vista
============================ */
const buildCategoryGroupView = (body: any, mode: CategoryGroupFormMode) => {
  return {
    ...body,
    is_active: parseBoolean(body.is_active),
  }
}

/* ============================
   Renderizar formulario de categoría para Insertar, Editar, Eliminar o Cambiar Estado
============================ */
export const saveCategoryGroup: RequestHandler = async (req: Request, res: Response) => {
  const start = performance.now()
  logger.info(`${saveCategoryGroup.name} called`, { body: req.body, param: req.params })
  const auth_req = req as AuthRequest
  const user_id = auth_req.user.id
  const category_group_id = Number(req.body.id)
  const mode: CategoryGroupFormMode = req.body.mode || 'insert'
  const repo_category_group = AppDataSource.getRepository(CategoryGroup)
  const category_group_view = buildCategoryGroupView(req.body, mode)
  const form_state = {
    category_group: category_group_view,
    category_group_form_policy: categoryGroupFormMatrix[mode],
    mode
  }
  try {
    let existing: CategoryGroup | null = null
    if (category_group_id) {
      existing = await getCategoryGroupById(auth_req, category_group_id)
      if (!existing) throw new Error('Grupo de Categoría no encontrada')
    }
    /* =========================
       DELETE
    ============================ */
    if (mode === 'delete') {
      if (!existing) throw new Error('Grupo de Categoría no encontrada')
      const errors = await validateDeleteCategoryGroup(existing, auth_req)
      if (errors) throw { validationErrors: errors }
      await repo_category_group.delete(existing.id)
      deleteAll(auth_req, 'category_group')
      return res.redirect('/categories')
    }
    /* =========================
       INSERT / UPDATE
    ============================ */
    let category_group: CategoryGroup
    if (mode === 'insert') {
      category_group = repo_category_group.create({
        user: { id: auth_req.user.id } as any,
        name: req.body.name,
        is_active: true
      })
    } else {
      if (!existing) throw new Error('Grupo de Categoría no encontrada')
      category_group = existing
    }
    /*=================================
      Aplicar sanitización por policy
    =================================*/
    const clean = sanitizeByPolicy(mode, req.body)
    if (clean.name !== undefined) category_group.name = clean.name
    if (clean.is_active !== undefined) { category_group.is_active = parseBoolean(clean.is_active) }
    const errors = await validateCategoryGroup(category_group, auth_req)
    if (errors) throw { validationErrors: errors }
    /*=================================
      Guardar en base de datos y limpiar cache
    =================================*/
    await repo_category_group.save(category_group)
    deleteAll(auth_req, 'category_group')
    return res.redirect('/categories')
  } catch (error: any) {
    /* ============================
       Manejo de errores
    ============================ */
    logger.error(`${saveCategoryGroup.name}-Error. `, { user_id: auth_req.user.id, category_group_id, mode, error: parseError(error), })
    const validationErrors = error?.validationErrors || null
    return res.render('layouts/main', {
      title: getTitle(mode),
      view: 'pages/category-groups/form',
      ...form_state,
      errors: validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
    })
  } finally {
    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`${saveCategoryGroup.name}. user=[${user_id}], elapsedTime=[${duration_sec.toFixed(4)}]`)
  }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\category-group\category-group.validator.ts
```
 
```ts
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { getCategoryGroupByName } from '../../cache/cache-category-groups.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Category } from '../../entities/Category.entity'
import { CategoryGroup } from '../../entities/CategoryGroups.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validateCategoryGroup = async (category_group: CategoryGroup, auth_req: AuthRequest): Promise<Record<string, string> | null> => {
  const category_group_instance = plainToInstance(CategoryGroup, category_group)
  const errors = await validate(category_group_instance)
  const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}
  // Nombre único por usuario
  if (category_group.name) {
    const existing = await getCategoryGroupByName(auth_req, category_group.name)
    if (existing && existing.id !== category_group.id) {
      field_errors.name = 'Ya existe un grupo de categoría con este nombre'
    }
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeleteCategoryGroup = async (category_group: CategoryGroup, auth_req: AuthRequest): Promise<Record<string, string> | null> => {
  const user_id = auth_req.user.id
  const field_errors: Record<string, string> = {}
  const category_repo = AppDataSource.getRepository(Category)
  const categories_count = await category_repo.count({
    where: {
      category_group: { id: category_group.id },
      user: { id: user_id }
    }
  })
  if (categories_count > 0) {
    field_errors.general = `No se puede eliminar el grupo porque tiene ${categories_count} categoría(s) asociada(s)`
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\home\2fa.controller.ts
```
 
```ts
import { Request, Response } from 'express'
import { IsNull, MoreThan } from 'typeorm'
import { AppDataSource } from '../../config/typeorm.datasource'
import { AuthCode } from '../../entities/AuthCode.entity'
import { compareCode } from '../../utils/auth-code.util'
import { logger } from '../../utils/logger.util'
import { parseError } from '../../utils/error.util'

export const show2FA = (req: Request, res: Response) => {
  if (!(req.session as any)?.pending2FAUserId) {
    return res.redirect('/login')
  }

  res.render(
    'pages/2fa',
    {
      error: null
    })
}

export const verify2FA = async (req: Request, res: Response) => {
  try {
    const { code } = req.body
    const pendingUserId = (req.session as any)?.pending2FAUserId

    if (!pendingUserId) return res.redirect('/login')

    const repo = AppDataSource.getRepository(AuthCode)

    const authCode = await repo.findOne({
      where: {
        user: { id: pendingUserId },
        used_at: IsNull(),
        expires_at: MoreThan(new Date())
      },
      relations: ['user']
    })

    if (!authCode) {
      return res.render(
        'pages/2fa',
        {
          error: 'Código inválido o expirado'
        })
    }

    const isValid = await compareCode(code, authCode.code_hash)
    if (!isValid) {
      authCode.attempts += 1
      await repo.save(authCode)
      return res.render(
        'pages/2fa',
        {
          error: 'Código incorrecto'
        })
    }

    authCode.used_at = new Date()
    await repo.save(authCode)

    // preserve timezone across session regeneration (otherwise it's lost)
    const preservedTimezone = (req.session as any).timezone

    delete (req.session as any).pending2FAUserId

    req.session.regenerate(err => {
      if (err) {
        logger.error(err)
        return res.redirect('/login')
      }

      ; (req.session as any).user_id = pendingUserId
      ; (req.session as any).timezone = preservedTimezone

      req.session.save(err2 => {
        if (err2) {
          logger.error(err2)
          return res.redirect('/login')
        }

        res.redirect('/home')
      })
    })

  } catch (error: any) {
    logger.error('verify2FA error', parseError(error))
    res.render(
      'pages/2fa',
      {
        error: 'Error validando el código'
      })
  }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\home\home.auxiliar.ts
```
 
```ts
import { DateTime } from 'luxon'
import { getHomeAvailableYearsKpiCache, getHomeBalanceKpiCache, getHomeCashFlowSummaryCache, getHomeLoanFlowSummaryCache, getHomeTrendKpiCache } from '../../cache/cache-home.service'
import { AppDataSource } from "../../config/typeorm.datasource"
import { Account } from "../../entities/Account.entity"
import { Loan } from "../../entities/Payable.entity"
import { LoanPayment } from "../../entities/PayablePayment.entity"
import { Transaction } from "../../entities/Transaction.entity"
import { AuthRequest } from "../../types/auth-request"

/* ============================================================================
   Servicio: Resumen últimos 6 meses (ingresos / egresos / balance)
============================================================================ */
export const getChartDataLast6MonthsBalance = async (auth_req: AuthRequest) => {
  const user_id = auth_req.user.id
  const transaction_repo = AppDataSource.getRepository(Transaction)

  /* ============================
     Rango de fechas
  ============================ */
  const end_date = new Date()
  const start_date = new Date()
  start_date.setMonth(start_date.getMonth() - 5)
  start_date.setDate(1)

  /* ============================
     Query agregada por mes (MySQL)
  ============================ */
  const rows = await transaction_repo
    .createQueryBuilder('t')
    .select([
      "DATE_FORMAT(t.date, '%Y-%m') AS month",
      "SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) AS income",
      "SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) AS expense"
    ])
    .where('t.user_id = :user_id', { user_id })
    .andWhere('t.type IN (:...types)', { types: ['income', 'expense'] })
    .andWhere('t.date BETWEEN :start AND :end', {
      start: start_date,
      end: end_date
    })
    .groupBy("DATE_FORMAT(t.date, '%Y-%m')")
    .orderBy("DATE_FORMAT(t.date, '%Y-%m')", 'ASC')
    .getRawMany()

  /* ============================
     Normalización de meses
  ============================ */
  const labels: string[] = []
  const income: number[] = []
  const expense: number[] = []
  const balance: number[] = []

  const cursor = new Date(start_date)

  while (cursor <= end_date) {

    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    const row = rows.find(r => r.month === key)

    const inc = row ? Number(row.income) : 0
    const exp = row ? Number(row.expense) : 0

    labels.push(cursor.toLocaleString('es', { month: 'short' }))
    income.push(inc)
    expense.push(exp)
    balance.push(inc - exp)

    cursor.setMonth(cursor.getMonth() + 1)
  }

  return {
    labels,
    income,
    expense,
    balance
  }
}

/* ============================================================================
   Servicio: Resumen últimos 6 años (ingresos / egresos / balance)
============================================================================ */
export const getChartDataLast6YearsBalance = async (auth_req: AuthRequest) => {
  const user_id = auth_req.user.id
  const transaction_repo = AppDataSource.getRepository(Transaction)

  /* ============================
     Rango de fechas
  ============================ */
  const end_date = new Date()
  const start_date = new Date()
  start_date.setFullYear(start_date.getFullYear() - 5)
  start_date.setMonth(0)
  start_date.setDate(1)

  /* ============================
     Query agregada por año (MySQL)
  ============================ */
  const rows = await transaction_repo
    .createQueryBuilder('t')
    .select([
      "YEAR(t.date) AS year",
      "SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) AS income",
      "SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) AS expense"
    ])
    .where('t.user_id = :user_id', { user_id })
    .andWhere('t.type IN (:...types)', { types: ['income', 'expense'] })
    .andWhere('t.date BETWEEN :start AND :end', {
      start: start_date,
      end: end_date
    })
    .groupBy('YEAR(t.date)')
    .orderBy('YEAR(t.date)', 'ASC')
    .getRawMany()

  /* ============================
     Normalización de años
  ============================ */
  const labels: string[] = []
  const income: number[] = []
  const expense: number[] = []
  const balance: number[] = []

  const cursor = new Date(start_date)

  while (cursor <= end_date) {

    const key = cursor.getFullYear()
    const row = rows.find(r => Number(r.year) === key)

    const inc = row ? Number(row.income) : 0
    const exp = row ? Number(row.expense) : 0

    labels.push(String(key))
    income.push(inc)
    expense.push(exp)
    balance.push(inc - exp)

    cursor.setFullYear(cursor.getFullYear() + 1)
  }

  return {
    labels,
    income,
    expense,
    balance
  }
}

/* ============================================================================
   KPIs últimos 6 meses
============================================================================ */
export const getKpisLast6MonthsBalance = async (auth_req: AuthRequest) => {
  const user_id = auth_req.user.id
  const transaction_repo = AppDataSource.getRepository(Transaction)

  /* ============================
     Rango fechas
  ============================ */
  const end_date = new Date()
  const start_date = new Date()
  start_date.setMonth(start_date.getMonth() - 5)
  start_date.setDate(1)

  /* ============================
     Query agregada mensual
  ============================ */
  const rows = await transaction_repo
    .createQueryBuilder('t')
    .select([
      "DATE_FORMAT(t.date, '%Y-%m') AS month",
      "SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) AS income",
      "SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) AS expense"
    ])
    .where('t.user_id = :user_id', { user_id })
    .andWhere('t.type IN (:...types)', { types: ['income', 'expense'] })
    .andWhere('t.date BETWEEN :start AND :end', {
      start: start_date,
      end: end_date
    })
    .groupBy("DATE_FORMAT(t.date, '%Y-%m')")
    .orderBy("DATE_FORMAT(t.date, '%Y-%m')", 'ASC')
    .getRawMany()

  /* ============================
     Normalización
  ============================ */
  const income: number[] = []
  const expense: number[] = []

  const cursor = new Date(start_date)

  while (cursor <= end_date) {

    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    const row = rows.find(r => r.month === key)

    income.push(row ? Number(row.income) : 0)
    expense.push(row ? Number(row.expense) : 0)

    cursor.setMonth(cursor.getMonth() + 1)
  }

  /* ============================
     KPIs
  ============================ */
  const total_income = income.reduce((a, b) => a + b, 0)
  const total_expense = expense.reduce((a, b) => a + b, 0)
  const balance = total_income - total_expense
  const avg_expense = total_expense / income.length

  const last_balance = income[income.length - 1] - expense[expense.length - 1]
  const prevBalance = income[income.length - 2] - expense[expense.length - 2]
  const trend = last_balance - prevBalance

  return {
    total_income,
    total_expense,
    balance,
    avg_expense,
    trend
  }
}

/* ============================================================================
   Servicio: Resumen anual de préstamos (total prestado, pagado, intereses, saldo)
============================================================================ */
export const getChartDataLast6YearsLoan = async (auth_req: AuthRequest) => {
  const user_id = auth_req.user.id
  const loan_repo = AppDataSource.getRepository(Loan)
  const payment_repo = AppDataSource.getRepository(LoanPayment)
  const last_years = 5

  /* ============================
     Determinar años a consultar
  ============================ */
  const current_year = new Date().getFullYear()
  const years = Array.from({ length: last_years }, (_, i) => current_year - (last_years - 1 - i))

  /* ============================
     Total prestado y saldo por año
  ============================ */
  const loan_rows = await loan_repo
    .createQueryBuilder('l')
    .select([
      "YEAR(l.start_date) AS year",
      "SUM(l.total_amount) AS total_loan",
      "SUM(l.balance) AS balance"
    ])
    .where("l.user_id = :user_id", { user_id })
    .andWhere("l.is_active = 1")
    .groupBy("YEAR(l.start_date)")
    .orderBy("YEAR(l.start_date)", "ASC")
    .getRawMany<{ year: string, total_loan: string, balance: string }>()

  /* ============================
     Total pagado e intereses por año
  ============================ */
  const payment_rows = await payment_repo
    .createQueryBuilder('p')
    .innerJoin('p.loan', 'l')
    .select([
      "YEAR(l.start_date) AS year",
      "SUM(p.principal_paid) AS total_paid",
      "SUM(p.interest_paid) AS total_interest"
    ])
    .where("l.user_id = :user_id", { user_id })
    .andWhere("l.is_active = 1")
    .groupBy("YEAR(l.start_date)")
    .orderBy("YEAR(l.start_date)", "ASC")
    .getRawMany<{ year: string, total_paid: string, total_interest: string }>()

  /* ============================
     Normalización: asegurar todos los años
  ============================ */
  const labels: string[] = []
  const total_loan: number[] = []
  const total_paid: number[] = []
  const total_interest: number[] = []
  const balance: number[] = []

  years.forEach(y => {
    const loanRow = loan_rows.find(r => Number(r.year) === y)
    const payRow = payment_rows.find(r => Number(r.year) === y)

    labels.push(String(y))
    total_loan.push(loanRow ? Number(loanRow.total_loan) : 0)
    balance.push(loanRow ? Number(loanRow.balance) : 0)
    total_paid.push(payRow ? Number(payRow.total_paid) : 0)
    total_interest.push(payRow ? Number(payRow.total_interest) : 0)
  })

  return {
    labels,
    total_loan,
    total_paid,
    total_interest,
    balance
  }
}

/* ============================================================================
   KPIs globales (solo Transactions + Accounts)
============================================================================ */
export const getKpisGlobalBalance = async (auth_req: AuthRequest) => {
  const user_id = auth_req.user.id
  const transaction_repo = AppDataSource.getRepository(Transaction)
  const account_repo = AppDataSource.getRepository(Account)

  /* ============================
     Ingresos y egresos
  ============================ */
  const income_expense = await transaction_repo
    .createQueryBuilder('t')
    .select([
      "SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) AS income",
      "SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) AS expense"
    ])
    .where('t.user_id = :user_id', { user_id })
    .getRawOne()

  const total_income = Number(income_expense?.income || 0)
  const total_expense = Number(income_expense?.expense || 0)

  /* ============================
     Ahorros y retiros (TRANSFER)
     ahorro  = entra a saving
     retiro  = sale de saving
  ============================ */
  const savings_data = await transaction_repo
    .createQueryBuilder('t')
    .innerJoin('t.account', 'fromAcc')
    .leftJoin('t.to_account', 'toAcc')
    .select([
      "SUM(CASE WHEN t.type = 'transfer' AND toAcc.type = 'saving' THEN t.amount ELSE 0 END) AS savings",
      "SUM(CASE WHEN t.type = 'transfer' AND fromAcc.type = 'saving' THEN t.amount ELSE 0 END) AS withdrawals"
    ])
    .where('t.user_id = :user_id', { user_id })
    .getRawOne()

  const total_savings = Number(savings_data?.savings || 0)
  const total_withdrawals = Number(savings_data?.withdrawals || 0)

  /* ============================
     Cuentas activas
  ============================ */
  const accounts = await account_repo.find({
    where: { user: { id: user_id }, is_active: true }
  })

  const net_worth = accounts.reduce(
    (sum, acc) => sum + Number(acc.balance),
    0
  )

  const available_savings = accounts
    .filter(a => a.type === 'saving')
    .reduce((sum, a) => sum + Number(a.balance), 0)

  /* ============================
     KPIs finales (7)
  ============================ */
  const net_balance = net_worth - available_savings

  const loan_repo = AppDataSource.getRepository(Loan)

  /* ============================
     KPIs Préstamos
  ============================ */
  const loan_data = await loan_repo
    .createQueryBuilder('l')
    .select([
      "SUM(l.total_amount) AS total_loan",
      "SUM(l.principal_paid) AS total_principal_paid",
      "SUM(l.interest_paid) AS total_interest_paid",
      "SUM(l.balance) AS total_loan_balance"
    ])
    .where('l.user_id = :user_id', { user_id })
    .getRawOne()

  const total_loan = Number(loan_data?.total_loan || 0)
  const total_principal_paid = Number(loan_data?.total_principal_paid || 0)
  const total_interest_paid = Number(loan_data?.total_interest_paid || 0)
  const total_loan_balance = Number(loan_data?.total_loan_balance || 0)

  return {
    total_income,
    total_expense,
    total_savings,
    total_withdrawals,
    net_worth,
    available_savings,
    net_balance,
    total_loan,
    total_principal_paid,
    total_interest_paid,
    total_loan_balance
  }
}

export const getKpisLastYearBalance = async (auth_req: AuthRequest) => {
  const user_id = auth_req.user.id
  const timezone = auth_req.timezone ?? 'UTC'
  const transaction_repo = AppDataSource.getRepository(Transaction)
  const account_repo = AppDataSource.getRepository(Account)
  const loan_repo = AppDataSource.getRepository(Loan)

  const fromDateUTC = DateTime.now()
    .setZone(timezone)
    .minus({ months: 12 })
    .toUTC()
    .toJSDate()

  /* ============================
     Ingresos y egresos
  ============================ */
  const income_expense = await transaction_repo
    .createQueryBuilder('t')
    .select([
      "SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) AS income",
      "SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) AS expense"
    ])
    .where('t.user_id = :user_id', { user_id })
    .andWhere('t.created_at >= :fromDate', { fromDate: fromDateUTC })
    .getRawOne()

  const total_income = Number(income_expense?.income || 0)
  const total_expense = Number(income_expense?.expense || 0)

  /* ============================
     Ahorros y retiros
  ============================ */
  const savings_data = await transaction_repo
    .createQueryBuilder('t')
    .innerJoin('t.account', 'fromAcc')
    .leftJoin('t.to_account', 'toAcc')
    .select([
      "SUM(CASE WHEN t.type = 'transfer' AND toAcc.type = 'saving' THEN t.amount ELSE 0 END) AS savings",
      "SUM(CASE WHEN t.type = 'transfer' AND fromAcc.type = 'saving' THEN t.amount ELSE 0 END) AS withdrawals"
    ])
    .where('t.user_id = :user_id', { user_id })
    .andWhere('t.created_at >= :fromDate', { fromDate: fromDateUTC })
    .getRawOne()

  const total_savings = Number(savings_data?.savings || 0)
  const total_withdrawals = Number(savings_data?.withdrawals || 0)

  /* ============================
     Cuentas activas (balance actual)
  ============================ */
  const accounts = await account_repo.find({
    where: { user: { id: user_id }, is_active: true }
  })

  const net_worth = accounts.reduce((sum, acc) => sum + Number(acc.balance), 0)
  const available_savings = accounts.filter(a => a.type === 'saving').reduce((sum, a) => sum + Number(a.balance), 0)
  const net_balance = net_worth - available_savings

  /* ============================
     Préstamos
  ============================ */
  const loan_data = await loan_repo
    .createQueryBuilder('l')
    .select([
      "SUM(l.total_amount) AS total_loan",
      "SUM(l.principal_paid) AS total_principal_paid",
      "SUM(l.interest_paid) AS total_interest_paid",
      "SUM(l.balance) AS total_loan_balance"
    ])
    .where('l.user_id = :user_id', { user_id })
    .andWhere('l.created_at >= :fromDate', { fromDate: fromDateUTC })
    .getRawOne()

  const total_loan = Number(loan_data?.total_loan || 0)
  const total_principal_paid = Number(loan_data?.total_principal_paid || 0)
  const total_interest_paid = Number(loan_data?.total_interest_paid || 0)
  const total_loan_balance = Number(loan_data?.total_loan_balance || 0)

  return {
    total_income,
    total_expense,
    total_savings,
    total_withdrawals,
    net_worth,
    available_savings,
    net_balance,
    total_loan,
    total_principal_paid,
    total_interest_paid,
    total_loan_balance
  }
}


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/* ============================================================================
   Obtener todos los años disponibles
============================================================================ */
export const getAvailableYearsKpi = async (auth_req: AuthRequest): Promise<number[]> => {
  const years = await getHomeAvailableYearsKpiCache(auth_req)
  return years
}

export const getBalanceKpi = async (auth_req: AuthRequest) => {
  const rows = await getHomeBalanceKpiCache(auth_req)
  return rows
}

export const getTrendKpi = async (auth_req: AuthRequest) => {
  const rows = await getHomeTrendKpiCache(auth_req)
  return rows
}

export const getCashSummary = async (auth_req: AuthRequest) => {
  const rows = await getHomeCashFlowSummaryCache(auth_req)
  return rows
}

export const getLoanSummary = async (auth_req: AuthRequest) => {
  const rows = await getHomeLoanFlowSummaryCache(auth_req)
  return rows
}


 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\home\home.controller.ts
```
 
```ts
import bcrypt from 'bcryptjs'
import { Request, RequestHandler, Response } from 'express'
import { deleteAll } from '../../cache/cache-key.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { User } from '../../entities/User.entity'
import { send2FACode } from '../../services/send-2fa.service'
import { AuthRequest } from '../../types/auth-request'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'
import { getAvailableYearsKpi, getBalanceKpi, getCashSummary, getChartDataLast6MonthsBalance, getChartDataLast6YearsBalance, getChartDataLast6YearsLoan, getKpisGlobalBalance, getKpisLast6MonthsBalance, getLoanSummary, getTrendKpi } from './home.auxiliar'

export const routeToPageRoot = (req: Request, res: Response) => {
  if ((req.session as any)?.user_id) {
    return res.redirect('/home')
  }
  res.redirect('/login')
}

export const routeToPageLogin = (req: Request, res: Response) => {
  res.render('pages/login', { error: null })
}

export const routeToPageHome = async (req: Request, res: Response) => {
  const skip_login = process.env.NODE_SKIP_LOGIN === 'true'
  const user_id = skip_login ? 1 : (req.session as any)?.user_id
  if (!user_id) {
    return res.redirect('/login')
  }
  const user_repo = AppDataSource.getRepository(User)
  const user = await user_repo.findOneBy({ id: user_id })
  if (!user) {
    return res.redirect('/login')
  }
  res.render(
    'layouts/main',
    {
      title: 'Inicio',
      view: 'pages/home',
      USER_ID: user?.id || 'guest',
      user,
    })
}

export const apiForValidatingLogin = async (req: Request, res: Response) => {
  try {
    const selected_fields: (keyof User)[] = ['id', 'email', 'password_hash', 'name', 'created_at']
    const timezone = String(req.body.timezone || 'UTC')
    /* ============================
       Modo Skip Login (Desarrollo)
       Si existe la variable de entorno NODE_SKIP_LOGIN=true, se omite la validación de usuario y contraseña.
       Se busca un usuario de desarrollo por ID (definido en DEV_USER_ID) y se inicia sesión con ese usuario.
       Esto permite a los desarrolladores saltarse el proceso de login durante el desarrollo.
    ============================ */
    if (process.env.NODE_SKIP_LOGIN === 'true') {
      const user_repo = AppDataSource.getRepository(User)
      const dev_user = await user_repo.findOne({
        where: { id: Number(process.env.DEV_USER_ID) || 1 },
        select: selected_fields
      })
      if (dev_user) {
        (req.session as any).user_id = dev_user.id;
        (req.session as any).timezone = timezone
        return res.redirect('/home')
      }
    }
    /* ============================
       Login Produccion
    ============================ */
    const { username, password } = req.body
    const user_repo = AppDataSource.getRepository(User)
    const user = await user_repo.findOne({
      where: { name: username },
      select: selected_fields
    })
    if (!user) {
      return res.render('pages/login', { error: 'Usuario no encontrado' })
    }
    const valid_password = await bcrypt.compare(password, user.password_hash)
    if (!valid_password) {
      return res.render('pages/login', { error: 'Contraseña incorrecta' })
    }
    /* ============================
       Guardar timezone en sesión
    ============================ */
    (req.session as any).timezone = timezone
    /* ============================
       Enviar código 2FA y guardar usuario pendiente
    ============================ */
    await send2FACode(user);
    (req.session as any).pending2FAUserId = user.id
    /* ============================
       Persistir sesión
    ============================ */
    await new Promise<void>((resolve, reject) => {
      req.session.save(err => {
        if (err) reject(err)
        else resolve()
      })
    })
    return res.redirect('/2fa')
  } catch (error: any) {
    logger.error(`${apiForValidatingLogin.name}-Error.`, parseError(error))
    return res.render('pages/login', { error: 'Error interno, intenta de nuevo' })
  } finally {
  }
}

export const apiForGettingKpis: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  try {
    const availableYearsKpi = await getAvailableYearsKpi(auth_req)
    const balanceKpi = await getBalanceKpi(auth_req)
    const trendKpi = await getTrendKpi(auth_req)
    res.json({
      availableYearsKpi,
      balanceKpi,
      trendKpi,
    })
  } catch (error) {
    logger.error('Error en apiForGettingKpis:', parseError(error))
    res.json({ message: 'Error' })
  }
}

export const apiForGettingCashSummary: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  try {
    const availableYearsKpi = await getAvailableYearsKpi(auth_req)
    const cashSummary = await getCashSummary(auth_req)
    res.json({
      availableYearsKpi,
      cashSummary,
    })
  } catch (error) {
    logger.error('Error en apiForGettingCashSummary:', parseError(error))
    res.json({ message: 'Error' })
  }
}

export const apiForGettingLoanSummary: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  try {
    const availableYearsKpi = await getAvailableYearsKpi(auth_req)
    const loanSummary = await getLoanSummary(auth_req)
    res.json({
      availableYearsKpi,
      loanSummary,
    })
  } catch (error) {
    logger.error('Error en apiForGettingLoanSummary:', parseError(error))
    res.json({ message: 'Error' })
  }
}

export const apiForLogout: RequestHandler = async (req: Request, res: Response) => {
  try {
    req.session.destroy(err => {
      if (err) {
        logger.error('Error destroying session:', err)
        return res.redirect('/home')
      }

      deleteAll(req as AuthRequest, 'home')
      res.clearCookie('connect.sid')
      return res.redirect('/login')
    })
  } catch (error) {
    logger.error('Logout error:', parseError(error))
    return res.redirect('/login')
  }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\loan\loan.controller.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express'
import { getActiveAccounts } from '../../cache/cache-accounts.service'
import { getLoanById, getLoansForApi } from '../../cache/cache-loans.service'
import { loanFormMatrix } from '../../policies/loan-form.policy'
import { getNextValidTransactionDate } from '../../services/next-valid-trx-date.service'
import { getActiveCategoriesForLoansByUser, getActiveParentLoansByUser } from '../../services/populate-items.service'
import { AuthRequest } from "../../types/auth-request"
import { BaseFormViewParams } from '../../types/form-view-params'
import { formatDateForInputLocal } from '../../utils/date.util'
import { logger } from "../../utils/logger.util"
import { parseError } from '../../utils/error.util'
export { saveLoan as apiForSavingLoan } from './loan.saving'

type LoanFormViewParams = BaseFormViewParams & {
  loan: any
}

const renderLoanForm = async (res: Response, params: LoanFormViewParams) => {
  const { title, view, loan, errors, mode, auth_req } = params
  const loan_form_policy = loanFormMatrix[mode]
  const disbursement_account_list = await getActiveAccounts(auth_req)
  const loan_group_list = await getActiveParentLoansByUser(auth_req)
  const active_income_category_list = await getActiveCategoriesForLoansByUser(auth_req)
  const category_id = auth_req.query.category_id || null
  const from = auth_req.query.from || null
  return res.render('layouts/main', {
    title,
    view,
    errors,
    mode,
    auth_req,
    loan,
    loan_form_policy,
    disbursement_account_list,
    active_income_category_list,
    loan_group_list,
    context: { category_id, from },
  })
}

export const routeToPageLoan: RequestHandler = (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  res.render(
    'layouts/main', {
    title: 'Préstamos',
    view: 'pages/loans/index',
    disbursement_account: [],
    USER_ID: auth_req.user?.id || 'guest'
  })
}

export const routeToFormInsertLoan: RequestHandler = async (req, res) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const default_date = await getNextValidTransactionDate(auth_req)
  return renderLoanForm(res, {
    title: 'Insertar Préstamo',
    view: 'pages/loans/form',
    errors: {},
    auth_req,
    mode,
    loan: {
      start_date: formatDateForInputLocal(default_date, timezone),
      total_amount: '0.00',
      transaction: null,
      disbursement_account: null,
      category: null,
      loan_group: null,
      is_active: true,
    },
  })
}

export const routeToFormUpdateLoan: RequestHandler = async (req, res) => {
  const mode = 'update'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const loan_id = Number(req.params.id)
  const loan = await getLoanById(auth_req, loan_id)
  if (!loan) {
    return res.redirect('/loans')
  }
  return renderLoanForm(res, {
    title: 'Editar Préstamo',
    view: 'pages/loans/form',
    errors: {},
    mode,
    auth_req,
    loan: {
      ...loan,
      start_date: formatDateForInputLocal(loan.start_date, timezone),
    },
  })
}

export const routeToFormCloneLoan: RequestHandler = async (req, res) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const loan_id = Number(req.params.id)
  const loan = await getLoanById(auth_req, loan_id)
  if (!loan) {
    return res.redirect('/loans')
  }
  const default_date = await getNextValidTransactionDate(auth_req)
  return renderLoanForm(res, {
    title: 'Insertar Préstamo',
    view: 'pages/loans/form',
    errors: {},
    mode,
    auth_req,
    loan: {
      ...loan,
      start_date: formatDateForInputLocal(default_date, timezone),
    },
  })
}

export const routeToFormDeleteLoan: RequestHandler = async (req, res) => {
  const mode = 'delete'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'
  const loan_id = Number(req.params.id)
  const loan = await getLoanById(auth_req, loan_id)
  if (!loan) {
    return res.redirect('/loans')
  }
  return renderLoanForm(res, {
    title: 'Eliminar Préstamo',
    view: 'pages/loans/form',
    errors: {},
    mode,
    auth_req,
    loan: {
      ...loan,
      start_date: formatDateForInputLocal(loan.start_date, timezone),
    },
  })
}

/*=================================================
Api para devolver el DTO Loan en JSON
==================================================*/
export const apiForGettingLoans: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  try {
    const result = await getLoansForApi(auth_req)
    res.json(result)
  } catch (error) {
    logger.error(`${apiForGettingLoans.name}-Error. `, parseError(error))
    res.status(500).json({ error: 'Error al listar préstamos' })
  } finally {
  }
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\loan\loan.saving.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express';
import { DateTime } from 'luxon';
import { performance } from 'perf_hooks';
import { getAccountById, getActiveAccountsForDisbursement } from '../../cache/cache-accounts.service';
import { getActiveIncomeCategories, getCategoryById } from '../../cache/cache-categories.service';
import { deleteAll } from '../../cache/cache-key.service';
import { getActiveLoanGroup, getLoanGroupById } from '../../cache/cache-loan-groups.service';
import { getLoanById } from '../../cache/cache-loans.service';
import { AppDataSource } from '../../config/typeorm.datasource';
import { Account } from '../../entities/Account.entity';
import { Category } from '../../entities/Category.entity';
import { Loan } from '../../entities/Payable.entity';
import { Transaction } from '../../entities/Transaction.entity';
import { loanFormMatrix } from '../../policies/loan-form.policy';
import { KpiCacheService } from '../../services/kpi-cache.service';
import { AuthRequest } from '../../types/auth-request';
import { LoanFormMode } from '../../types/form-view-params';
import { parseBoolean } from '../../utils/bool.util';
import { parseLocalDateToUTC } from '../../utils/date.util';
import { parseError } from '../../utils/error.util';
import { logger } from '../../utils/logger.util';
import { validateDeleteLoan, validateLoan } from './loan.validator';

/* ============================
   Obtener título según el modo del formulario
============================ */
const getTitle = (mode: string) => {
  switch (mode) {
    case 'insert': return 'Insertar Préstamo'
    case 'update': return 'Editar Préstamo'
    case 'delete': return 'Eliminar Préstamo'
    default: return 'Indefinido'
  }
}

/* ============================
   Sanitizar payload según policy
============================ */
const sanitizeByPolicy = (mode: LoanFormMode, body: any) => {
  const policy = loanFormMatrix[mode]
  const clean: any = {}
  for (const field in policy) {
    if ((policy[field] === 'editable' || policy[field] === 'readonly') && body[field] !== undefined) {
      clean[field] = body[field]
    }
  }
  return clean
}

/* ============================
   Construir objeto para la vista
============================ */
const buildLoanView = async (auth_req: AuthRequest, body: any) => {
  const loan_group_id = Number(body.loan_group_id)
  const disbursement_id = Number(body.disbursement_account_id)
  const category_id = Number(body.category_id)
  const loan_group = await getLoanGroupById(auth_req, loan_group_id)
  const disbursement = await getAccountById(auth_req, disbursement_id)
  const category = await getCategoryById(auth_req, category_id)

  return {
    ...body,
    is_active: parseBoolean(body.is_active),
    loan_group,
    disbursement,
    category
  }
}

/* ============================
    Obtener cuentas activas del usuario para mostrar en el formulario 
============================ */
export const saveLoan: RequestHandler = async (req: Request, res: Response) => {
  const start = performance.now()
  logger.info(`${saveLoan.name} called`, { body: req.body, param: req.params })
  const auth_req = req as AuthRequest
  const user_id = auth_req.user.id
  const mode: LoanFormMode = req.body.mode || 'insert'
  const timezone = auth_req.timezone || 'UTC'
  const loan_id = Number(req.body.id)
  const loan_group_id = Number(req.body.loan_group_id)
  const disbursement_id = Number(req.body.disbursement_account_id)
  const category_id = Number(req.body.category_id)
  const return_from = req.body.return_from
  const return_category_id = Number(req.body.return_category_id) || null

  const form_state = {
    loan: await buildLoanView(auth_req, req.body),
    loan_group_list: await getActiveLoanGroup(auth_req),
    disbursement_account_list: await getActiveAccountsForDisbursement(auth_req),
    active_income_category_list: await getActiveIncomeCategories(auth_req),
    loan_form_policy: loanFormMatrix[mode],
    mode,
    context: { from: return_from, category_id: return_category_id }
  }

  const queryRunner = AppDataSource.createQueryRunner()
  await queryRunner.connect()
  await queryRunner.startTransaction()

  try {
    let existing: Loan | null = null
    if (loan_id) {
      existing = await getLoanById(auth_req, loan_id)
      if (!existing) throw new Error('Préstamo no encontrado')
    }
    /* =========================
       DELETE
    ============================ */
    if (mode === 'delete') {
      if (!existing) throw new Error('Préstamo no encontrado')
      const errors = await validateDeleteLoan(auth_req, existing)
      if (errors) throw { validationErrors: errors }
      if (existing.disbursement_account) {
        const account = await getAccountById(auth_req, disbursement_id)
        if (!account) throw new Error('Cuenta de desembolso no encontrado')
        account.balance -= existing.total_amount
        await queryRunner.manager.save(account)
      }
      const transaction_id = existing.transaction?.id || null
      await queryRunner.manager.delete(Loan, existing.id)
      if (transaction_id) {
        await queryRunner.manager.delete(Transaction, transaction_id)
      }
      await queryRunner.commitTransaction()
      deleteAll(auth_req, 'loan')

      KpiCacheService
        .recalculateBalanceKPIByTransaction(auth_req, existing)
        .catch(error => logger.error(`${saveLoan.name}-Error recalculando KPI Balances`, parseError(error)))

      KpiCacheService
        .recalculateCategoryKPIByTransaction(auth_req, existing)
        .catch(error => logger.error(`${saveLoan.name}-Error recalculando KPI Categorías`, parseError(error)))

      if (return_from === 'categories' && return_category_id) {
        return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
      }
      return res.redirect('/loans')
    }
    /* =========================
       INSERT / UPDATE
    ============================ */
    let loan: Loan
    if (mode === 'insert') {
      const loan_group = await getLoanGroupById(auth_req, loan_group_id)
      const disbursement = await getAccountById(auth_req, disbursement_id)
      const category = await getCategoryById(auth_req, category_id)
      loan = queryRunner.manager.create(Loan, {
        user: { id: auth_req.user.id } as any,
        name: req.body.name,
        note: req.body.note,
        total_amount: 0,
        interest_paid: 0,
        balance: 0,
        start_date: parseLocalDateToUTC(req.body.start_date, timezone),
        loan_group: loan_group,
        disbursement_account: disbursement,
        category: category,
        is_active: true
      })
    } else {
      if (!existing) throw new Error('Préstamo no encontrado')
      loan = existing
    }
    /*=================================
      Aplicar sanitización por policy
    =================================*/
    const clean = sanitizeByPolicy(mode, req.body)
    if (clean.name !== undefined) loan.name = clean.name
    if (clean.start_date !== undefined) loan.start_date = parseLocalDateToUTC(clean.start_date, timezone)
    if (clean.is_active !== undefined) loan.is_active = parseBoolean(clean.is_active)
    if (clean.note !== undefined) loan.note = clean.note
    if (clean.loan_group_id !== undefined) { loan.loan_group = await getLoanGroupById(auth_req, loan_group_id) }
    if (clean.disbursement_account_id !== undefined) { loan.disbursement_account = await getAccountById(auth_req, disbursement_id) }
    if (clean.category_id !== undefined) { loan.category = await getCategoryById(auth_req, category_id) }
    let new_account: Account | null = loan.disbursement_account || null
    let new_category: Category | null = loan.category || null
    let previous_amount = loan.total_amount
    let previous_balance = loan.balance
    if (clean.total_amount !== undefined) {
      const new_amount = Number(clean.total_amount)
      if (mode === 'insert') {
        loan.total_amount = new_amount
        loan.balance = new_amount
      } else {
        const paidAmount = previous_amount - previous_balance
        loan.total_amount = new_amount
        loan.balance = new_amount - paidAmount
      }
    }
    if (loan.balance === 0) {
      loan.is_active = false
    } else {
      loan.is_active = true
    }
    if (mode === 'insert') {
      if (!new_account) throw { code: 'DISBURSEMENT_REQUIRED' }
      if (!new_category) { throw { code: 'CATEGORY_NOT_FOUND' } }
      new_account.balance += loan.total_amount
      await queryRunner.manager.save(new_account)
      loan.disbursement_account = new_account
      loan.category = new_category
      const transaction = queryRunner.manager.create(Transaction, {
        user: { id: auth_req.user.id } as any,
        type: 'income',
        detailed_type: 'income_for_loan',
        amount: loan.total_amount,
        account: new_account,
        category: new_category,
        date: loan.start_date,
        description: loan.note || loan.name
      })
      await queryRunner.manager.save(transaction)
      loan.transaction = transaction
    } else {
      if (!loan.disbursement_account) { throw { code: 'DISBURSEMENT_NOT_FOUND' } }
      if (!new_account) throw { code: 'DISBURSEMENT_REQUIRED' }
      if (!new_category) { throw { code: 'CATEGORY_NOT_FOUND' } }
      const old_account = await getAccountById(auth_req, loan.disbursement_account.id)
      if (!old_account) throw { code: 'DISBURSEMENT_REQUIRED' }
      if (old_account.id === new_account.id) {
        const delta = loan.total_amount - previous_amount
        old_account.balance += delta
        await queryRunner.manager.save(old_account)
      } else {
        old_account.balance -= previous_amount
        new_account.balance += loan.total_amount
        await queryRunner.manager.save([old_account, new_account])
      }
      loan.disbursement_account = new_account
      if (loan.transaction?.id) {
        loan.transaction.amount = loan.total_amount
        loan.transaction.date = loan.start_date
        loan.transaction.description = loan.note || loan.name
        loan.transaction.account = new_account
        loan.transaction.category = new_category
        await queryRunner.manager.save(loan.transaction)
      }
    }
    const errors = await validateLoan(auth_req, loan)
    if (errors) throw { validationErrors: errors }
    /*=================================
      Guardar en base de datos y limpiar cache
    =================================*/
    await queryRunner.manager.save(loan)
    await queryRunner.commitTransaction()

    deleteAll(auth_req, 'loan')
    if (loan.transaction) {
      KpiCacheService
        .recalculateBalanceKPIByTransaction(auth_req, loan.transaction)        
        .catch(error => logger.error(`${saveLoan.name}-Error recalculando KPI Balance`, parseError(error)))

      KpiCacheService
        .recalculateCategoryKPIByTransaction(auth_req, loan.transaction)
        .catch(error => logger.error(`${saveLoan.name}-Error recalculando KPI Categorías`, parseError(error)))
    }

    if (return_from === 'categories' && return_category_id) {
      return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
    }
    return res.redirect('/loans')
  } catch (error: any) {
    /* ============================
       Manejo de errores
    ============================ */
    await queryRunner.rollbackTransaction()
    logger.error(`${saveLoan.name}-Error. `, { user_id: auth_req.user.id, loan_id, mode, error: parseError(error), })

    let validationErrors: Record<string, string> | null = null
    switch (error?.code) {
      case 'DISBURSEMENT_REQUIRED':
        validationErrors = { disbursement_account: 'Cuenta de desembolso requerida' }
        break
      case 'DISBURSEMENT_NOT_FOUND':
        validationErrors = { disbursement_account: 'Cuenta de desembolso actual no encontrada' }
        break
      case 'CATEGORY_NOT_FOUND':
        validationErrors = { category: 'Categoría seleccionada no encontrada' }
        break
      default:
        validationErrors = error?.validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
    }
    return res.render('layouts/main', {
      title: getTitle(mode),
      view: 'pages/loans/form',
      ...form_state,
      errors: validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
    })
  } finally {
    await queryRunner.release()
    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`${saveLoan.name}. user=[${user_id}], elapsedTime=[${duration_sec.toFixed(4)}]`)
  }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\loan\loan.validator.ts
```
 
```ts
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { getActiveAccountById } from '../../cache/cache-accounts.service'
import { getActiveCategoryById } from '../../cache/cache-categories.service'
import { getActiveLoanGroupById } from '../../cache/cache-loan-groups.service'
import { getLoanById, getLoanByName } from '../../cache/cache-loans.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Loan } from '../../entities/Payable.entity'
import { LoanPayment } from '../../entities/PayablePayment.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validateLoan = async (auth_req: AuthRequest, loan: Loan): Promise<Record<string, string> | null> => {
  const user_id = auth_req.user.id
  const loan_instance = plainToInstance(Loan, loan)
  const errors = await validate(loan_instance)
  const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}
  // Validaciones class-validator
  const payment_repo = AppDataSource.getRepository(LoanPayment)
  // Nombre único por usuario
  if (loan.name && user_id) {
    const existing_by_name = await getLoanByName(auth_req, loan.name)
    if (existing_by_name && existing_by_name.id !== loan.id) field_errors.name = 'Ya existe un préstamo con este nombre'
  }
  // Monto total obligatorio y > 0
  if (loan.total_amount === undefined || loan.total_amount === null || Number(loan.total_amount) <= 0) {
    field_errors.total_amount = 'El monto total del préstamo debe ser mayor a cero'
  }
  // Cuenta de desembolso obligatoria
  if (!loan.disbursement_account || !loan.disbursement_account.id) {
    field_errors.disbursement_account = 'Debe seleccionar una cuenta de desembolso'
  } else {
    const account = await getActiveAccountById(auth_req, loan.disbursement_account.id)
    if (!account) field_errors.disbursement_account = 'La cuenta de desembolso no es válida o no pertenece al usuario'
  }
  // Validación categoría
  if (loan.category && loan.category.id) {
    const category = await getActiveCategoryById(auth_req, loan.category.id)
    if (!category) field_errors.category = 'La categoría no es válida o no pertenece al usuario'
  }
  // Grupo de préstamo obligatorio
  if (!loan.loan_group || !loan.loan_group.id) {
    field_errors.loan_group = 'Debe seleccionar un grupo de préstamo'
  } else {
    const loan_group = await getActiveLoanGroupById(auth_req, loan.loan_group.id)
    if (!loan_group) field_errors.loan_group = 'El grupo de préstamo no es válido o no pertenece al usuario'
  }
  // Validaciones solo en edición
  if (loan.id) {
    const existing_loan = await getLoanById(auth_req, loan.id)
    if (!existing_loan) {
      field_errors.general = 'Préstamo no encontrado o no pertenece al usuario'
    } else {
      const payments = await payment_repo.find({ where: { loan: { id: loan.id } } })
      const totalPrincipalPaidCents = payments.reduce((sum, p) => sum + Math.round(Number(p.principal_paid) * 100), 0)
      const totalAmountCents = loan.total_amount !== undefined ? Math.round(Number(loan.total_amount) * 100) : 0
      // Validación modificación monto
      if (loan.total_amount !== undefined && Number(existing_loan.total_amount) !== Number(loan.total_amount)) {
        if (payments.length > 0) {
          if (!auth_req.role?.can_update_amount_loan) {
            field_errors.total_amount = 'No se puede modificar el monto total de un préstamo con pagos registrados'
          }
        } else {
          const now = new Date()
          const loan_date = new Date(existing_loan.start_date)
          const same_month = loan_date.getFullYear() === now.getFullYear() && loan_date.getMonth() === now.getMonth()
          if (!same_month) {
            if (!auth_req.role?.can_update_amount_loan) {
              field_errors.total_amount = 'No se puede modificar el monto de un préstamo de meses anteriores'
            }
          }
        }
      }
      // Validación cambio start_date
      if (payments.length > 0 && loan.start_date) {
        const normalizeToMinute = (date: Date | string) => {
          const d = new Date(date)
          d.setSeconds(0, 0)
          return d.getTime()
        }
        const existing_time = normalizeToMinute(existing_loan.start_date)
        const new_time = normalizeToMinute(loan.start_date)
        if (existing_time !== new_time) {
          if (!auth_req.role?.can_update_start_date_loan) {
            field_errors.start_date = 'No se puede modificar la fecha de inicio de un préstamo con pagos registrados'
          }
        }
      }
      // Validación capital pagado
      if (loan.total_amount !== undefined && totalAmountCents < totalPrincipalPaidCents) {
        field_errors.total_amount = 'El monto total no puede ser menor al capital ya pagado'
      }
      // No permitir cambiar usuario
      if (loan.user && loan.user.id !== existing_loan.user.id) {
        field_errors.user = 'No se puede cambiar el usuario del préstamo'
      }
      // No permitir cambiar cuenta si hay pagos
      if (payments.length > 0) {
        const newAccId = loan.disbursement_account?.id || null
        const oldAccId = existing_loan.disbursement_account?.id || null
        if (newAccId !== oldAccId) {
          field_errors.disbursement_account = 'No se puede cambiar la cuenta de desembolso de un préstamo con pagos registrados'
        }
      }
    }
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeleteLoan = async (auth_req: AuthRequest, loan: Loan): Promise<Record<string, string> | null> => {
  const field_errors: Record<string, string> = {}
  const loanPaymentRepo = AppDataSource.getRepository(LoanPayment)
  const paymentsCount = await loanPaymentRepo.count({
    where: { loan: { id: loan.id } }
  })
  if (paymentsCount > 0) field_errors.general = 'No se puede eliminar un préstamo con pagos registrados'
  return Object.keys(field_errors).length > 0 ? field_errors : null
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\loan-group\loan-group.controller.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express'
import { getLoanGroupById } from '../../cache/cache-loan-groups.service'
import { loanGroupFormMatrix } from '../../policies/loan-group-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { BaseFormViewParams } from '../../types/form-view-params'
export { saveLoanGroup as apiForSavingLoanGroup } from './loan-group.saving'

type LoanGroupFormViewParams = BaseFormViewParams & {
    loan_group: any
}

const renderLoanGroupForm = async (res: Response, params: LoanGroupFormViewParams) => {
    const { title, view, loan_group, errors, mode, auth_req } = params
    const loan_group_form_policy = loanGroupFormMatrix[mode]
    return res.render('layouts/main', {
        title,
        view,
        errors,
        mode,
        auth_req,
        loan_group,
        loan_group_form_policy,
    })
}

export const routeToFormInsertLoanGroup: RequestHandler = async (req: Request, res: Response) => {
    const mode = 'insert'
    const auth_req = req as AuthRequest
    return renderLoanGroupForm(res, {
        title: 'Insertar Grupo de Préstamos',
        view: 'pages/loan-groups/form',
        errors: {},
        mode,
        auth_req,
        loan_group: {
            is_active: true
        },
    })
}

export const routeToFormUpdateLoanGroup: RequestHandler = async (req: Request, res: Response) => {
    const mode = 'update'
    const auth_req = req as AuthRequest
    const loan_group_id = Number(req.params.id)
    const loan_group = await getLoanGroupById(auth_req, loan_group_id)
    if (!loan_group) {
        return res.redirect('/loans')
    }
    return renderLoanGroupForm(res, {
        title: 'Editar Grupo de Préstamos',
        view: 'pages/loan-groups/form',
        errors: {},
        mode,
        auth_req,
        loan_group
    })
}

export const routeToFormDeleteLoanGroup: RequestHandler = async (req: Request, res: Response) => {
    const mode = 'delete'
    const auth_req = req as AuthRequest
    const loan_group_id = Number(req.params.id)
    const loan_group = await getLoanGroupById(auth_req, loan_group_id)
    if (!loan_group) {
        return res.redirect('/loans')
    }
    return renderLoanGroupForm(res, {
        title: 'Eliminar Grupo de Préstamos',
        view: 'pages/loan-groups/form',
        errors: {},
        mode,
        auth_req,
        loan_group
    })
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\loan-group\loan-group.saving.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express'
import { performance } from 'perf_hooks';
import { deleteAll } from '../../cache/cache-key.service'
import { getLoanGroupById } from '../../cache/cache-loan-groups.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { LoanGroup } from '../../entities/PayableGroup.entity'
import { loanGroupFormMatrix } from '../../policies/loan-group-form.policy'
import { AuthRequest } from '../../types/auth-request'
import { LoanGroupFormMode } from '../../types/form-view-params'
import { parseBoolean } from '../../utils/bool.util'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'
import { validateDeleteLoanGroup, validateLoanGroup } from './loan-group.validator'

/* ============================
   Obtener título según el modo del formulario
============================ */
const getTitle = (mode: string) => {
    switch (mode) {
        case 'insert': return 'Insertar Grupo de Préstamos'
        case 'update': return 'Editar Grupo de Préstamos'
        case 'delete': return 'Eliminar Grupo de Préstamos'
        default: return 'Indefinido'
    }
}

/* ============================
   Sanitizar payload según policy
============================ */
const sanitizeByPolicy = (mode: LoanGroupFormMode, body: any) => {
    const policy = loanGroupFormMatrix[mode]
    const clean: any = {}
    for (const field in policy) {
        if ((policy[field] === 'editable' || policy[field] === 'readonly') && body[field] !== undefined) {
            clean[field] = body[field]
        }
    }
    return clean
}

/* ============================
   Construir objeto para la vista
============================ */
const buildLoanGroupView = (body: any, mode: LoanGroupFormMode) => {
    return {
        ...body,
        is_active: parseBoolean(body.is_active),
    }
}

/* ============================
   Renderizar formulario de categoría para Insertar, Editar, Eliminar o Cambiar Estado
============================ */
export const saveLoanGroup: RequestHandler = async (req: Request, res: Response) => {
    const start = performance.now()
    logger.info(`${saveLoanGroup.name} called`, { body: req.body, param: req.params })
    const auth_req = req as AuthRequest
    const user_id = auth_req.user.id
    const loan_group_id = Number(req.body.id)
    const mode: LoanGroupFormMode = req.body.mode || 'insert'
    const repo_loan_group = AppDataSource.getRepository(LoanGroup)
    const loan_group_view = buildLoanGroupView(req.body, mode)
    const form_state = {
        loan_group: loan_group_view,
        loan_group_form_policy: loanGroupFormMatrix[mode],
        mode
    }
    try {
        let existing: LoanGroup | null = null
        if (loan_group_id) {
            existing = await getLoanGroupById(auth_req, loan_group_id)
            if (!existing) throw new Error('Grupo de Préstamos no encontrada')
        }
        /* =========================
           DELETE
        ============================ */
        if (mode === 'delete') {
            if (!existing) throw new Error('Grupo de Préstamos no encontrada')
            const errors = await validateDeleteLoanGroup(auth_req, existing)
            if (errors) throw { validationErrors: errors }
            await repo_loan_group.delete(existing.id)
            deleteAll(auth_req, 'loan_group')
            return res.redirect('/loans')
        }
        /* =========================
           INSERT / UPDATE
        ============================ */
        let loan_group: LoanGroup
        if (mode === 'insert') {
            loan_group = repo_loan_group.create({
                user: { id: auth_req.user.id } as any,
                name: req.body.name,
                is_active: true
            })
        } else {
            if (!existing) throw new Error('Grupo de Préstamos no encontrada')
            loan_group = existing
        }
        /*=================================
          Aplicar sanitización por policy
        =================================*/
        const clean = sanitizeByPolicy(mode, req.body)

        if (clean.name !== undefined) loan_group.name = clean.name
        if (clean.is_active !== undefined) { loan_group.is_active = parseBoolean(clean.is_active) }
        const errors = await validateLoanGroup(auth_req, loan_group)
        if (errors) throw { validationErrors: errors }
        /*=================================
        Guardar en base de datos y limpiar cache
        =================================*/
        await repo_loan_group.save(loan_group)
        deleteAll(auth_req, 'loan_group')
        return res.redirect('/loans')
    } catch (error: any) {
        /* ============================
           Manejo de errores
        ============================ */
        logger.error(`${saveLoanGroup.name}-Error. `, { user_id: auth_req.user.id, loan_group_id: loan_group_id, mode, error: parseError(error), })
        const validationErrors = error?.validationErrors || null
        return res.render('layouts/main', {
            title: getTitle(mode),
            view: 'pages/loan-groups/form',
            ...form_state,
            errors: validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
        })
    } finally {
        const end = performance.now()
        const duration_sec = (end - start) / 1000
        logger.debug(`${saveLoanGroup.name}. user=[${user_id}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\loan-group\loan-group.validator.ts
```
 
```ts
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { getLoanGroupByName } from '../../cache/cache-loan-groups.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Loan } from '../../entities/Payable.entity'
import { LoanGroup } from '../../entities/PayableGroup.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validateLoanGroup = async (auth_req: AuthRequest, loan_group: LoanGroup): Promise<Record<string, string> | null> => {
  const loan_group_instance = plainToInstance(LoanGroup, loan_group)
  const errors = await validate(loan_group_instance)
  const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}
  // Nombre único por usuario
  if (loan_group.name) {
    const existing = await getLoanGroupByName(auth_req, loan_group.name)
    if (existing && existing.id !== loan_group.id) {
      field_errors.name = 'Ya existe un grupo de préstamos con este nombre'
    }
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeleteLoanGroup = async (auth_req: AuthRequest, loan_group: LoanGroup): Promise<Record<string, string> | null> => {
  const user_id = auth_req.user.id
  const field_errors: Record<string, string> = {}
  const loan_repo = AppDataSource.getRepository(Loan)
  const loans_count = await loan_repo.count({
    where: {
      loan_group: { id: loan_group.id },
      user: { id: user_id }
    }
  })
  if (loans_count > 0) {
    field_errors.general = `No se puede eliminar el grupo porque tiene ${loans_count} préstamo(s) asociado(s)`
  }
  return Object.keys(field_errors).length > 0 ? field_errors : null
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\loan-payment\loan-payment.controller.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express'
import { getActiveAccounts } from '../../cache/cache-accounts.service'
import { getLoanById } from '../../cache/cache-loans.service'
import { getPaymentById, getPaymentsForApi } from '../../cache/cache-loan-payments.service'
import { AppDataSource } from "../../config/typeorm.datasource"
import { LoanPayment } from '../../entities/PayablePayment.entity'
import { paymentFormMatrix } from '../../policies/loan-payment-form.policy'
import { getNextValidTransactionDate } from '../../services/next-valid-trx-date.service'
import { getActiveCategoriesForPaymentsByUser } from '../../services/populate-items.service'
import { AuthRequest } from "../../types/auth-request"
import { BaseFormViewParams } from '../../types/form-view-params'
import { formatDateForInputLocal } from '../../utils/date.util'
import { parseError } from '../../utils/error.util'
import { logger } from "../../utils/logger.util"
export { savePayment as apiForSavingAccount } from './loan-payment.saving'

type PaymentFormViewParams = BaseFormViewParams & {
    payment: any
}

const renderPaymentForm = async (res: Response, params: PaymentFormViewParams) => {
    const { title, view, payment, errors, mode, auth_req } = params
    const payment_form_policy = paymentFormMatrix[mode]
    const active_expense_category_list = await getActiveCategoriesForPaymentsByUser(auth_req)
    const account_list = await getActiveAccounts(auth_req)
    const loan_id = auth_req.params.loan_id || payment.loan?.id || null
    const category_id = auth_req.query.category_id || null
    const from = auth_req.query.from || null
    return res.render('layouts/main', {
        title,
        view,
        errors,
        mode,
        auth_req,
        payment,
        payment_form_policy,
        active_expense_category_list,
        account_list,
        loan_id,
        context: { category_id, from }
    })
}

export const routeToPagePayment: RequestHandler = async (req, res) => {
    const auth_req = req as AuthRequest
    const loan_id = Number(req.params.id)
    const loan = await getLoanById(auth_req, loan_id)
    if (!loan) {
        return res.redirect('/loans')
    }
    res.render('layouts/main', {
        title: 'Pagos',
        view: 'pages/loan-payments/index',
        USER_ID: auth_req.user?.id || 'guest',
        LOAN_ID: loan_id,
        loan
    })
}

export const routeToFormInsertPayment: RequestHandler = async (req, res) => {
    const mode = 'insert'
    const auth_req = req as AuthRequest
    const timezone = auth_req.timezone || 'UTC'
    const default_date = await getNextValidTransactionDate(auth_req)
    return renderPaymentForm(res, {
        title: 'Insertar Pago',
        view: 'pages/loan-payments/form',
        errors: {},
        auth_req,
        mode,
        payment: {
            payment_date: formatDateForInputLocal(default_date, timezone),
            note: '',
            principal_paid: '0.00',
            interest_paid: '0.00',
            category: null,
            account: null,
        },
    })
}

export const routeToFormUpdatePayment: RequestHandler = async (req, res) => {
    const mode = 'update'
    const auth_req = req as AuthRequest
    const timezone = auth_req.timezone || 'UTC'
    const payment_id = Number(req.params.id)
    const payment = await getPaymentById(auth_req, payment_id)
    if (!payment) {
        return res.redirect('/payments')
    }
    return renderPaymentForm(res, {
        title: 'Editar Pago',
        view: 'pages/loan-payments/form',
        errors: {},
        mode,
        auth_req,
        payment: {
            ...payment,
            payment_date: formatDateForInputLocal(payment.payment_date, timezone)
        }
    })
}

export const routeToFormClonePayment: RequestHandler = async (req, res) => {
    const mode = 'insert'
    const auth_req = req as AuthRequest
    const timezone = auth_req.timezone || 'UTC'
    const payment_id = Number(req.params.id)
    const payment = await getPaymentById(auth_req, payment_id)
    if (!payment) {
        return res.redirect('/payments')
    }
    const default_date = await getNextValidTransactionDate(auth_req)
    return renderPaymentForm(res, {
        title: 'Insertar Pago',
        view: 'pages/loan-payments/form',
        errors: {},
        mode,
        auth_req,
        payment: {
            ...payment,
            payment_date: formatDateForInputLocal(default_date, timezone)
        }
    })
}

export const routeToFormDeletePayment: RequestHandler = async (req, res) => {
    const mode = 'delete'
    const auth_req = req as AuthRequest
    const timezone = auth_req.timezone || 'UTC'
    const payment_id = Number(req.params.id)
    const payment = await getPaymentById(auth_req, payment_id)
    if (!payment) {
        return res.redirect('/payments')
    }
    return renderPaymentForm(res, {
        title: 'Eliminar Pago',
        view: 'pages/loan-payments/form',
        errors: {},
        mode,
        auth_req,
        payment: {
            ...payment,
            payment_date: formatDateForInputLocal(payment.payment_date, timezone)
        }
    })
}

/*=================================================
Api para devolver el DTO Loan en JSON
==================================================*/
export const apiForGettingPayments: RequestHandler = async (req: Request, res: Response) => {
    const auth_req = req as AuthRequest
    const loan_id = Number(req.params.loan_id)
    try {
        const payments = await getPaymentsForApi(auth_req, loan_id)
        res.json(payments)
    } catch (error) {
        logger.error(`${apiForGettingPayments.name}-Error. `, parseError(error))
        res.status(500).json({ error: 'Error al listar pagos' })
    } finally {
    }
}


 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\loan-payment\loan-payment.saving.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express';
import { DateTime } from 'luxon';
import { performance } from 'perf_hooks';
import { getAccountById, getActiveAccounts } from '../../cache/cache-accounts.service';
import { getCategoryById } from '../../cache/cache-categories.service';
import { deleteAll } from '../../cache/cache-key.service';
import { getLoanById } from '../../cache/cache-loans.service';
import { getPaymentById } from '../../cache/cache-loan-payments.service';
import { AppDataSource } from '../../config/typeorm.datasource';
import { Account } from '../../entities/Account.entity';
import { Loan } from '../../entities/Payable.entity';
import { LoanPayment } from '../../entities/PayablePayment.entity';
import { Transaction } from '../../entities/Transaction.entity';
import { paymentFormMatrix } from '../../policies/loan-payment-form.policy';
import { KpiCacheService } from '../../services/kpi-cache.service';
import { getNextPaymentNumber } from '../../services/loan-payment-number.service';
import { getActiveCategoriesForPaymentsByUser } from '../../services/populate-items.service';
import { AuthRequest } from '../../types/auth-request';
import { PaymentFormMode } from '../../types/form-view-params';
import { parseBoolean } from '../../utils/bool.util';
import { parseLocalDateToUTC } from '../../utils/date.util';
import { parseError } from '../../utils/error.util';
import { logger } from '../../utils/logger.util';
import { validateDeletePayment, validateSavePayment } from './loan-payment.validator';

/* ============================
   Helpers
============================ */
const getTotal = (p: LoanPayment) => p.principal_paid + p.interest_paid

const applyLoanDelta = (loan: Loan, old_principal: number, new_principal: number) => {
    const delta = new_principal - old_principal
    loan.balance -= delta
}

const applyPrincipalDelta = (loan: Loan, old_principal: number, new_principal: number) => {
    const delta = new_principal - old_principal
    loan.principal_paid += delta
}

const applyInterestDelta = (loan: Loan, old_interest: number, new_interest: number) => {
    const delta = new_interest - old_interest
    loan.interest_paid += delta
}

const applyAccountDelta = (account: Account, old_total: number, new_total: number) => {
    const delta = new_total - old_total
    account.balance -= delta
}

/* ============================
   Obtener título según el modo del formulario
============================ */
const getTitle = (mode: string) => {
    switch (mode) {
        case 'insert': return 'Registrar Pago'
        case 'update': return 'Editar Pago'
        case 'delete': return 'Eliminar Pago'
        default: return 'Indefinido'
    }
}

/* ============================
   Sanitizar payload según policy
============================ */

const sanitizeByPolicy = (mode: PaymentFormMode, body: any) => {
    const policy = paymentFormMatrix[mode]
    const clean: any = {}

    for (const field in policy) {
        if ((policy[field] === 'editable' || policy[field] === 'readonly') && body[field] !== undefined) {
            clean[field] = body[field]
        }
    }
    return clean
}

/* ============================
   Construir objeto para la vista
============================ */
const buildPaymentView = async (auth_req: AuthRequest, body: any) => {
    const account_id = Number(body.account_id)
    const category_id = Number(body.category_id)
    const account = await getAccountById(auth_req, account_id)
    const category = await getCategoryById(auth_req, category_id)

    return {
        ...body,
        is_active: parseBoolean(body.is_active),
        account,
        category,
    }
}

/* ============================
   Controller
============================ */
export const savePayment: RequestHandler = async (req: Request, res: Response) => {
    const start = performance.now()
    logger.info(`${savePayment.name} called`, { body: req.body, param: req.params })
    const auth_req = req as AuthRequest
    const user_id = auth_req.user.id
    const timezone = auth_req.timezone || 'UTC'
    const payment_id = Number(req.body.id)
    const loan_id = Number(req.body.loan_id)
    const mode: PaymentFormMode = req.body.mode || 'insert'
    const return_from = req.body.return_from
    const return_category_id = Number(req.body.return_category_id) || null

    const form_state = {
        payment: await buildPaymentView(auth_req, req.body),
        loan_id,
        account_list: await getActiveAccounts(auth_req),
        active_expense_category_list: await getActiveCategoriesForPaymentsByUser(auth_req),
        payment_form_policy: paymentFormMatrix[mode],
        mode,
        context: { from: return_from || null, category_id: return_category_id || null }
    }

    const queryRunner = AppDataSource.createQueryRunner()
    await queryRunner.connect()
    await queryRunner.startTransaction()

    try {
        if (!loan_id) throw new Error('Préstamo es requerido')

        const loanRepo = queryRunner.manager.getRepository(Loan)
        const paymentRepo = queryRunner.manager.getRepository(LoanPayment)
        const transactionRepo = queryRunner.manager.getRepository(Transaction)
        const accountRepo = queryRunner.manager.getRepository(Account)

        const loan = await getLoanById(auth_req, loan_id)
        if (!loan) throw new Error('Prestamo no encontrado')

        let existing: LoanPayment | null = null
        if (payment_id) {
            existing = await getPaymentById(auth_req, payment_id)
            if (!existing) throw new Error('Pago no encontrado')
        }
        /* =========================
           DELETE
        ============================ */
        if (mode === 'delete') {
            if (!existing) throw new Error('Pago no encontrado')
            const errors = await validateDeletePayment(auth_req, existing)
            if (errors) throw { validationErrors: errors }
            const total = getTotal(existing)
            loan.balance += existing.principal_paid
            loan.principal_paid -= existing.principal_paid
            loan.interest_paid -= existing.interest_paid
            if (loan.balance > 0) loan.is_active = true
            await loanRepo.save(loan)
            existing.account.balance += total
            await accountRepo.save(existing.account)
            await paymentRepo.delete(existing.id)

            if (existing.transaction) {
                await transactionRepo.delete(existing.transaction.id)
            }
            await queryRunner.commitTransaction()
            deleteAll(auth_req, 'payment')

            KpiCacheService
                .recalculateBalanceKPIByTransaction(auth_req, existing.transaction)
                .catch(error => logger.error(`${savePayment.name}-Error recalculando KPI Balance`, parseError(error)))

            KpiCacheService
                .recalculateCategoryKPIByTransaction(auth_req, existing.transaction)
                .catch(error => logger.error(`${savePayment.name}-Error recalculando KPI Categorías`, parseError(error)))

                if (return_from === 'categories' && return_category_id) {
                return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
            }
            return res.redirect(`/payments/${loan_id}/loan`)
        }
        /* =========================
           INSERT / UPDATE
        ============================ */
        const clean = sanitizeByPolicy(mode, req.body)

        const account_id = Number(clean.account_id)
        const account = await getAccountById(auth_req, account_id)
        if (!account) throw new Error('Cuenta es requerida')

        const category_id = Number(clean.category_id)
        const category = await getCategoryById(auth_req, category_id)
        if (!category) throw new Error('Categoría es requerida')

        let payment: LoanPayment
        let old_payment: LoanPayment | null = null
        let old_principal = 0
        let old_total = 0

        if (mode === 'insert') {
            const principal_paid = Number(clean.principal_paid || 0)
            const payment_number = principal_paid > 0 ? await getNextPaymentNumber(loan_id) : 0

            payment = paymentRepo.create({
                loan,
                account,
                category,
                payment_number,
                principal_paid: Number(clean.principal_paid || 0),
                interest_paid: Number(clean.interest_paid || 0),
                note: clean.note || '',
                payment_date: parseLocalDateToUTC(clean.payment_date, timezone)
            })
        } else {
            if (!existing) throw new Error('Pago no encontrado')
            old_payment = structuredClone(existing)
            old_principal = existing.principal_paid
            old_total = getTotal(existing)
            payment = existing
            if (clean.note !== undefined) payment.note = clean.note
            if (clean.principal_paid !== undefined) payment.principal_paid = Number(clean.principal_paid)
            if (clean.interest_paid !== undefined) payment.interest_paid = Number(clean.interest_paid)
            if (clean.payment_date !== undefined) payment.payment_date = parseLocalDateToUTC(clean.payment_date, timezone)
            payment.account = account
            payment.category = category
        }

        const errors = await validateSavePayment(auth_req, payment, old_payment)
        if (errors) throw { validationErrors: errors }

        /* =========================
           UPDATE LOAN
        ============================ */
        if (!old_payment) {
            loan.balance -= payment.principal_paid
            loan.principal_paid += payment.principal_paid
            loan.interest_paid += payment.interest_paid
        } else {
            applyLoanDelta(loan, old_principal, payment.principal_paid)
            applyPrincipalDelta(loan, old_principal, payment.principal_paid)
            applyInterestDelta(loan, old_payment.interest_paid, payment.interest_paid)
        }
        if (loan.balance <= 0) {
            loan.balance = 0
            loan.is_active = false
        } else {
            loan.is_active = true
        }
        await loanRepo.save(loan)

        /* =========================
           UPDATE ACCOUNT
        ============================ */
        const new_total = getTotal(payment)
        if (!old_payment) {
            account.balance -= new_total
        } else {
            applyAccountDelta(account, old_total, new_total)
        }
        await accountRepo.save(account)

        /* =========================
           TRANSACTION
        ============================ */
        let trx: Transaction
        if (old_payment?.transaction?.id) {
            trx = old_payment.transaction
            trx.amount = new_total
            trx.account = account
            trx.category = payment.category
            trx.date = payment.payment_date
            trx.description = payment.note
            trx.detailed_type = 'payment_for_loan'
        } else {
            trx = transactionRepo.create({
                user: { id: auth_req.user.id } as any,
                type: 'expense',
                detailed_type: 'payment_for_loan',
                amount: new_total,
                account,
                category: payment.category,
                date: payment.payment_date,
                description: payment.note
            })
        }

        await transactionRepo.save(trx)
        payment.transaction = trx
        await paymentRepo.save(payment)
        await queryRunner.commitTransaction()
        deleteAll(auth_req, 'payment')

        KpiCacheService
            .recalculateBalanceKPIByTransaction(auth_req, trx)
            .catch(error => logger.error(`${savePayment.name}-Error recalculando KPI Balance`, parseError(error)))

        KpiCacheService
            .recalculateCategoryKPIByTransaction(auth_req, trx)
            .catch(error => logger.error(`${savePayment.name}-Error recalculando KPI Categorías`, parseError(error)))

            if (return_from === 'categories' && return_category_id) {
            return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
        }
        return res.redirect(`/payments/${loan_id}/loan`)
    } catch (error: any) {
        /* ============================
            Manejo de errores
        ============================ */
        await queryRunner.rollbackTransaction()
        logger.error(`${savePayment.name}-Error.`, { user_id: auth_req.user.id, payment_id, loan_id, mode, error: parseError(error), })

        const validationErrors = error?.validationErrors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.' }
        return res.render('layouts/main', {
            title: getTitle(mode),
            view: 'pages/loan-payments/form',
            ...form_state,
            errors: validationErrors
        })
    } finally {
        await queryRunner.release()
        const end = performance.now()
        const duration_sec = (end - start) / 1000
        logger.debug(`${savePayment.name}. user=[${user_id}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    }
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\loan-payment\loan-payment.validator.ts
```
 
```ts
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { getActiveCategoryById } from '../../cache/cache-categories.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { LoanPayment } from '../../entities/PayablePayment.entity'
import { AuthRequest } from '../../types/auth-request'
import { mapValidationErrors } from '../../validators/map-errors.validator'

export const validateSavePayment = async (auth_req: AuthRequest, payment: LoanPayment, old_payment: LoanPayment | null): Promise<Record<string, string> | null> => {
    const payment_instance = plainToInstance(LoanPayment, payment)
    const errors = await validate(payment_instance)
    const field_errors = errors.length > 0 ? mapValidationErrors(errors) : {}

    const payment_repo = AppDataSource.getRepository(LoanPayment)
    // Validación monto principal
    let available_amount = payment.loan.balance
    if (old_payment) available_amount += old_payment.principal_paid
    if (payment.principal_paid > available_amount) {
        field_errors.principal_paid = 'El monto del capital supera el saldo pendiente del préstamo'
    }
    const total_payment = payment.principal_paid + payment.interest_paid
    if (total_payment <= 0) {
        field_errors.general = 'El monto total del pago (capital + intereses) debe ser mayor a cero'
    }
    // Detectar cambios contables
    let financial_change = false
    if (old_payment) {
        const principal_changed = payment.principal_paid !== old_payment.principal_paid
        const interest_changed = payment.interest_paid !== old_payment.interest_paid
        const new_date = payment.payment_date.getTime()
        const old_date = new Date(old_payment.payment_date).getTime()
        const date_changed = new_date !== old_date
        financial_change = principal_changed || interest_changed || date_changed
    }
    if (old_payment && financial_change) {
        const now = new Date()
        const payment_date = new Date(old_payment.payment_date)
        const same_month = payment_date.getFullYear() === now.getFullYear() && payment_date.getMonth() === now.getMonth()
        if (!same_month) {
            if (!auth_req.role?.can_update_date_payment) {
                field_errors.general = 'No se pueden modificar monto o fecha de pagos de meses anteriores'
            }
        }
    }
    // Validación categoría
    if (payment.category && payment.category.id) {
        const category = await getActiveCategoryById(auth_req, payment.category.id)
        if (!category) {
            field_errors.category = 'La categoría seleccionada no es válida'
        }
    }
    // Validación fecha del pago
    const last_payment = await payment_repo.findOne({ where: { loan: { id: payment.loan.id } }, order: { payment_date: 'DESC', id: 'DESC' } })
    if (last_payment && (!old_payment || last_payment.id !== old_payment.id) && payment.payment_date.getTime() < last_payment.payment_date.getTime()) {
        if (!auth_req.role?.can_update_date_payment) {
            field_errors.payment_date = 'La fecha del pago no puede ser anterior al último pago registrado'
        }
    }
    return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeletePayment = async (auth_req: AuthRequest, payment: LoanPayment): Promise<Record<string, string> | null> => {
    const field_errors: Record<string, string> = {}
    const now = new Date()
    const payment_date = new Date(payment.payment_date)
    // Validación mismo mes
    const same_month = payment_date.getFullYear() === now.getFullYear() && payment_date.getMonth() === now.getMonth()
    if (!same_month) {
        if (!auth_req.role?.can_update_date_payment) {
            field_errors.general = 'Solo se pueden eliminar pagos del mes en curso'
        }
    }
    // Validación último pago
    const payment_repo = AppDataSource.getRepository(LoanPayment)
    const last_payment = await payment_repo.findOne({
        where: { loan: { id: payment.loan.id } },
        order: { payment_date: 'DESC', id: 'DESC' }
    })
    if (!last_payment || last_payment.id !== payment.id) {
        field_errors.general = 'Solo se puede eliminar el último pago registrado del préstamo'
    }
    return Object.keys(field_errors).length > 0 ? field_errors : null
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\transaction\batch-categorize.controller.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express';
import { In } from 'typeorm';
import { getActiveExpenseCategories, getActiveIncomeCategories } from '../../cache/cache-categories.service';
import { AppDataSource } from '../../config/typeorm.datasource';
import { Category } from '../../entities/Category.entity';
import { Transaction } from '../../entities/Transaction.entity';
import { AuthRequest } from '../../types/auth-request';
import { logger } from '../../utils/logger.util';
import { parseError } from '../../utils/error.util';
import { deleteAll } from '../../cache/cache-key.service';

export const apiForGettingCategorizeTransactions: RequestHandler = async (req: Request, res: Response) => {
    const auth_req = req as AuthRequest;
    const ids_raw = String(req.query.ids || '');
    const ids = ids_raw.split(',').map(id => Number(id)).filter(id => Number.isInteger(id) && id > 0);
    const return_from = req.query.from as string | undefined
    const return_category_id = req.query.category_id ? Number(req.query.category_id) : null

    if (!ids.length) { return res.redirect('/transactions') }

    const active_income_categories = await getActiveIncomeCategories(auth_req)
    const active_expense_categories = await getActiveExpenseCategories(auth_req)

    const repo_transaction = AppDataSource.getRepository(Transaction);
    const transactions = await repo_transaction.find({
        where: {
            id: In(ids),
            type: In(['income', 'expense']),
            user: { id: auth_req.user.id }
        },
        relations: {
            category: true, loan: true, loan_payment: true
        },
        select: {
            id: true, type: true, amount: true, date: true, description: true,
            category: {
                id: true, name: true
            }
        }
    })

    const has_income = transactions.some(t => t.type === 'income')
    const has_expense = transactions.some(t => t.type === 'expense')

    res.render(
        'layouts/main',
        {
            title: 'Categorizar Transacciones',
            view: 'pages/transactions/batch-categorize',
            active_income_categories,
            active_expense_categories,
            transactions,
            has_income,
            has_expense,
            USER_ID: auth_req.user?.id || 'guest',
            context: {
                from: return_from || null,
                category_id: return_category_id || null
            },
        }
    )
}

export const apiForBatchCategorize: RequestHandler = async (req: Request, res: Response) => {
    const auth_req = req as AuthRequest
    const user_id = auth_req.user.id
    const return_from = req.body.return_from
    const return_category_id = req.body.return_category_id ? Number(req.body.return_category_id) : null

    try {
        const { income_category_id, expense_category_id, income_ids = '[]', expense_ids = '[]' } = req.body

        // Parse JSON strings to arrays
        const income_ids_arr = typeof income_ids === 'string' ? JSON.parse(income_ids) : income_ids
        const expense_ids_arr = typeof expense_ids === 'string' ? JSON.parse(expense_ids) : expense_ids

        const all_ids = [...income_ids_arr, ...expense_ids_arr]
        if (!all_ids.length) {
            throw new Error('No se proporcionaron transacciones para categorizar')
        }

        /* ============================================================
        1. Re-cargar categorías activas (para re-render en caso error)
        ============================================================ */
        /*const active_categories = await getActiveCategoriesByUser(auth_req)
        const { active_income_categories, active_expense_categories } = splitCategoriesByType(active_categories)*/

        const active_income_categories = await getActiveIncomeCategories(auth_req)
        const active_expense_categories = await getActiveExpenseCategories(auth_req)

        /* ============================================================
        2. Re-cargar transacciones seleccionadas
        ============================================================ */
        const repo_transaction = AppDataSource.getRepository(Transaction)

        const transactions = await repo_transaction.find({
            where: { id: In(all_ids), type: In(['income', 'expense']), user: { id: user_id } },
            relations: { category: true },
            select: { id: true, type: true, amount: true, date: true, description: true, category: { id: true, name: true } }
        })

        const has_income = transactions.some(t => t.type === 'income')
        const has_expense = transactions.some(t => t.type === 'expense')

        /* ============================================================
        3. Validaciones de consistencia
        ============================================================ */
        if (income_ids_arr.length && !income_category_id) {
            throw new Error('Debe seleccionar categoría de ingresos')
        }

        if (expense_ids_arr.length && !expense_category_id) {
            throw new Error('Debe seleccionar categoría de gastos')
        }

        /* ============================================================
        4. Validar categorías pertenezcan al usuario
        ============================================================ */
        const categoryRepo = AppDataSource.getRepository(Category)

        if (income_category_id) {
            const incomeCategory = await categoryRepo.findOne({
                where: { id: income_category_id, user: { id: user_id } }
            })

            if (!incomeCategory) {
                throw new Error('Categoría de ingresos inválida')
            }
        }

        if (expense_category_id) {
            const expenseCategory = await categoryRepo.findOne({
                where: { id: expense_category_id, user: { id: user_id } }
            })

            if (!expenseCategory) {
                throw new Error('Categoría de gastos inválida')
            }
        }

        /* ============================================================
        5. Procesar actualización (SOLO category)
        ============================================================ */
        await AppDataSource.transaction(async manager => {
            if (income_ids_arr.length) {
                await manager
                    .createQueryBuilder()
                    .update(Transaction)
                    .set({ category: income_category_id })
                    .where('id IN (:...ids)', { ids: income_ids_arr })
                    .andWhere('user.id = :user_id', { user_id })
                    .andWhere('type = :type', { type: 'income' })
                    .execute()
            }


            if (expense_ids_arr.length) {
                await manager
                    .createQueryBuilder()
                    .update(Transaction)
                    .set({ category: expense_category_id })
                    .where('id IN (:...ids)', { ids: expense_ids_arr })
                    .andWhere('user.id = :user_id', { user_id })
                    .andWhere('type = :type', { type: 'expense' })
                    .execute()
            }

        })

        deleteAll(auth_req, 'transaction')
        /* ============================================================
        6. Redirigir si todo correcto
        ============================================================ */
        if (return_from === 'categories' && return_category_id) {
            return res.redirect(
                `/transactions?category_id=${return_category_id}&from=categories&saved_batch=true`
            )
        }
        return res.redirect('/transactions?saved_batch=true')

    } catch (error) {
        logger.error(`${apiForBatchCategorize.name} - Error`, parseError(error))

        const active_income_categories = await getActiveIncomeCategories(auth_req)
        const active_expense_categories = await getActiveExpenseCategories(auth_req)

        return res.status(500).render('layouts/main', {
            title: 'Categorizar Transacciones',
            view: 'pages/transactions/batch-categorize',
            active_income_categories,
            active_expense_categories,
            transactions: [],
            has_income: false,
            has_expense: false,
            errors: { general: 'Error interno del servidor' },
            USER_ID: auth_req.user?.id
        })
    }

}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\transaction\transaction.auxiliar.ts
```
 
```ts
import { AppDataSource } from '../../config/typeorm.datasource'
import { Category } from '../../entities/Category.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/auth-request'
import { DateTime } from 'luxon'

type SplitCategoriesResult = {
  active_income_categories: Category[]
  active_expense_categories: Category[]
}

export const splitCategoriesByType = (categories: Category[]): SplitCategoriesResult => {
  const active_income_categories: Category[] = []
  const active_expense_categories: Category[] = []

  categories.forEach(category => {
    if (category.type === 'income') {
      active_income_categories.push(category)
    }

    if (category.type === 'expense') {
      active_expense_categories.push(category)
    }
  })

  return {
    active_income_categories,
    active_expense_categories
  }
}

export const calculateTransactionDeltas = (transaction: Transaction, factor: 1 | -1): Map<number, number> => {
  const deltas = new Map<number, number>()
  const amount = Number(transaction.amount)

  const addDelta = (accountId?: number, value?: number) => {
    if (!accountId || !value) return
    const prev = deltas.get(accountId) || 0
    deltas.set(accountId, prev + value)
  }

  if (transaction.type === 'income' && transaction.account?.id) {
    addDelta(transaction.account.id, amount * factor)
  }

  if (transaction.type === 'expense' && transaction.account?.id) {
    addDelta(transaction.account.id, -amount * factor)
  }

  if (transaction.type === 'transfer') {
    if (transaction.account?.id) {
      addDelta(transaction.account.id, -amount * factor)
    }
    if (transaction.to_account?.id) {
      addDelta(transaction.to_account.id, amount * factor)
    }
  }
  return deltas
}

export const buildReturnUrl = (from?: string, category_id?: number | null, extraParams?: Record<string, string>) => {
  const params = new URLSearchParams()

  if (from === 'categories' && category_id) {
    params.set('category_id', String(category_id))
    params.set('from', 'categories')
  }

  if (extraParams) {
    for (const key in extraParams) {
      params.set(key, extraParams[key])
    }
  }

  return `/transactions${params.toString() ? `?${params}` : ''}`
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\transaction\transaction.controller.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express'
import { getActiveAccounts, getActiveAccountsForTransfer, getActiveAccountsForTransferIncludeCurrentAccount, getActiveAccountsIncludeCurrentAccount } from '../../cache/cache-accounts.service'
import { getActiveCategoryById, getActiveExpenseCategories, getActiveExpenseCategoriesIncludeCurrentCategory, getActiveIncomeCategories, getActiveIncomeCategoriesIncludeCurrentCategory, getCategoryById } from '../../cache/cache-categories.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Transaction } from '../../entities/Transaction.entity'
import { transactionFormMatrix } from '../../policies/transaction-form.policy'
import { getNextValidTransactionDate } from '../../services/next-valid-trx-date.service'
import { AuthRequest } from '../../types/auth-request'
import { BaseFormViewParams } from '../../types/form-view-params'
import { formatDateForInputLocal } from '../../utils/date.util'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'
import { validateActiveCategoryTransaction } from './transaction.validator'
export { saveTransaction as apiForSavingTransaction } from './transaction.saving'

type TransactionFormViewParams = BaseFormViewParams & {
  transaction: any
}

const renderTransactionForm = async (res: Response, params: TransactionFormViewParams) => {
  const { title, view, transaction, errors, mode, auth_req } = params

  const transaction_form_policy = transactionFormMatrix[mode]
  const active_accounts = await getActiveAccountsIncludeCurrentAccount(auth_req, transaction?.account?.id)
  const active_accounts_for_transfer = await getActiveAccountsForTransferIncludeCurrentAccount(auth_req, transaction?.account?.id)
  const active_income_categories = await getActiveIncomeCategoriesIncludeCurrentCategory(auth_req, transaction?.category?.id)
  const active_expense_categories = await getActiveExpenseCategoriesIncludeCurrentCategory(auth_req, transaction?.category?.id)

  const category_id = auth_req.query.category_id || null
  const from = auth_req.query.from || null

  return res.render(
    'layouts/main',
    {
      title,
      view,
      errors,
      mode,
      auth_req,
      transaction,
      transaction_form_policy,
      active_accounts,
      active_accounts_for_transfer,
      active_income_categories,
      active_expense_categories,
      context: { category_id, from },
    }
  )
}

export const apiForGettingTransactions: RequestHandler = async (req: Request, res: Response) => {
  try {
    const auth_req = req as AuthRequest
    const page = Number(auth_req.query.page) || 1
    const limit = Number(auth_req.query.limit) || 10
    const search = (auth_req.query.search as string) || ''
    const skip = (page - 1) * limit
    const user_id = auth_req.user.id
    const category_id = Number(auth_req.query.category_id) || null

    const qb = AppDataSource
      .getRepository(Transaction)
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.account', 'account')
      .leftJoinAndSelect('t.to_account', 'to_account')
      .leftJoinAndSelect('t.category', 'category')
      .leftJoinAndSelect('t.loan', 'loan')
      .leftJoinAndSelect('t.loan_payment', 'loan_payment')
      .leftJoinAndSelect('loan_payment.loan', 'paymentLoan')
      .leftJoinAndSelect('paymentLoan.category', 'paymentLoanCategory')
      .where('t.user_id = :user_id', { user_id })

    if (category_id) {
      qb.andWhere('category.id = :category_id', { category_id })
    }

    if (search) {
      qb.andWhere(
        `(
          t.type LIKE :search OR
          account.name LIKE :search OR
          to_account.name LIKE :search OR
          category.name LIKE :search OR
          t.description LIKE :search 
        )`,
        { search: `%${search.toLowerCase()}%` }
      )
    }

    const [items, total] = await qb
      .orderBy('t.date', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount()

    res.json({ items, total, page, limit, category_id: category_id })
  } catch (error) {
    logger.error(`${apiForGettingTransactions.name}-Error. `, parseError(error))
    res.status(500).json({ error: 'Error al listar transacciones' })
  } finally {
  }
}

export const routeToPageTransaction: RequestHandler = (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const category_id = req.query.category_id || null
  const from = req.query.from || null
  const saved_batch = req.query.saved_batch === 'true'
  const timezone = auth_req.timezone || 'UTC'
  res.render(
    'layouts/main',
    {
      title: 'Transacciones',
      view: 'pages/transactions/index',
      active_income_categories: [],
      active_expense_categories: [],
      USER_ID: auth_req.user?.id || 'guest',
      TIMEZONE: timezone,
      context: {
        from,
        category_id: category_id,
        saved_batch
      },
    })
}

export const routeToFormInsertTransaction: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  const timezone = auth_req.timezone || 'UTC'

  const default_date = await getNextValidTransactionDate(auth_req)
  return renderTransactionForm(res, {
    title: 'Insertar Transacción',
    view: 'pages/transactions/form',
    errors: {},
    mode,
    auth_req,
    transaction: {
      date: formatDateForInputLocal(default_date, timezone),
      amount: '0.00',
    },
  })
}

export const routeToFormUpdateTransaction: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'update'
  const auth_req = req as AuthRequest
  const transaction_id = Number(req.params.id)
  const timezone = auth_req.timezone || 'UTC'
  const repo_transaction = AppDataSource.getRepository(Transaction)
  const transaction = await repo_transaction.findOne({
    where: { id: transaction_id, user: { id: auth_req.user.id } },
    relations: { account: true, to_account: true, category: true }
  })
  if (!transaction) {
    return res.redirect('/transactions')
  }
  return renderTransactionForm(res, {
    title: 'Editar Transacción',
    view: 'pages/transactions/form',
    errors: {},
    mode,
    auth_req,
    transaction: {
      ...transaction,
      date: formatDateForInputLocal(transaction.date, timezone),
    },
  })
}

export const routeToFormCloneTransaction: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'insert'
  const auth_req = req as AuthRequest
  const transaction_id = Number(req.params.id)
  const timezone = auth_req.timezone || 'UTC'
  const repo_transaction = AppDataSource.getRepository(Transaction)
  const transaction = await repo_transaction.findOne({
    where: { id: transaction_id, user: { id: auth_req.user.id } },
    relations: { account: true, to_account: true, category: true }
  })
  if (!transaction) {
    return res.redirect('/transactions')
  }
  const default_date = await getNextValidTransactionDate(auth_req)
  const category_errors = await validateActiveCategoryTransaction(transaction, auth_req)
  const errors = category_errors ? category_errors : {}
  return renderTransactionForm(res, {
    title: 'Insertar Transacción',
    view: 'pages/transactions/form',
    errors,
    mode,
    auth_req,
    transaction: {
      ...transaction,
      date: formatDateForInputLocal(default_date, timezone),
      description: transaction.description ?? ''
    },
  })
}

export const routeToFormDeleteTransaction: RequestHandler = async (req: Request, res: Response) => {
  const mode = 'delete'
  const auth_req = req as AuthRequest
  const transaction_id = Number(req.params.id)
  const timezone = auth_req.timezone || 'UTC'
  const repo_transaction = AppDataSource.getRepository(Transaction)
  const transaction = await repo_transaction.findOne({
    where: { id: transaction_id, user: { id: auth_req.user.id } },
    relations: { account: true, to_account: true, category: true }
  })
  if (!transaction) {
    return res.redirect('/transactions')
  }
  return renderTransactionForm(res, {
    title: 'Eliminar Transacción',
    view: 'pages/transactions/form',
    errors: {},
    mode,
    auth_req: auth_req,
    transaction: {
      ...transaction,
      date: formatDateForInputLocal(transaction.date, timezone),
    },
  })
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\transaction\transaction.saving.ts
```
 
```ts
import { Request, RequestHandler, Response } from 'express';
import { performance } from 'perf_hooks';
import { getAccountById, getActiveAccounts, getActiveAccountsForTransfer } from '../../cache/cache-accounts.service';
import { getActiveExpenseCategories, getActiveIncomeCategories, getCategoryById } from '../../cache/cache-categories.service';
import { deleteAll } from '../../cache/cache-key.service';
import { AppDataSource } from '../../config/typeorm.datasource';
import { Account } from '../../entities/Account.entity';
import { Transaction } from '../../entities/Transaction.entity';
import { transactionFormMatrix } from '../../policies/transaction-form.policy';
import { KpiCacheService } from '../../services/kpi-cache.service';
import { AuthRequest } from '../../types/auth-request';
import { TransactionFormMode } from '../../types/form-view-params';
import { parseLocalDateToUTC } from '../../utils/date.util';
import { parseError } from '../../utils/error.util';
import { logger } from '../../utils/logger.util';
import { getSqlErrorMessage } from '../../utils/sql-err.util';
import { calculateTransactionDeltas } from '../transaction/transaction.auxiliar';
import { validateDeleteTransaction, validateSaveTransaction } from '../transaction/transaction.validator';

/* ============================
   Título según modo
============================ */
const getTitle = (mode: TransactionFormMode) => {
  switch (mode) {
    case 'insert': return 'Insertar Transacción'
    case 'update': return 'Editar Transacción'
    case 'delete': return 'Eliminar Transacción'
    default: return 'Indefinido'
  }
}

/* ============================
   Sanitizar payload según policy
============================ */
const sanitizeByPolicy = (mode: TransactionFormMode, body: any) => {
  const policy = transactionFormMatrix[mode]
  const clean: any = {}
  for (const field in policy) {
    if ((policy[field] === 'editable' || policy[field] === 'readonly') && body[field] !== undefined) {
      clean[field] = body[field]
    }
  }
  return clean
}

/* ============================
   Construir objeto para la vista
============================ */
const buildTransactionView = (auth_req: AuthRequest, body: any) => {
  return {
    ...body
  }
}

const isSavingAccount = (acc: Account | null | undefined): acc is Account & { type: 'saving' } => {
  return acc?.type === 'saving'
}

export const saveTransaction: RequestHandler = async (req: Request, res: Response) => {
  const start = performance.now()
  logger.info(`${saveTransaction.name} called`, { body: req.body, param: req.params })
  const auth_req = req as AuthRequest
  const user_id = auth_req.user.id
  const timezone = req.body.timezone || 'UTC'
  const mode: TransactionFormMode = req.body.mode || 'insert'
  const transaction_id = Number(req.body.id)
  const return_from = req.body.return_from
  const return_category_id = Number(req.body.return_category_id) || null


  const active_accounts = await getActiveAccounts(auth_req)
  const active_accounts_for_transfer = await getActiveAccountsForTransfer(auth_req)
  const active_income_categories = await getActiveIncomeCategories(auth_req)
  const active_expense_categories = await getActiveExpenseCategories(auth_req)

  const form_state = {
    transaction: buildTransactionView(auth_req, req.body),
    transaction_form_policy: transactionFormMatrix[mode],
    active_accounts,
    active_accounts_for_transfer,
    active_income_categories,
    active_expense_categories,
    mode,
    context: { from: return_from, category_id: return_category_id }
  }

  const query_runner = AppDataSource.createQueryRunner()
  await query_runner.connect()
  await query_runner.startTransaction()
  const repo_transaction = AppDataSource.getRepository(Transaction)

  try {
    let existing: Transaction | null = null
    if (transaction_id) {
      existing = await repo_transaction.findOne({
        where: { id: transaction_id, user: { id: auth_req.user.id } },
        relations: { account: true, to_account: true, category: true }
      })
      if (!existing) throw new Error('Transacción no encontrada')
    }

    /* ============================
       DELETE
    ============================ */
    if (mode === 'delete') {
      if (!existing) throw new Error('Transacción no encontrada')
      const errors = await validateDeleteTransaction(existing, auth_req)
      if (errors) throw { validationErrors: errors }
      const deltas = calculateTransactionDeltas(existing, -1)
      for (const [acc_id, delta] of deltas) {
        const acc = await query_runner.manager.findOne(Account, { where: { id: acc_id } })
        if (!acc) continue
        await query_runner.manager.update(Account, { id: acc_id }, {
          balance: Number(acc.balance) + delta
        })
      }

      await query_runner.manager.remove(Transaction, existing)
      await query_runner.commitTransaction()
      deleteAll(auth_req, 'transaction')

      KpiCacheService
        .recalculateBalanceKPIByTransaction(auth_req, existing)
        .catch(error => logger.error(`${saveTransaction.name}-Error recalculando KPI Balance`, parseError(error)))

      KpiCacheService
        .recalculateCategoryKPIByTransaction(auth_req, existing)
        .catch(error => logger.error(`${saveTransaction.name}-Error recalculando KPI Categorías`, parseError(error)))

        if (return_from === 'categories' && return_category_id) {
        return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
      }
      return res.redirect('/transactions')
    }

    /* ============================
       INSERT / UPDATE
    ============================ */
    let transaction: Transaction
    let previous_transaction: Transaction | undefined
    if (mode === 'insert') {
      transaction = repo_transaction.create({
        user: auth_req.user as any
      })
    } else {
      if (!existing) throw new Error('Transacción no encontrada')
      previous_transaction = Object.assign(new Transaction(), {
        type: existing.type,
        amount: existing.amount,
        account: existing.account,
        to_account: existing.to_account,
        category: existing.category
      })
      transaction = existing
    }
    /*=================================
      Aplicar sanitización por policy
    =================================*/
    const clean = sanitizeByPolicy(mode, req.body)
    if (clean.type !== undefined) { transaction.type = clean.type }
    if (clean.account !== undefined) { transaction.account = await getAccountById(auth_req, Number(clean.account)) }
    if (clean.to_account !== undefined) { transaction.to_account = await getAccountById(auth_req, Number(clean.to_account)) }
    if (clean.category !== undefined) { transaction.category = await getCategoryById(auth_req, Number(clean.category)) }
    if (clean.date) { transaction.date = parseLocalDateToUTC(clean.date, timezone) }
    if (clean.amount !== undefined) { transaction.amount = Number(clean.amount) }
    if (clean.description !== undefined) { transaction.description = clean.description }
    if (transaction.type === 'transfer') { transaction.category = null }
    if (transaction.type !== 'transfer') { transaction.to_account = null }

    // Determinar detailed_type basado en el tipo de transacción
    if (transaction.type === 'income') {
      transaction.detailed_type = 'income'
    } else if (transaction.type === 'expense') {
      transaction.detailed_type = 'expense'
    } else if (transaction.type === 'transfer') {
      const from_account = transaction.account
      const to_account = transaction.to_account
      const from_is_saving = from_account && isSavingAccount(from_account)
      const to_is_saving = to_account && isSavingAccount(to_account)
      if (to_is_saving && !from_is_saving) {
        transaction.detailed_type = 'saving'
      }
      else if (from_is_saving && !to_is_saving) {
        transaction.detailed_type = 'withdrawal'
      }
      else {
        transaction.detailed_type = 'transfer'
      }
    }

    const errors = await validateSaveTransaction(transaction, auth_req, previous_transaction)
    if (errors) throw { validationErrors: errors }
    const deltas = new Map<number, number>()
    const mergeDeltas = (map: Map<number, number>) => {
      for (const [acc_id, value] of map) {
        const prev = deltas.get(acc_id) || 0
        deltas.set(acc_id, prev + value)
      }
    }
    if (previous_transaction) {
      mergeDeltas(calculateTransactionDeltas(previous_transaction, -1))
    }
    const saved_transaction = await query_runner.manager.save(Transaction, transaction)
    mergeDeltas(calculateTransactionDeltas(saved_transaction, 1))
    for (const [acc_id, delta] of deltas) {
      const acc = await query_runner.manager.findOne(Account, { where: { id: acc_id } })
      if (!acc) continue
      await query_runner.manager.update(Account, { id: acc_id }, {
        balance: Number(acc.balance) + delta
      })
    }

    /*=================================
      Guardar en base de datos y limpiar cache
    =================================*/
    await query_runner.commitTransaction()
    deleteAll(auth_req, 'transaction')

    KpiCacheService
      .recalculateBalanceKPIByTransaction(auth_req, saved_transaction)
      .catch(error => logger.error(`${saveTransaction.name}-Error recalculando KPI Balance`, parseError(error)))

    KpiCacheService
      .recalculateCategoryKPIByTransaction(auth_req, saved_transaction)
      .catch(error => logger.error(`${saveTransaction.name}-Error recalculando KPI Categorías`, parseError(error)))

      if (return_from === 'categories' && return_category_id) {
      return res.redirect(`/transactions?category_id=${return_category_id}&from=categories`)
    }
    return res.redirect('/transactions')

  } catch (error: any) {
    /* ============================
       Manejo de errores
    ============================ */
    await query_runner.rollbackTransaction()
    logger.error(`${saveTransaction.name}-Error. `, { user_id: auth_req.user.id, transaction_id, mode, error: parseError(error), })

    const validation_errors = error?.validationErrors || null
    return res.status(500).render('layouts/main', {
      title: getTitle(mode),
      view: 'pages/transactions/form',
      ...form_state,
      active_accounts_for_transfer,
      active_accounts,
      active_income_categories,
      active_expense_categories,
      context: { from: return_from, category_id: return_category_id },
      errors: validation_errors || { general: 'Ocurrió un error inesperado. Intenta nuevamente.\n' + getSqlErrorMessage(error) }
    })
  } finally {
    await query_runner.release()
    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`${saveTransaction.name}. user=[${user_id}], elapsedTime=[${duration_sec.toFixed(4)}]`)
  }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\controllers\transaction\transaction.validator.ts
```
 
```ts
import { validate } from 'class-validator'
import { AppDataSource } from '../../config/typeorm.datasource'
import { Account } from '../../entities/Account.entity'
import { Category } from '../../entities/Category.entity'
import { Transaction } from '../../entities/Transaction.entity'
import { AuthRequest } from '../../types/auth-request'
import { logger } from '../../utils/logger.util'

export const validateSaveTransaction = async (transaction: Transaction, auth_req: AuthRequest, old_transaction?: Transaction): Promise<Record<string, string> | null> => {
    const errors = await validate(transaction)
    const field_errors: Record<string, string> = {}

    if (errors.length > 0) {
        errors.forEach(err => {
            const message = err.constraints
                ? Object.values(err.constraints)[0]
                : err.children?.[0]?.constraints
                    ? Object.values(err.children[0].constraints)[0]
                    : null

            if (!message) return

            switch (err.property) {
                case 'account':
                    field_errors.account = message
                    break
                case 'to_account':
                    field_errors.to_account = message
                    break
                case 'description':
                    field_errors.description = message
                    break
                case 'category':
                    field_errors.category = message
                    break
                default:
                    field_errors.general = message
            }
        })
    }

    // Validación: la fecha debe ser del mes en curso o posterior
    if (transaction.date) {
        const now = new Date()
        const start_of_current_month = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
        if (transaction.date < start_of_current_month) {
            if (!auth_req.role?.can_update_date_transaction) {
                field_errors.date = 'La fecha debe ser del mes en curso o posterior'
            }
        }
    }

    // Validación: el monto debe ser mayor a cero
    if (transaction.amount === undefined || transaction.amount === null || Number(transaction.amount) <= 0) {
        field_errors.amount = 'El monto debe ser mayor a cero'
    }

    if (transaction.type === 'income' || transaction.type === 'expense') {
        if (!transaction.account) field_errors.account = 'Debe seleccionar una cuenta'
        if (!transaction.category) field_errors.category = 'Debe seleccionar una categoría'
        if (transaction.to_account) field_errors.to_account = 'Una transferencia no es válida para este tipo'
    }

    if (transaction.type === 'transfer') {
        if (!transaction.account) field_errors.account = 'Debe seleccionar una cuenta origen'
        if (!transaction.to_account) field_errors.to_account = 'Debe seleccionar una cuenta destino'
        if (transaction.category) field_errors.category = 'Una transferencia no lleva categoría'
    }

    // Validación: para egresos, la cuenta debe tener saldo disponible
    if (transaction.type === 'expense') {
        if (!transaction.account || !transaction.account.id) {
            field_errors.account = 'Cuenta requerida para egreso'
        } else {
            const accRepo = AppDataSource.getRepository(Account)
            const acc = await accRepo.findOne({ where: { id: transaction.account.id, user: { id: auth_req.user.id } } })
            const acc_balance = acc ? Number(acc.balance) : 0

            const new_amount = Number(transaction.amount)
            const old_amount = old_transaction ? Number(old_transaction.amount) : 0

            const is_same_amount = old_transaction && new_amount === old_amount
            if (!is_same_amount) {
                const effective_balance = acc_balance + old_amount
                if (effective_balance <= 0) {
                    field_errors.amount = 'No hay saldo disponible en la cuenta para realizar el egreso'
                } else if (new_amount > effective_balance) {
                    field_errors.amount = 'Saldo insuficiente en la cuenta para este egreso'
                }
            }
        }
    }

    // Validación: para transferencias, la cuenta origen debe tener saldo suficiente
    if (transaction.type === 'transfer') {
        if (!transaction.account || !transaction.account.id) {
            field_errors.account = 'Cuenta origen requerida para transferencia'
        }
        if (!transaction.to_account || !transaction.to_account.id) {
            field_errors.to_account = 'Cuenta destino requerida para transferencia'
        }
        if (transaction.account && transaction.to_account && transaction.account.id === transaction.to_account.id) {
            field_errors.to_account = 'La cuenta destino debe ser distinta a la cuenta origen'
        }

        if (transaction.account && transaction.account.id) {
            const accRepo = AppDataSource.getRepository(Account)
            const acc = await accRepo.findOne({ where: { id: transaction.account.id, user: { id: auth_req.user.id } } })
            const acc_balance = acc ? Number(acc.balance) : 0

            const new_amount = Number(transaction.amount)
            const old_amount = old_transaction ? Number(old_transaction.amount) : 0
            const is_same_amount = old_transaction && new_amount === old_amount

            if (!is_same_amount) {
                const effective_balance = acc_balance + old_amount
                if (effective_balance <= 0) {
                    field_errors.amount = 'No hay saldo disponible en la cuenta origen para realizar la transferencia'
                } else if (new_amount > effective_balance) {
                    field_errors.amount = 'Saldo insuficiente en la cuenta origen para esta transferencia'
                }
            }
        }
    }
    logger.debug(`${validateSaveTransaction.name}-Errors: ${JSON.stringify(field_errors)}`)
    return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateDeleteTransaction = async (transaction: Transaction, auth_req: AuthRequest): Promise<Record<string, string> | null> => {
    const field_errors: Record<string, string> = {}

    if (!transaction.date) {
        field_errors.general = 'La transacción no tiene fecha registrada'
    } else {
        const transaction_date = new Date(transaction.date)
        const now = new Date()

        if (transaction_date.getFullYear() < now.getFullYear() || (transaction_date.getFullYear() === now.getFullYear() && transaction_date.getMonth() < now.getMonth())) {
            if (!auth_req.role?.can_delete_transaction) {
                field_errors.general = 'No se puede eliminar transacciones de meses anteriores'
            }
        }
    }

    logger.debug(`${validateDeleteTransaction.name}-Errors: ${JSON.stringify(field_errors)}`)
    return Object.keys(field_errors).length > 0 ? field_errors : null
}

export const validateActiveCategoryTransaction = async (transaction: Transaction, auth_req: AuthRequest): Promise<Record<string, string> | null> => {
    const field_errors: Record<string, string> = {}

    if (!transaction.category || !transaction.category.id) {
        return null
    }

    const categoryRepo = AppDataSource.getRepository(Category)
    const category = await categoryRepo.findOne({
        where: {
            id: transaction.category.id,
            user: { id: auth_req.user.id },
            is_active: true
        }
    })

    if (!category) {
        const category_name = transaction.category?.name || ''
        field_errors.category = `La categoría "${category_name}" de esta transacción ya no está activa o no existe`
    }

    logger.debug(`${validateActiveCategoryTransaction.name}-Errors: ${JSON.stringify(field_errors)}`)
    return Object.keys(field_errors).length > 0 ? field_errors : null
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\Account.entity.ts
```
 
```ts
import { IsBoolean, IsIn, IsNotEmpty } from 'class-validator'
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { DecimalTransformer } from '../config/typeorm-decimal.transformer'
import { Payable } from './Payable.entity'
import { PayablePayment } from './PayablePayment.entity'
import { Transaction } from './Transaction.entity'
import { User } from './User.entity'
import { ReceivableCollection } from './ReceivableCollection.entity'
import { Receivable } from './Receivable.entity'
@Index('idx_accounts_user_active_type', ['user', 'is_active', 'type'])
@Entity('accounts')
export class Account {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.accounts)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_accounts_user' })
  user!: User

  @Column()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string

  @Column({ type: 'varchar' })
  @IsIn(['cash', 'bank', 'card', 'saving'], { message: 'El tipo debe ser cash, bank, saving o card' })
  type!: 'cash' | 'bank' | 'card' | 'saving'

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  balance!: number

  @Column({ default: true })
  @IsBoolean({ message: 'El estado debe ser true o false' })
  is_active!: boolean

  @OneToMany(() => Transaction, transaction => transaction.account)
  transactions!: Transaction[]

  @OneToMany(() => PayablePayment, payment => payment.account)
  payablePayments!: PayablePayment[]

  @OneToMany(() => Payable, payable => payable.disbursement_account)
  payables!: Payable[]

  @OneToMany(() => ReceivableCollection, collection => collection.account)
  receivableCollections!: ReceivableCollection[]

  @OneToMany(() => Receivable, receivable => receivable.disbursement_account)
  receivables!: Receivable[]
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\AuthCode.entity.ts
```
 
```ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn
} from 'typeorm'
import { User } from './User.entity'

@Entity('auth_codes')
export class AuthCode {
  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_authcodes_user' })
  user!: User

  @Column()
  code_hash!: string

  @Column({ type: 'timestamp' })
  expires_at!: Date

  @Column({ type: 'timestamp', nullable: true })
  used_at!: Date | null

  @Column({ default: 0 })
  attempts!: number

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\CacheKpiBalance.entity.ts
```
 
```ts
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { DecimalTransformer } from '../config/typeorm-decimal.transformer'
import { User } from './User.entity'

@Index('uq_user_period', ['user', 'period_year', 'period_month'], { unique: true })
@Entity('cache_kpi_balances')
export class CacheKpiBalance {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_cache_kpi_balances_user' })
  user!: User

  @Column({ type: 'int' })
  period_year!: number

  @Column({ type: 'int' })
  period_month!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  incomes!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  expenses!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  savings!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  withdrawals!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  loans!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  payments!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  total_inflows!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  total_outflows!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  net_cash_flow!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  net_savings!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  available_balance!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  principal_breakdown!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  interest_breakdown!: number

} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\CacheKpiCategory.entity.ts
```
 
```ts
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { DecimalTransformer } from '../config/typeorm-decimal.transformer'
import { Category } from './Category.entity'
import { CategoryGroup } from './CategoryGroups.entity'
import { User } from './User.entity'

@Index('uk_cache_kpi_categories', ['user', 'year_period', 'month_period', 'category_group', 'category'], { unique: true })
@Index('idx_user_period', ['user', 'year_period', 'month_period'])
@Index('idx_category_group', ['user', 'category_group'])
@Index('idx_category', ['user', 'category'])
@Entity('cache_kpi_categories')
export class CacheKpiCategory {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_cache_kpi_categories_user' })
  user!: User

  @Column({ type: 'smallint' })
  year_period!: number

  @Column({ type: 'tinyint' })
  month_period!: number

  @ManyToOne(() => CategoryGroup)
  @JoinColumn({ name: 'category_group_id', foreignKeyConstraintName: 'fk_cache_kpi_categories_group' })
  category_group!: CategoryGroup

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id', foreignKeyConstraintName: 'fk_cache_kpi_categories_category' })
  category!: Category

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  amount!: number

  @Column({ type: 'int', default: 0 })
  transaction_count!: number

}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\Category.entity.ts
```
 
```ts
import { IsBoolean, IsIn, IsNotEmpty, IsOptional } from 'class-validator'
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { CategoryGroup } from './CategoryGroups.entity'
import { Payable } from './Payable.entity'
import { PayablePayment } from './PayablePayment.entity'
import { Transaction } from './Transaction.entity'
import { User } from './User.entity'
import { Receivable } from './Receivable.entity'
import { ReceivableCollection } from './ReceivableCollection.entity'

@Entity('categories')
export class Category {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.categories)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_categories_user' })
  user!: User

  @Column()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string

  @Column({ type: 'varchar' })
  @IsIn(['income', 'expense'], { message: 'El tipo debe ser income o expense' })
  type!: 'income' | 'expense'

  @Column({ type: 'varchar' })
  @IsOptional()
  @IsIn(['loan', 'payment'], { message: 'El tipo debe ser loan o payment o vacío' })
  type_for_loan!: 'loan' | 'payment' | 'receivable' | 'collection' | null

  @Column({ default: true })
  @IsBoolean({ message: 'El estado debe ser true o false' })
  is_active!: boolean

  @OneToMany(() => Transaction, transaction => transaction.category)
  transactions!: Transaction[]

  @OneToMany(() => Payable, payable => payable.category)
  payables!: Payable[]

  @OneToMany(() => PayablePayment, payment => payment.category)
  payable_payments!: PayablePayment[]

  @ManyToOne(() => CategoryGroup, group => group.categories)
  @JoinColumn({ name: 'category_group_id', foreignKeyConstraintName: 'fk_categories_group' })
  category_group!: CategoryGroup | null

  @OneToMany(() => Receivable, receivable => receivable.category)
  receivables!: Receivable[]

  @OneToMany(() => ReceivableCollection, collection => collection.category)
  receivable_collections!: ReceivableCollection[]

}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\CategoryGroups.entity.ts
```
 
```ts
import { IsNotEmpty } from 'class-validator'
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { User } from './User.entity'
import { Category } from './Category.entity'

@Entity('category_groups')
export class CategoryGroup {

  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  @IsNotEmpty({ message: 'El nombre del grupo es obligatorio' })
  name!: string

  @Column({ default: true })
  is_active!: boolean

  @OneToMany(() => Category, category => category.category_group)
  categories!: Category[]

  @ManyToOne(() => User, user => user.category_groups)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_category_groups_user' })
  user!: User
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\Payable.entity.ts
```
 
```ts
import { IsBoolean, IsNotEmpty } from 'class-validator'
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn, Unique } from 'typeorm'
import { DecimalTransformer } from '../config/typeorm-decimal.transformer'
import { Account } from './Account.entity'
import { Category } from './Category.entity'
import { PayableGroup } from './PayableGroup.entity'
import { PayablePayment } from './PayablePayment.entity'
import { Transaction } from './Transaction.entity'
import { User } from './User.entity'

@Entity('payables')
export class Payable {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.payables)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_payables_user' })
  user!: User

  @Column()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  total_amount!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  principal_paid!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  interest_paid!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  balance!: number;

  @Column({ type: 'timestamp' })
  start_date!: Date

  @Column({ type: 'timestamp', nullable: true })
  end_date!: Date | null

  @Column({ default: true })
  @IsBoolean({ message: 'El estado debe ser true o false' })
  is_active!: boolean

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @Column({ nullable: true })
  note!: string

  @ManyToOne(() => PayableGroup, group => group.payables)
  @JoinColumn({ name: 'payable_group_id', foreignKeyConstraintName: 'fk_payables_group' })
  payable_group!: PayableGroup | null

  @OneToMany(() => PayablePayment, payment => payment.payable)
  payments!: PayablePayment[]

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'disbursement_account_id', foreignKeyConstraintName: 'fk_payables_disbursement_account' })
  disbursement_account!: Account | null

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id', foreignKeyConstraintName: 'fk_payables_category' })
  category!: Category | null

  @OneToOne(() => Transaction)
  @JoinColumn({ name: 'transaction_id', foreignKeyConstraintName: 'fk_payables_transaction' })
  transaction!: Transaction

}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\PayableGroup.entity.ts
```
 
```ts
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { Payable } from './Payable.entity'
import { User } from './User.entity'
import { IsNotEmpty } from 'class-validator'

@Entity('payable_groups')
export class PayableGroup {

  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  @IsNotEmpty({ message: 'El nombre del grupo es obligatorio' })
  name!: string

  @Column({ default: true })
  is_active!: boolean

  @OneToMany(() => Payable, payable => payable.payable_group)
  payables!: Payable[]

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_payable_groups_user' })
  user!: User

}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\PayablePayment.entity.ts
```
 
```ts
import { IsDate, IsNotEmpty, IsNumber, IsPositive, Min } from 'class-validator'
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { DecimalTransformer } from '../config/typeorm-decimal.transformer'
import { Account } from './Account.entity'
import { Category } from './Category.entity'
import { Payable } from './Payable.entity'
import { Transaction } from './Transaction.entity'

@Entity('payable_payments')
export class PayablePayment {

  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  payment_number!: number

  @ManyToOne(() => Payable, payable => payable.payments)
  @JoinColumn({ name: 'payable_id', foreignKeyConstraintName: 'fk_payable_payments_payable' })
  payable!: Payable

  @ManyToOne(() => Account, account => account.payablePayments)
  @JoinColumn({ name: 'account_id', foreignKeyConstraintName: 'fk_payable_payments_account' })
  @IsNotEmpty({ message: 'La cuenta es obligatoria' })
  account!: Account

  @ManyToOne(() => Transaction)
  @JoinColumn({ name: 'transaction_id', foreignKeyConstraintName: 'fk_payable_payments_transaction' })
  transaction!: Transaction

  @IsNumber({}, { message: 'El monto debe ser numérico' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  principal_paid!: number

  @IsNumber({}, { message: 'El monto debe ser numérico' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  interest_paid!: number

  @IsDate({ message: 'La fecha del pago debe ser una fecha válida' })
  @Column({ type: 'timestamp' })
  payment_date!: Date

  @Column({ nullable: true })
  note!: string

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id', foreignKeyConstraintName: 'fk_payable_payments_category' })
  category!: Category | null

}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\Receivable.entity.ts
```
 
```ts
import { IsBoolean, IsNotEmpty } from 'class-validator'
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn
} from 'typeorm'
import { DecimalTransformer } from '../config/typeorm-decimal.transformer'
import { Account } from './Account.entity'
import { Category } from './Category.entity'
import { ReceivableGroup } from './ReceivableGroup.entity'
import { Transaction } from './Transaction.entity'
import { User } from './User.entity'
import { ReceivableCollection } from './ReceivableCollection.entity'

@Entity('receivables')
export class Receivable {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.receivables)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_receivables_user' })
  user!: User

  @Column()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  total_amount!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  principal_received!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  interest_received!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  balance!: number

  @Column({ type: 'timestamp' })
  start_date!: Date

  @Column({ type: 'timestamp', nullable: true })
  end_date!: Date | null

  @Column({ default: true })
  @IsBoolean({ message: 'El estado debe ser true o false' })
  is_active!: boolean

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @Column({ nullable: true })
  note!: string

  @ManyToOne(() => ReceivableGroup, group => group.receivables)
  @JoinColumn({ name: 'receivable_group_id', foreignKeyConstraintName: 'fk_receivables_group' })
  receivable_group!: ReceivableGroup | null

  @OneToMany(() => ReceivableCollection, collection => collection.receivable)
  collections!: ReceivableCollection[]

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'disbursement_account_id', foreignKeyConstraintName: 'fk_receivables_disbursement_account' })
  disbursement_account!: Account | null

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id', foreignKeyConstraintName: 'fk_receivables_category' })
  category!: Category | null

  @OneToOne(() => Transaction)
  @JoinColumn({ name: 'transaction_id', foreignKeyConstraintName: 'fk_receivables_transaction' })
  transaction!: Transaction

} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\ReceivableCollection.entity.ts
```
 
```ts
import { IsDate, IsNotEmpty, IsNumber } from 'class-validator'
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from 'typeorm'
import { DecimalTransformer } from '../config/typeorm-decimal.transformer'
import { Account } from './Account.entity'
import { Category } from './Category.entity'
import { Transaction } from './Transaction.entity'
import { Receivable } from './Receivable.entity'

@Entity('receivable_collections')
export class ReceivableCollection {

  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  collection_number!: number

  @ManyToOne(() => Receivable, receivable => receivable.collections)
  @JoinColumn({ name: 'receivable_id', foreignKeyConstraintName: 'fk_receivable_collections_receivable' })
  receivable!: Receivable

  @ManyToOne(() => Account, account => account.receivableCollections)
  @JoinColumn({ name: 'account_id', foreignKeyConstraintName: 'fk_receivable_collections_account' })
  @IsNotEmpty({ message: 'La cuenta es obligatoria' })
  account!: Account

  @ManyToOne(() => Transaction)
  @JoinColumn({ name: 'transaction_id', foreignKeyConstraintName: 'fk_receivable_collections_transaction' })
  transaction!: Transaction

  @IsNumber({}, { message: 'El monto debe ser numérico' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  principal_collected!: number

  @IsNumber({}, { message: 'El monto debe ser numérico' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  interest_collected!: number

  @IsDate({ message: 'La fecha del cobro debe ser una fecha válida' })
  @Column({ type: 'timestamp' })
  collection_date!: Date

  @Column({ nullable: true })
  note!: string

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id', foreignKeyConstraintName: 'fk_receivable_collections_category' })
  category!: Category | null

} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\ReceivableGroup.entity.ts
```
 
```ts
import { IsNotEmpty } from 'class-validator'
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { User } from './User.entity'
import { Receivable } from './Receivable.entity'

@Entity('receivable_groups')
export class ReceivableGroup {

  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  @IsNotEmpty({ message: 'El nombre del grupo es obligatorio' })
  name!: string

  @Column({ default: true })
  is_active!: boolean

  @OneToMany(() => Receivable, receivable => receivable.receivable_group)
  receivables!: Receivable[]

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_receivable_groups_user' })
  user!: User

} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\Transaction.entity.ts
```
 
```ts
import { Transform } from 'class-transformer'
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, MaxLength, ValidateIf } from 'class-validator'
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm'
import { DecimalTransformer } from '../config/typeorm-decimal.transformer'
import { Account } from './Account.entity'
import { Category } from './Category.entity'
import { Payable } from './Payable.entity'
import { PayablePayment } from './PayablePayment.entity'
import { User } from './User.entity'
import { Receivable } from './Receivable.entity'
import { ReceivableCollection } from './ReceivableCollection.entity'

@Entity('transactions')
export class Transaction {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.transactions)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_transactions_user' })
  user!: User

  @Column({ type: 'varchar' })
  @IsIn(['income', 'expense', 'transfer'], {
    message: 'Tipo de transacción inválido'
  })
  type!: 'income' | 'expense' | 'transfer'

  @Column({ type: 'varchar', nullable: true })
  @IsOptional()
  @IsIn(['income', 'expense', 'income_for_payable', 'payment_for_payable', 'saving', 'withdrawal', 'transfer'], {
    message: 'Tipo de transacción detallado inválido'
  })
  detailed_type?: 'income' | 'expense' | 'income_for_payable' | 'payment_for_payable' | 'saving' | 'withdrawal' | 'transfer' | null

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'account_id', foreignKeyConstraintName: 'fk_transactions_account' })
  @IsNotEmpty({ message: 'La cuenta es obligatoria' })
  account!: Account | null

  @ManyToOne(() => Account, { nullable: true })
  @JoinColumn({ name: 'to_account_id', foreignKeyConstraintName: 'fk_transactions_to_account' })
  @ValidateIf(t => t.type === 'transfer')
  @IsNotEmpty({ message: 'La cuenta destino es obligatoria' })
  to_account!: Account | null

  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'category_id', foreignKeyConstraintName: 'fk_transactions_categories' })
  @ValidateIf(t => t.type !== 'transfer')
  @IsNotEmpty({ message: 'La categoría es obligatoria' })
  category!: Category | null

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  @IsNumber({}, { message: 'El monto debe ser numérico' })
  @IsPositive({ message: 'El monto debe ser mayor a cero' })
  amount!: number

  @Column({ type: 'timestamp' })
  @Transform(({ value }) => value ? new Date(value) : new Date())
  date!: Date

  @Column({ default: '', length: 1000 })
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MaxLength(1000, { message: 'Máximo 1000 caracteres' })
  description!: string

  @OneToOne(() => Payable, payable => payable.transaction, { nullable: true })
  payable!: Payable

  @OneToOne(() => PayablePayment, payment => payment.transaction, { nullable: true })
  payable_payment!: PayablePayment | null

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @OneToOne(() => Receivable, receivable => receivable.transaction)
  receivable!: Receivable | null

  @OneToOne(() => ReceivableCollection, collection => collection.transaction)
  receivable_collection!: ReceivableCollection | null

}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\User.entity.ts
```
 
```ts
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm'
import { Account } from './Account.entity'
import { Category } from './Category.entity'
import { Payable } from './Payable.entity'
import { Transaction } from './Transaction.entity'
import { CategoryGroup } from './CategoryGroups.entity'
import { PayableGroup } from './PayableGroup.entity'
import { CacheKpiBalance } from './CacheKpiBalance.entity'
import { ReceivableGroup } from './ReceivableGroup.entity'
import { Receivable } from './Receivable.entity'

@Entity('users')
//@Unique('UQ_users_email', ['email'])
export class User {

  @PrimaryGeneratedColumn()
  id!: number

  @Column({ unique: true })
  email!: string

  @Column({ select: false })
  password_hash!: string

  @Column()
  name!: string

  @Column({ type: 'varchar', default: 'USER' })
  role!: 'ADMIN' | 'USER'

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @OneToMany(() => Account, account => account.user)
  accounts!: Account[]

  @OneToMany(() => Category, category => category.user)
  categories!: Category[]

  @OneToMany(() => Transaction, transaction => transaction.user)
  transactions!: Transaction[]

  @OneToMany(() => Payable, payable => payable.user)
  payables!: Payable[]

  @OneToMany(() => CategoryGroup, group => group.user)
  category_groups!: CategoryGroup[]

  @OneToMany(() => PayableGroup, group => group.user)
  payable_groups!: PayableGroup[]

  @OneToMany(() => CacheKpiBalance, cache => cache.user)
  cache_kpi_balances!: CacheKpiBalance[]

  @OneToMany(() => ReceivableGroup, group => group.user)
  receivable_groups!: ReceivableGroup[]

  @OneToMany(() => Receivable, receivable => receivable.user)
  receivables!: Receivable[]

}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\middlewares\csrf.middleware.ts
```
 
```ts
import crypto from 'crypto'
import { Request, Response, NextFunction } from 'express'

/**
 * Genera un token CSRF único
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Middleware para generar y validar tokens CSRF
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Generar token si no existe en la sesión
  const session = req.session as any
  if (!session.csrfToken) {
    session.csrfToken = generateCSRFToken()
  }

  // Para métodos que modifican datos (POST, PUT, DELETE, PATCH)
  const modifyingMethods = ['POST', 'PUT', 'DELETE', 'PATCH']
  if (modifyingMethods.includes(req.method)) {
    // Excluir rutas de login y 2FA que no necesitan CSRF (manejan su propia protección)
    const excludedPaths = ['/login', '/2fa']
    if (excludedPaths.some(path => req.path.startsWith(path))) {
      return next()
    }

    const tokenFromBody = req.body?._csrf
    const tokenFromHeader = req.headers['x-csrf-token'] as string
    const sessionToken = session.csrfToken

    const providedToken = tokenFromBody || tokenFromHeader

    if (!providedToken || !sessionToken || providedToken !== sessionToken) {
      return res.status(403).json({
        success: false,
        error: 'Token CSRF inválido o faltante'
      })
    }

    // Rotar token después de uso exitoso
    session.csrfToken = generateCSRFToken()
  }

  // Agregar token a res.locals para que esté disponible en las vistas
  res.locals.csrfToken = session.csrfToken

  next()
}

/**
 * Middleware para agregar token CSRF a respuestas JSON
 */
export function csrfTokenMiddleware(req: Request, res: Response, next: NextFunction) {
  const session = req.session as any

  // Generar token si no existe en la sesión
  if (!session.csrfToken) {
    session.csrfToken = generateCSRFToken()
  }

  // Agregar token a res.locals para que esté disponible en las vistas
  res.locals.csrfToken = session.csrfToken

  // Agregar helper para obtener token en respuestas JSON
  res.locals.getCSRFToken = () => session.csrfToken
  next()
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\middlewares\inject-loan-balance.middleware.ts
```
 
```ts
import { Request, Response, NextFunction } from 'express'
import { AuthRequest } from '../types/auth-request'
import { LoanBalanceService } from '../services/loan-balance.service'
import { logger } from '../utils/logger.util'
import { parseError } from '../utils/error.util'

export const injectLoanBalance = async (req: Request, res: Response, next: NextFunction) => {
    try {
        //logger.debug(`${injectLoanBalance.name}-Middleware ejecutado`)
        const auth_req = req as AuthRequest
        if (!auth_req.user) return next()
        const loan_balance = await LoanBalanceService.getPendingLoanBalance(auth_req.user.id)
        res.locals.loan_balance = loan_balance
        //logger.debug(`${injectLoanBalance.name}-Balance inyectado para usuario [${auth_req.user.id}]=[${loan_balance}]`)
        next()
    } catch (error) {
        logger.error(`${injectLoanBalance.name}-Error. `, parseError(error))
        next(error)
    }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\middlewares\inject-net-balance.middleware.ts
```
 
```ts
import { NextFunction, Request, RequestHandler, Response } from 'express'
import { AccountBalanceService } from '../services/account-balance.service'
import { AuthRequest } from '../types/auth-request'
import { logger } from '../utils/logger.util'
import { parseError } from '../utils/error.util'

export const injectNetBalance: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {

    try {
        //logger.debug(`${injectNetBalance.name}-Middleware ejecutado`)
        const auth_req = req as AuthRequest
        const user = auth_req.user
        if (!user) return next()
        const net_balance = await AccountBalanceService.getNetAvailableBalance(user.id)
        res.locals.net_balance = net_balance
        //logger.debug(`${injectNetBalance.name}-Balance inyectado para usuario [${user.id}]=[${net_balance}]`)
        next()
    } catch (error) {
        logger.error(`${injectNetBalance.name}-Error. `, parseError(error))
        next(error)
    }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\middlewares\logger.middleware.ts
```
 
```ts
import { Request, Response, NextFunction, RequestHandler } from 'express'
import { logger } from '../utils/logger.util'

const mustLogger = process.env.NODE_LOG_REQUESTS === 'true'

export const httpLogger: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now()
  if (!mustLogger) return next()
  logger.debug(`${req.method} ${req.originalUrl}`, { headers: req.headers, query: req.query, body: req.body })

  res.on('finish', () => {
    const duration = Date.now() - start
    logger.debug(`${req.method} ${req.originalUrl} - Status: ${res.statusCode} - ${duration}ms`)
  })

  res.on('close', () => {
    const duration = Date.now() - start
    logger.debug(`${req.method} ${req.originalUrl} - Connection closed - ${duration}ms`)
  })

  next()
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\middlewares\session-auth.middleware.ts
```
 
```ts
import { NextFunction, Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../config/typeorm.datasource'
import { User } from '../entities/User.entity'
import { AuthRequest } from '../types/auth-request'
import { logger } from '../utils/logger.util'
import { role_permissions } from '../policies/roles-user.policy'
import { parseError } from '../utils/error.util'


export const sessionAuthMiddleware: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session_user_id = (req.session as any)?.user_id
    if (!session_user_id) return res.redirect('/login')

    const user = await AppDataSource.getRepository(User).findOneBy({ id: session_user_id })
    if (!user) return res.redirect('/login')

    const auth_req = req as AuthRequest
    auth_req.user = user
    auth_req.timezone = (req.session as any)?.timezone || 'UTC'

    const role =  user.role
    auth_req.role = role_permissions[role]

    next()
  } catch (error) {
    logger.error(`${sessionAuthMiddleware.name}-Error. `, parseError(error))
    return res.redirect('/login')
  }
}

 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\policies\account-form.policy.ts
```
 
```ts
import { AccountFormMatrix } from "../types/form-view-params";

export const accountFormMatrix: AccountFormMatrix = {
    insert: {
        type: 'editable',
        name: 'editable',
        is_active: 'readonly'
    },
    update: {
        type: 'readonly',
        name: 'editable',
        is_active: 'editable'
    },
    delete: {
        type: 'readonly',
        name: 'readonly',
        is_active: 'readonly'
    }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\policies\category-form.policy.ts
```
 
```ts
import { CategoryFormMatrix } from "../types/form-view-params";

export const categoryFormMatrix: CategoryFormMatrix = {
    insert: {
        type: 'editable',
        type_for_loan: 'editable',
        name: 'editable',
        category_group_id: 'editable',
        is_active: 'readonly'
    },
    update: {
        type: 'readonly',
        type_for_loan: 'editable',
        name: 'editable',
        category_group_id: 'editable',
        is_active: 'editable'
    },
    delete: {
        type: 'readonly',
        type_for_loan: 'readonly',
        name: 'readonly',
        category_group_id: 'readonly',
        is_active: 'readonly'
    }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\policies\category-group-form.policy.ts
```
 
```ts
import { CategoryGroupFormMatrix } from "../types/form-view-params";

export const categoryGroupFormMatrix: CategoryGroupFormMatrix = {
    insert: {
        name: 'editable',
        is_active: 'readonly'
    },
    update: {
        name: 'editable',
        is_active: 'readonly'
    },
    delete: {
        name: 'readonly',
        is_active: 'readonly'
    },
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\policies\loan-form.policy.ts
```
 
```ts
import { LoanFormMatrix, } from "../types/form-view-params";

export const loanFormMatrix: LoanFormMatrix = {
    insert: {
        name: 'editable',
        total_amount: 'editable',
        start_date: 'editable',
        loan_group_id: 'editable',
        disbursement_account_id: 'editable',
        category_id: 'editable',
        note: 'editable',
        is_active: 'readonly'
    },

    update: {
        name: 'editable',
        total_amount: 'editable',
        start_date: 'editable',
        loan_group_id: 'editable',
        disbursement_account_id: 'editable',
        category_id: 'editable',
        note: 'editable',
        is_active: 'readonly'
    },

    delete: {
        name: 'readonly',
        total_amount: 'readonly',
        start_date: 'readonly',
        loan_group_id: 'readonly',
        disbursement_account_id: 'readonly',
        category_id: 'readonly',
        note: 'readonly',
        is_active: 'readonly'
    }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\policies\loan-group-form.policy.ts
```
 
```ts
import { LoanGroupFormMatrix } from "../types/form-view-params"

export const loanGroupFormMatrix: LoanGroupFormMatrix = {
    insert: {
        name: 'editable',
        is_active: 'readonly'
    },
    update: {
        name: 'editable',
        is_active: 'readonly'
    },
    delete: {
        name: 'readonly',
        is_active: 'readonly'
    },
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\policies\loan-payment-form.policy.ts
```
 
```ts
import { PaymentFormMatrix } from "../types/form-view-params";

export const paymentFormMatrix: PaymentFormMatrix = {

  insert: {
    account_id: 'editable',
    category_id: 'editable',
    principal_paid: 'editable',
    interest_paid: 'editable',
    payment_date: 'editable',
    note: 'editable'
  },

  update: {
    account_id: 'readonly',
    category_id: 'editable',
    principal_paid: 'editable',
    interest_paid: 'editable',
    payment_date: 'editable',
    note: 'editable'
  },

  delete: {
    account_id: 'readonly',
    category_id: 'readonly',
    principal_paid: 'readonly',
    interest_paid: 'readonly',
    payment_date: 'readonly',
    note: 'readonly'
  }

} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\policies\roles-user.policy.ts
```
 
```ts
type Role = 'ADMIN' | 'USER'

export interface RoleUser {
    can_update_amount_loan?: boolean
    can_update_start_date_loan?: boolean
    can_update_date_payment?: boolean
    can_update_date_transaction?: boolean
    can_delete_transaction?: boolean
}

export const role_permissions: Record<Role, RoleUser> = {
    ADMIN: {
        can_update_amount_loan: true,
        can_update_start_date_loan: true,
        can_update_date_payment: true,
        can_update_date_transaction: true,
        can_delete_transaction: true,
    },
    USER: {
        can_update_amount_loan: false,
        can_update_start_date_loan: false,
        can_update_date_payment: false,
        can_update_date_transaction: false,
        can_delete_transaction: false,
    }
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\policies\transaction-form.policy.ts
```
 
```ts
import { TransactionFormMatrix } from "../types/form-view-params";

export const transactionFormMatrix: TransactionFormMatrix = {
    insert: {
        type: 'editable',
        account: 'editable',
        to_account: 'editable',
        category: 'editable',
        amount: 'editable',
        date: 'editable',
        description: 'editable'
    },
    update: {
        type: 'readonly',
        account: 'editable',
        to_account: 'editable',
        category: 'editable',
        amount: 'editable',
        date: 'editable',
        description: 'editable'
    },
    delete: {
        type: 'readonly',
        account: 'readonly',
        to_account: 'readonly',
        category: 'readonly',
        amount: 'readonly',
        date: 'readonly',
        description: 'readonly'
    },
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\css\app.css
```
 
```css
/* =========================
   BASE
========================= */
@import url('./base/variables.css');
@import url('./base/layout.css');

/* =========================
   COMPONENTS
========================= */
@import url('./components/buttons.css');
@import url('./components/icon-buttons.css');
@import url('./components/search.css');
@import url('./components/tables.css');
@import url('./components/cards.css');
@import url('./components/tags.css');
@import url('./components/amounts.css');
@import url('./components/autocomplete.css');
@import url('./components/modal.css');

/* =========================
   MODULES
========================= */
@import url('./modules/accounts.css');
@import url('./modules/categories.css');
@import url('./modules/loans.css');
@import url('./modules/loan-payments.css');
@import url('./modules/transactions.css');
@import url('./modules/dashboard.css');
@import url('./modules/navbar.css');
@import url('./modules/carousel.css');

/* =========================
   RESPONSIVE (SIEMPRE AL FINAL)
========================= */
@import url('./base/breakpoints.css');
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\css\ui-login.css
```
 
```css
/* ===============================
   Estilos generales del body
=============================== */
body {
  font-family: Arial, sans-serif;
  background-color: #f3f4f6;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  margin: 0;
  font-size: 1rem; /* base responsive */
}

/* ===============================
   Contenedor del login
=============================== */
.login-container {
  background: white;
  padding: 2rem;
  border-radius: 0.5rem;
  box-shadow: 0 0 10px rgba(0,0,0,0.1);
  width: 90%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 1rem; /* espacio entre h1 y form */
}

/* Título centrado */
.login-container h1 {
  text-align: center;
  margin: 0;
  font-size: 1.5rem; /* tamaño adecuado en desktop */
}

/* Formulario apilado verticalmente */
form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem; /* espacio entre inputs y labels */
}

/* Labels */
label {
  font-weight: bold;
  font-size: 1rem;
}

/* Inputs */
input {
  width: 100%;
  padding: 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid #ccc;
  font-size: 1rem;
}

/* Botón */
button {
  padding: 0.5rem;
  background-color: #4f46e5;
  color: white;
  font-weight: bold;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 1rem;
}

button:hover {
  background-color: #4338ca;
}

/* Mensajes de error */
p {
  color: red;
  text-align: center;
  font-size: 0.9rem;
}

/* ===============================
   Media queries para móviles
=============================== */
@media (max-width: 480px) {
  body {
    font-size: 1.1rem; /* aumenta la base para móviles */
  }

  .login-container {
    padding: 1.5rem; /* menos padding para móvil */
    width: 95%;
  }

  .login-container h1 {
    font-size: 1.25rem;
  }

  input, button {
    font-size: 1rem; /* asegura legibilidad */
    padding: 0.6rem;
  }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\css\base\breakpoints.css
```
 
```css
@media (max-width: 768px) {
    
    html {
        font-size: 84%;
    }

    .accounts-mobile,
    .categories-mobile,
    .loans-mobile,
    .payments-mobile {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 8px;
    }

    .navbar-net-balance,
    .navbar-loan_balance {
        font-size: 0.70rem;
        padding: 3px 8px;
        border-radius: 7px;
    }

    .amount-box,
    .number-box {
        font-size: 0.8125rem;
    }

    .amount-currency {
        display: none;
    }

    .ui-table-wrapper {
        display: none;
    }

    .carousel-container {
        padding: 0.5rem;
    }

    .home-slide {
        padding-right: 0rem;
    }

    .home-slide .ui-card-body {
        padding: 0.5rem;
        min-height: auto;
    }

    .ui-kpi-grid.cols-6 {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .ui-kpi-item {
        padding: 0.50rem;
    }

    .ui-kpi-label {
        white-space: normal;
    }

    .ui-kpi-value {
        text-align: right;
        font-variant-numeric: tabular-nums;
        font-weight: 600;
        font-size: normal;
    }

    .ui-toolbar .ui-btn-text,
    .ui-toolbar .btn-text {
        display: none;
    }

    .icon-btn {
        padding: 0.5rem 0.75rem;
    }

    .ui-col-sm,
    .col-sm {
        display: table-cell;
    }

} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\css\base\layout.css
```
 
```css
.ui-container {
    max-width: 64rem;
    margin: 0 auto;
    padding: 0 0.1rem;
}

.ui-page {
    display: flex;
    flex-direction: column;
    height: calc(100vh - 1rem);
}

.ui-header {
    flex-shrink: 0;
}

.ui-scroll-area {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding-bottom: 1rem;
}

.hide {
    display: none;
}

.col-left {
    text-align: left;
}

.col-center {
    text-align: center;
}

.col-right {
    text-align: right;
}

.col-nowrap {
    white-space: nowrap;
}

.col-description {
    white-space: pre-wrap;
    word-break: break-word;
    max-width: 260px;
}

.ui-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 1rem;
}

.ui-toolbar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    flex-wrap: nowrap;
}

.ui-th,
.ui-td {
    padding: 0.4rem 0.7rem;
    font-size: 0.875rem;
    color: var(--ui-gray-700);
}

.ui-th {
    font-weight: 500;
    background: var(--ui-gray-50);
}

#toolbar-normal-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
}

#toolbar-normal-actions .search-box,
#toolbar-normal-actions .search-input-wrapper {
    margin-left: auto;
    flex: 1;
}

#toolbar-normal-actions input[type="search"],
#toolbar-normal-actions input[type="text"] {
    width: 100%;
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\css\base\variables.css
```
 
```css
:root {
    --ui-white: #ffffff;
    
    --ui-gray-900: #111827;
    --ui-gray-700: #374151;
    --ui-gray-500: #6b7280;
    --ui-gray-300: #d1d5db;
    --ui-gray-200: #e5e7eb;
    --ui-gray-100: #f3f4f6;
    --ui-gray-50: #f9fafb;

    --ui-blue-50: #eff6ff;
    --ui-blue-100: #dbeafe;
    --ui-blue-200: #bfdbfe;
    --ui-blue-600: #2563eb;
    --ui-blue-700: #1d4ed8;

    --ui-green-50: #f0fdf4;
    --ui-green-100: #dcfce7;
    --ui-green-300: #86efac;
    --ui-green-600: #047857;
    --ui-green-700: #065f46;
    --ui-green-800: #166534;

    --ui-red-50: #fef2f2;
    --ui-red-200: #fee2e2;
    --ui-red-300: #fca5a5;
    --ui-red-700: #b91c1c;
    --ui-red-800: #991b1b;

    --ui-indigo-100: #e0e7ff;
    --ui-indigo-300: #a5b4fc;
    --ui-indigo-800: #3730a3;

    --ui-purple-50: #faf5ff;
    --ui-purple-100: #ede9fe;
    --ui-purple-300: #c4b5fd;
    --ui-purple-800: #4c1d95;

    --ui-lime-100: #dcedc8;
    --ui-lime-200: #c5e1a5;
    --ui-lime-700: #558b2f;

    --ui-orange-700: #c2410c;
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\css\components\amounts.css
```
 
```css
.amount-box {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    font-size: 0.875rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}

.amount-value {
    text-align: right;
    font-weight: 500;
}

.amount-currency {
    color: var(--ui-gray-500);
    font-size: 0.75rem;
}

.amount-positive {
    color: var(--ui-green-700);
    font-weight: 600;
}

.amount-negative {
    color: var(--ui-red-800);
    font-weight: 600;
}

input[data-balance-target],
input[data-balance-final] {
    background-color: var(--ui-white);
}

.number-box {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 4px;
    font-size: 0.875rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
}

.number-value {
    text-align: right;
    font-weight: 500;
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\css\components\autocomplete.css
```
 
```css
.autocomplete {
    position: relative;
    width: 100%;
    font-family: sans-serif;
}

.autocomplete-panel {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    border: 1px solid var(--ui-gray-300);
    background-color: var(--ui-white);
    max-height: 200px;
    overflow-y: auto;
    display: none;
    z-index: 1000;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

.autocomplete-panel.open {
    display: block;
}

.autocomplete-item {
    padding: 6px 10px;
    cursor: pointer;
    user-select: none;
    line-height: 1.4;
}

.autocomplete-item:hover,
.autocomplete-item.active {
    background-color: var(--ui-gray-100);
}

.autocomplete-item.two-columns {
    display: flex;
    justify-content: space-between;
    gap: 12px;
}

.autocomplete-item .item-label {
    flex: 1;
}

.autocomplete-item .item-balance {
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    font-weight: bold;
    opacity: 0.8;
}

.autocomplete-item .item-balance.positive {
    color: var(--ui-green-800);
}

.autocomplete-item .item-balance.negative {
    color: var(--ui-red-800);
}

.autocomplete-input {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--ui-gray-300);
    border-radius: 4px;
    box-sizing: border-box;
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\css\components\buttons.css
```
 
```css
.ui-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.5rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    cursor: pointer;
    white-space: nowrap;
    background: transparent;
}

.ui-btn svg {
    width: 1.25rem;
    height: 1.25rem;
}

.ui-btn-default {
    background: var(--ui-gray-200);
    color: var(--ui-gray-900);
}

.ui-btn-default:hover {
    background: var(--ui-gray-300);
}

.ui-btn-primary {
    background: var(--ui-blue-600);
    color: var(--ui-white);
}

.ui-btn-primary:hover {
    background: var(--ui-blue-700);
}

.ui-btn-text {
    display: none;
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\css\components\cards.css
```
 
```css
.ui-card {
    background: var(--ui-white);
    border-radius: 1rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
    margin-bottom: 1rem;
    overflow: hidden;
}

.ui-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.25rem;
    cursor: pointer;
    user-select: none;
}

.ui-card-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--ui-gray-900);
}

.ui-card-title .subtitle {
    display: block;
    font-size: 0.9em;
    font-weight: normal;
    opacity: 0.8;
}

.ui-card-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    color: var(--ui-gray-700);
}

.ui-card-body.collapsed {
    display: none;
}

.ui-card-body {
    padding: 0 1.25rem 1.25rem 1.25rem;
}

.ui-card-body.hidden {
    display: none;
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\css\components\icon-buttons.css
```
 
```css
.icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem;
    border-radius: 0.375rem;
    min-height: 2.5rem;
    cursor: pointer;
}

.icon-btn svg {
    width: 1.25rem;
    height: 1.25rem;
    flex-shrink: 0;
    display: block;
}

.btn-text {
    display: none;
    white-space: nowrap;
}

 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\css\components\modal.css
```
 
```css
.ui-modal {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, .4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50
}

.ui-modal.hidden {
    display: none
}

.ui-modal-content {
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 10px 25px rgba(0, 0, 0, .15);
    padding: 1.5rem;
    width: 320px;
    animation: uiFadeIn .15s ease-out
}

@keyframes uiFadeIn {
    from {
        opacity: 0;
        transform: scale(.95)
    }

    to {
        opacity: 1;
        transform: scale(1)
    }
}

.ui-modal-btn {
    padding: .5rem 1rem;
    border-radius: 10px;
    transition: .2s ease;
    font-weight: 500;
    cursor: pointer;
    border: none
}

.ui-modal-btn-primary {
    background: #2563eb;
    color: #fff
}

.ui-modal-btn-primary:hover {
    background: #1d4ed8
}

.ui-modal-btn-success {
    background: #16a34a;
    color: #fff
}

.ui-modal-btn-success:hover {
    background: #15803d
}

.ui-modal-btn-neutral {
    background: #e5e7eb
}

.ui-modal-btn-neutral:hover {
    background: #d1d5db
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\css\components\search.css
```
 
```css
.ui-search {
    position: relative;
    flex: 1;
    min-width: 120px;
}

.ui-search input {
    width: 100%;
    padding-left: 2.5rem;
    padding-right: 2.5rem;
    border: 1px solid var(--ui-gray-300);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    box-sizing: border-box;
}

.ui-search input:focus {
    outline: none;
    border-color: var(--ui-blue-600);
}

.ui-search-clear,
.ui-search-search {
    position: absolute;
    top: 0;
    height: 100%;
    display: flex;
    align-items: center;
    z-index: 2;
}

.ui-search-clear {
    left: 0;
}

.ui-search-search {
    right: 0;
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\css\components\tables.css
```
 
```css
.ui-table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--ui-gray-200);
    border-radius: 0.5rem;
}

.ui-table {
    width: 100%;
    border-collapse: collapse;
}

.ui-table th {
    background: var(--ui-gray-50);
    font-size: 0.875rem;
    font-weight: 500;
    text-align: left;
    color: var(--ui-gray-700);
}

.ui-table th,
.ui-table td {
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--ui-gray-200);
}

.ui-table tr {
    cursor: pointer;
}

.ui-table tr:hover {
    background-color: var(--ui-gray-100);
}

.ui-table tr.tr-selected {
    background-color: var(--ui-blue-100);
}

.ui-table tr.tr-selected:hover {
    background-color: var(--ui-blue-200);
}

.ui-col-sm,
.col-sm {
    display: none;
}

.icon-actions .ui-btn-text {
    display: none;
}

.group-cell {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.group-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
}

.group-name {
    display: flex;
    align-items: center;
}

.child-cell {
    display: flex;
    align-items: center;
}

.child-indent {
    width: 2rem;
    flex-shrink: 0;
}

.child-name {
    display: flex;
    align-items: center;
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\css\components\tags.css
```
 
```css
.ui-table-wrapper {
    overflow-x: auto;
    border: 1px solid var(--ui-gray-200);
    border-radius: 0.5rem;
}

.ui-table {
    width: 100%;
    border-collapse: collapse;
}

.ui-table th {
    background: var(--ui-gray-50);
    font-size: 0.875rem;
    font-weight: 500;
    text-align: left;
    color: var(--ui-gray-700);
}

.ui-table th,
.ui-table td {
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--ui-gray-200);
}

.ui-table tr {
    cursor: pointer;
}

.ui-table tr:hover {
    background-color: var(--ui-gray-100);
}

.ui-table tr.tr-selected {
    background-color: var(--ui-blue-100);
}

.ui-table tr.tr-selected:hover {
    background-color: var(--ui-blue-200);
}

.ui-col-sm,
.col-sm {
    display: none;
}

.icon-actions .ui-btn-text {
    display: none;
}

.tag,
.tx-tag,
.acc-tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem 0.65rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 999px;
  line-height: 1;
  white-space: nowrap;
}

.tx-income {
  background-color: var(--ui-green-100);
  color: var(--ui-green-700);
}

.tx-expense {
  background-color: var(--ui-red-100);
  color: var(--ui-red-700);
}

.tx-transfer {
  background-color: var(--ui-blue-100);
  color: var(--ui-blue-700);
}

.tag-active {
  background-color: var(--ui-green-100);
  color: var(--ui-green-700);
}

.tag-inactive {
  background-color: var(--ui-gray-200);
  color: var(--ui-gray-700);
}

.tag-cash {
  background-color: var(--ui-yellow-100);
  color: var(--ui-yellow-800);
}

.tag-bank {
  background-color: var(--ui-blue-100);
  color: var(--ui-blue-700);
}

.tag-card {
  background-color: var(--ui-purple-100);
  color: var(--ui-purple-700);
}

.tag-saving {
  background-color: var(--ui-teal-100);
  color: var(--ui-teal-700);
}

.tag,
.tx-tag,
.acc-tag {
  border: 1px solid currentColor;
  background-color: transparent;
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\css\modules\accounts.css
```
 
```css
.account-card {
    border: 1px solid var(--ui-gray-200);
    border-radius: 12px;
    padding: 12px;
    background: var(--ui-white);
}

.account-card.card-selected {
    outline: 2px solid var(--ui-blue-600);
    background: var(--ui-blue-50);
}

.account-card.inactive {
    background: var(--ui-red-50);
}

.account-card .icon-btn {
    padding: 0.375rem;
    min-height: auto;
}

.account-card .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.account-card .card-title {
    font-size: 15px;
    font-weight: 600;
}

.account-card .card-balance {
    margin: 8px 0;
    font-size: 25px;
    font-weight: 600;
}

.account-card .card-actions {
    display: flex;
    gap: 4px;
}

.account-card .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: var(--ui-gray-500);
}

.account-card .card-tags {
    display: flex;
    gap: 6px;
    align-items: center;
}

.accounts-mobile {
    display: none;
}

.ui-table-wrapper {
    display: block;
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\css\modules\carousel.css
```
 
```css
.carousel-container {
  position: relative;
  width: 100%;
  padding: 0.5rem;
}

.home-carousel {
  display: flex;
  gap: 0;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
  width: 100%;
  scrollbar-width: none;
}

.home-carousel::-webkit-scrollbar {
  display: none;
}

.home-slide {
  flex: 0 0 100%;
  padding-right: 1rem;
  box-sizing: border-box;
  scroll-snap-align: start;
}

.carousel-nav {
  position: absolute;
  display: flex;
  top: 9%;
  transform: translateY(-50%);
  z-index: 10;
  width: 40px;
  height: 40px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  background-color: white;
  color: #374151;
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0;
  justify-content: center;
  align-items: center;
}

.carousel-nav-prev {
  left: 0.5rem;
}

.carousel-nav-next {
  right: 0.5rem;
}

.carousel-nav:hover:not(:disabled) {
  background-color: #f3f4f6;
  border-color: #9ca3af;
}

.carousel-nav:active:not(:disabled) {
  transform: translateY(-50%) scale(0.95);
}

.carousel-nav:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.carousel-nav svg {
  width: 20px;
  height: 20px;
}

.home-slide .ui-card-body {
  padding: 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 320px;
}

.home-slide .ui-card-header {
  padding: 1.25rem 1.5rem 0 1.5rem;
}

.home-slide .ui-card-title {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.home-slide .subtitle {
  font-size: 0.85rem;
  font-weight: 500;
  opacity: 0.7;
}

.home-slide canvas {
  max-height: 280px;
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\css\modules\categories.css
```
 
```css
.categories-mobile {
    display: none;
}

.category-card {
    border: 1px solid var(--ui-gray-200);
    border-radius: 12px;
    padding: 12px;
    background: var(--ui-white);
}

.category-card.card-selected {
    outline: 2px solid var(--ui-blue-600);
    background: var(--ui-blue-50);
}

.category-card.inactive {
    background: var(--ui-red-50);
}

.category-card .icon-btn {
    padding: 0.375rem;
    min-height: auto;
}

.category-card .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.category-card .card-title {
    font-size: 15px;
    font-weight: 600;
}

.category-card .card-actions {
    display: flex;
    gap: 4px;
}

.category-card .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid var(--ui-gray-200);
    font-size: 12px;
    color: var(--ui-gray-500);
}

.category-card .card-meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;
}

.category-card .card-tags {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
}

.category-group {
    border: 1px solid var(--ui-gray-200);
    border-radius: 12px;
    padding: 8px;
    background: var(--ui-gray-50);
    transition: background-color 0.3s ease;
    text-align: left;
}

.category-group-header {
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0;
    text-align: left;
}

.category-group-header .group-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
}

.category-group-header .group-header-actions {
    display: flex;
    gap: 4px;
}

.category-group-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
}

.category-group.collapsed .category-group-body {
    display: none;
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\css\modules\dashboard.css
```
 
```css
.ui-kpi-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.4rem;
    align-items: stretch;
}

.ui-kpi-grid.cols-2 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ui-kpi-grid.cols-3 {
    grid-template-columns: repeat(3, minmax(0, 1fr));
}

.ui-kpi-grid.cols-4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
}

.ui-kpi-grid.cols-6 {
    grid-template-columns: repeat(6, minmax(0, 1fr));
}

.ui-kpi-item {
    background: var(--ui-gray-50);
    border-radius: 0.75rem;
    padding: 0.3rem;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 60px;
}

.ui-kpi-label {
    font-size: 0.65rem;
    color: var(--ui-gray-500);
    margin-bottom: 0.15rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.ui-kpi-value {
    font-size: 1rem;
    font-weight: 600;
    color: var(--ui-gray-900);
    text-align: right;
    font-variant-numeric: tabular-nums;
    flex: 1;
}

.ui-kpi-green {
    color: var(--ui-green-600);
}

.ui-kpi-trend-green {
    font-size: 0.75rem;
    font-weight: 400;
    text-align: right;
    color: var(--ui-green-600);
}

.ui-kpi-red {
    color: var(--ui-red-700);
}

.ui-kpi-trend-red {
    font-size: 0.75rem;
    font-weight: 400;
    text-align: right;
    color: var(--ui-red-700);
}

.ui-kpi-blue {
    color: var(--ui-blue-700);
}

.ui-kpi-trend-blue {
    font-size: 0.75rem;
    font-weight: 400;
    text-align: right;
    color: var(--ui-blue-700);
}

.ui-kpi-orange {
    color: var(--ui-orange-700);
}

.ui-kpi-trend-orange {
    font-size: 0.75rem;
    font-weight: 400;
    text-align: right;
    color: var(--ui-orange-700);
}

.html-balance-kpi-header-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
}

.html-cash-flow-summary-header-nav,
.html-loan-flow-summary-header-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
}

.html-balance-kpi-year-label,
.html-cash-flow-summary-year-label,
.html-loan-flow-summary-year-label {
    font-size: 1rem;
    font-weight: 600;
    margin: 0;
    white-space: nowrap;
}

.html-balance-kpi-year-btn,
.html-cash-flow-summary-year-btn,
.html-loan-flow-summary-year-btn  {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 50%;
    background: var(--ui-gray-100);
    color: var(--ui-gray-700);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s ease, opacity 0.2s ease;
}

.html-balance-kpi-year-btn:hover:not(:disabled),
.html-cash-flow-summary-year-btn:hover:not(:disabled),
.html-loan-flow-summary-year-btn:hover:not(:disabled)  {
    background: var(--ui-gray-200);
}

.html-balance-kpi-year-btn:disabled,
.html-cash-flow-summary-year-btn:disabled,
.html-loan-flow-summary-year-btn:disabled  {
    opacity: 0.4;
    cursor: not-allowed;
}

.html-balance-kpi-year-btn svg,
.html-cash-flow-summary-year-btn svg,
.html-loan-flow-summary-year-btn svg {
    width: 18px;
    height: 18px;
}

.ui-kpi-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
}

.ui-kpi-values {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}

.ui-kpi-arrow {
    flex: 0 0 auto;
    text-align: right;
    min-width: 20px;
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\css\modules\loan-payments.css
```
 
```css
.payments-mobile {
    display: none;
}

.payment-card {
    border: 1px solid var(--ui-gray-200);
    border-radius: 12px;
    padding: 12px;
    background: var(--ui-white);
}

.payment-card+.payment-card {
    margin-top: 10px;
}

.payment-card .icon-btn {
    padding: 0.375rem;
    min-height: auto;
}

.payment-card {
    position: relative;
}

.payment-card.card-selected::after {
    content: '';
    position: absolute;
    inset: 0;
    border: 2px solid var(--ui-blue-600);
    border-radius: 12px;
    pointer-events: none;
}

.payment-card.card-selected {
    border-color: transparent;
}

.payment-card .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.payment-card .card-datetime {
    display: flex;
    gap: 6px;
    align-items: baseline;
}

.payment-card .card-date {
    font-size: 12px;
    font-weight: 600;
}

.payment-card .card-time {
    font-size: 11px;
    color: var(--ui-gray-500);
}

.payment-card .card-weekday {
    font-size: 11px;
    color: var(--ui-gray-900);
    border: 1px solid var(--ui-primary-500);
    background-color: var(--ui-primary-50);
    padding: 2px 6px;
    border-radius: 6px;
    font-weight: 600;
    line-height: 1;
}

.payment-card .card-title {
    font-size: 14px;
    font-weight: 600;
}

.payment-card .card-actions {
    display: flex;
    gap: 4px;
}

.payment-card .card-body {
    margin: 8px 0;
}

.payment-card .amount-main {
    font-size: 22px;
    font-weight: 600;
}

.payment-card .amount-sub {
    font-size: 12px;
    color: var(--ui-gray-500);
}

.payment-card .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: var(--ui-gray-500);
    margin-top: 6px;
}

.payment-card .payment-amounts {
    display: flex;
    justify-content: space-between;
    gap: 8px;
}

.payment-card .amount-item {
    flex: 1;
}

.payment-card .amount-label {
    font-size: 11px;
    color: var(--ui-gray-500);
    text-align: left;
}

.payment-card .amount-value {
    font-size: 18px;
    font-weight: 600;
    text-align: left;
}

.payment-card .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: var(--ui-gray-500);
    margin-top: 6px;
}

.payment-card .footer-left {
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.payment-card .footer-account {
    font-weight: 600;
    color: var(--ui-gray-700);
}

.payment-card .footer-category {
    font-size: 11px;
}

.payment-card .footer-right {
    display: flex;
    align-items: center;
    gap: 4px;
}

.payment-card .footer-label {
    font-size: 11px;
}

.payment-card .footer-number {
    font-weight: 600;
    color: var(--ui-gray-800);
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\css\modules\loans.css
```
 
```css
.loans-mobile {
    display: none;
}

.loan-card {
    border: 1px solid var(--ui-gray-200);
    border-radius: 12px;
    padding: 12px;
    background: var(--ui-white);
    position: relative;
}

.loan-card.card-selected::after {
    content: '';
    position: absolute;
    inset: 0;
    border: 2px solid var(--ui-blue-600);
    border-radius: 12px;
    pointer-events: none;
}

.loan-card.card-selected {
    border-color: transparent;
}

.loan-card.inactive {
    background: var(--ui-red-50);
}

.loan-card .icon-btn {
    padding: 0.375rem;
    min-height: auto;
}

.loan-card .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.loan-card .card-title {
    font-size: 15px;
    font-weight: 600;
}

.loan-card .card-balance {
    margin: 8px 0;
    font-size: 22px;
    font-weight: 600;
}

.loan-card .card-sub {
    font-size: 12px;
    color: var(--ui-gray-500);
}

.loan-card .card-actions {
    display: flex;
    gap: 4px;
}

.loan-card .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid var(--ui-gray-200);
    font-size: 12px;
    color: var(--ui-gray-500);
}

.loan-card .card-tags {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
}

.loan-card .tag-line {
    text-align: right;
}

.loan-card .tag-line:not(:first-child) {
    font-size: 12px;
    color: var(--ui-gray-500);
}

.loan-group {
    border: 1px solid var(--ui-gray-200);
    border-radius: 12px;
    padding: 8px;
    background: var(--ui-gray-50);
    transition: background-color 0.3s ease;
    text-align: left;
}

.loan-group-header {
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 10px;
    padding: 8px 12px;
    text-align: left;
}

.loan-group-header .group-actions {
    display: flex;
    gap: 4px;
    margin-left: auto;
}

.group-header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
}

.loan-group-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 8px;
}

.loan-group.collapsed .loan-group-body {
    display: none;
}

.group-title {
    font-weight: 600;
}

.group-pending {
    font-weight: 600;
    color: #0f172a;
}

.parent-row .group-pending {
    text-align: right;
}

.loan-card .date-block {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
}

.loan-card .weekday-text {
    color: var(--ui-gray-500);
}

.loan-card .loan-amounts {
    display: flex;
    justify-content: space-between;
    gap: 8px;
}

.loan-card .loan-amount-item {
    flex: 1;
}

.loans-group-header-left {
    display: flex;
    align-items: center;
}

.loans-group-center {
    display: flex;
    flex-direction: column;
    justify-content: center;
    margin-left: 8px;
}

.loans-group-title {
    font-weight: 600;
    line-height: 1.2;
}

.loans-group-pending {
    font-size: 12px;
    font-weight: 500;
    opacity: 0.85;
    line-height: 1.1;
}

.loans-group-actions {
    display: flex;
    gap: 4px;
    margin-left: auto;
    align-items: center;
}

.loan-name-block {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
}

.loan-name {
    font-weight: 500;
}

.loan-date {
    font-size: 12px;
    color: var(--ui-gray-500);
}

.loan-card .loan-amounts {
    display: flex;
    gap: 8px;
}

.loan-card .loan-amount-item {
    flex: 1;
    display: flex;
    flex-direction: column;
}

.loan-card .loan-amount-title {
    text-align: left;
    font-size: 11px;
    color: var(--ui-gray-500);
}

.loan-card .loan-amount-value {
    font-weight: 600;
    font-size: 13px;
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\css\modules\navbar.css
```
 
```css
.navbar-net-balance {
    display: inline-block;
    margin-left: 12px;
    padding: 5px 12px;
    font-size: 0.85rem;
    font-weight: 600;
    color: #ffffff;
    border: 1px solid transparent;
    border-radius: 10px;
    letter-spacing: 0.3px;
    transition: all 0.2s ease;
}

.navbar-net-balance.positive {
    background-color: #16a34a;
    border-color: #15803d;
}

.navbar-net-balance.negative {
    background-color: #dc2626;
    border-color: #b91c1c;
}

.navbar-net-balance:hover {
    opacity: 0.9;
    transform: translateY(-1px);
}

.navbar-loan_balance {
    display: inline-block;
    margin-left: 12px;
    padding: 5px 12px;
    font-size: 0.85rem;
    font-weight: 600;
    color: #ffffff;
    background-color: #dc2626;
    border: 1px solid #b91c1c;
    border-radius: 10px;
    letter-spacing: 0.3px;
    transition: all 0.2s ease;
}

.navbar-loan_balance:hover {
    opacity: 0.9;
    transform: translateY(-1px);
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\css\modules\transactions.css
```
 
```css
.transaction-card {
    position: relative;
    border: 1px solid var(--ui-gray-200);
    border-radius: 10px;
    padding: 8px 10px;
    background: var(--ui-white);
}

.transaction-card+.transaction-card {
    margin-top: 6px;
}

.transaction-card.card-selected::after {
    content: '';
    position: absolute;
    inset: 0;
    border: 2px solid var(--ui-blue-600);
    border-radius: 10px;
    pointer-events: none;
}

.transaction-card.card-selected {
    border-color: transparent;
}

.transaction-card.income {
    background: var(--ui-green-50);
}

.transaction-card.expense {
    background: var(--ui-red-50);
}

.transaction-card.transfer {
    background: var(--ui-purple-50);
}

.transaction-card .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 4px;
}

.transaction-card .card-datetime {
    display: flex;
    gap: 6px;
    align-items: baseline;
}

.transaction-card .card-date {
    font-size: 12px;
    font-weight: 600;
}

.transaction-card .card-time {
    font-size: 11px;
    color: var(--ui-gray-500);
}

.transaction-card .card-weekday {
    font-size: 11px;
    color: var(--ui-gray-900);
    border: 1px solid var(--ui-primary-500);
    background-color: var(--ui-primary-50);
    padding: 2px 6px;
    border-radius: 6px;
    font-weight: 600;
    line-height: 1;
}

.transaction-card .card-actions {
    display: flex;
    gap: 4px;
}

.transaction-card .icon-btn {
    padding: 0.25rem;
    min-height: auto;
}

.transaction-card .card-content {
    display: flex;
    justify-content: space-between;
    gap: 8px;
}

.transaction-card .card-info {
    flex: 1;
    min-width: 0;
}

.transaction-card .card-account {
    font-size: 12px;
    font-weight: 500;
    line-height: 1.2;
}

.transaction-card .card-category {
    font-size: 10px;
    color: var(--ui-gray-500);
    line-height: 1.2;
}

.transaction-card .card-description {
    margin-top: 2px;
    font-size: 11px;
    font-style: italic;
    color: var(--ui-gray-500);
    line-height: 1.2;
    white-space: pre-line;
}

.transaction-card .card-amount {
    display: flex;
    align-items: center;
    font-size: 20px;
    font-weight: 700;
    white-space: nowrap;
}

.grouped-icon-line {
    display: flex;
    align-items: center;
    gap: 6px;
    line-height: 1.2;
    white-space: nowrap;
}

.grouped-icon-line+.grouped-icon-line {
    margin-top: 4px;
}

.grouped-icon {
    display: flex;
    align-items: center;
}

.transaction-card-detail.hidden {
  display: none;
}

.transaction-card-detail {
  margin-top: 8px;
  padding: 8px 10px;

  background: rgba(255, 255, 255, 0.5);

  border: 1px solid var(--ui-gray-200);
  border-radius: 8px;

  font-size: 11px;
  line-height: 1.4;
  color: var(--ui-gray-700);

  white-space: pre-line;
  word-break: break-word;
}

.transaction-detail-row.hidden {
  display: none;
}

.transaction-detail-row td {
  padding: 10px 14px;
  background: var(--ui-gray-50);

  font-size: 12px;
  line-height: 1.4;
  color: var(--ui-gray-700);

  border-top: 1px solid var(--ui-gray-200);
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\forms\account-form.js
```
 
```js
/*
  category-form.js

  Archivo intencionalmente vacío de lógica.
  Este formulario es procesado completamente por el backend.

  Responsabilidades del backend:
  - Validación de campos
  - Control de modos (insert / update / status)
  - Persistencia en base de datos
  - Manejo de errores y mensajes

  Este archivo existe solo para:
  - Mantener coherencia estructural del proyecto
  - Facilitar futuras extensiones (si fueran necesarias)
*/

document.addEventListener('DOMContentLoaded', () => {
  /* 
    No se requiere lógica de frontend para este formulario.
    El submit es tradicional (POST) y el backend controla el flujo.
  */
})
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\forms\autocomplete-form.js
```
 
```js
document.addEventListener('DOMContentLoaded', () => {
    initAutocompletes()
})

function initAutocompletes() {
    document.querySelectorAll('.autocomplete').forEach(container => {
        setupAutocomplete(container)
    })

    document.addEventListener('click', event => {
        document.querySelectorAll('.autocomplete-panel.open').forEach(panel_el => {
            if (!panel_el.parentElement.contains(event.target)) {
                closePanel(panel_el)
            }
        })
    })
}

function setupAutocomplete(container) {
    const input_el = container.querySelector('.autocomplete-input')
    const hidden_el = container.querySelector('.autocomplete-hidden')
    const panel_el = container.querySelector('.autocomplete-panel')

    if (!input_el || !hidden_el || !panel_el) return

    const items_raw = container.getAttribute('data-items') || '[]'
    const items = JSON.parse(items_raw)
    const default_id = container.getAttribute('data-default-id') || ''
    const placeholder_text = container.getAttribute('data-placeholder') || '-- Escoja una opción --'

    input_el.placeholder = placeholder_text

    let filtered_items = items
    let active_index = -1

    if (default_id) {
        const default_item = items.find(it => String(it.id) === String(default_id))
        if (default_item) {
            setInputValue(default_item, input_el)
            hidden_el.value = default_item.id
        }
    }

    input_el.addEventListener('focus', () => {
        filtered_items = items
        active_index = -1
        renderPanel(panel_el, filtered_items)
        openPanel(panel_el)
    })

    input_el.addEventListener('input', () => {
        const query = input_el.value.toLowerCase()
        filtered_items = items.filter(it => String(it.name || '').toLowerCase().includes(query))
        active_index = -1
        renderPanel(panel_el, filtered_items)
        openPanel(panel_el)
    })

    input_el.addEventListener('keydown', event => {
        if (!panel_el.classList.contains('open')) return

        if (event.key === 'ArrowDown') {
            event.preventDefault()
            active_index = Math.min(active_index + 1, filtered_items.length - 1)
            updateActiveItem(panel_el, active_index)
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault()
            active_index = Math.max(active_index - 1, 0)
            updateActiveItem(panel_el, active_index)
        }

        if (event.key === 'Enter') {
            event.preventDefault()
            if (active_index >= 0 && filtered_items[active_index]) {
                selectItem(filtered_items[active_index], input_el, hidden_el, panel_el)
            }
        }

        if (event.key === 'Escape') {
            closePanel(panel_el)
        }
    })

    panel_el.addEventListener('click', event => {
        const item_el = event.target.closest('.autocomplete-item')
        if (!item_el) return

        const item_index = Number(item_el.getAttribute('data-index'))
        const item = filtered_items[item_index]

        if (!item) return

        selectItem(item, input_el, hidden_el, panel_el)
    })
}

function renderPanel(panel_el, items) {
    panel_el.innerHTML = ''

    if (items.length === 0) {
        const empty_el = document.createElement('div')
        empty_el.className = 'autocomplete-item'
        empty_el.textContent = 'Sin resultados'
        panel_el.appendChild(empty_el)
        return
    }

    items.forEach((it, index) => {
        const item_el = document.createElement('div')
        item_el.className = 'autocomplete-item'
        item_el.setAttribute('data-index', index)

        const has_balance = typeof it.balance === 'number'

        if (has_balance) {
            item_el.classList.add('two-columns')

            const name_el = document.createElement('div')
            name_el.className = 'item-label'
            name_el.textContent = it.name || ''

            const balance_el = document.createElement('div')
            balance_el.className = 'item-balance'
            balance_el.textContent = formatBalance(it.balance)

            // color según valor
            balance_el.classList.add(it.balance > 0 ? 'positive' : 'negative')

            item_el.appendChild(name_el)
            item_el.appendChild(balance_el)
        } else {
            item_el.textContent = it.name || ''
        }

        panel_el.appendChild(item_el)
    })
}

function updateActiveItem(panel_el, active_index) {
    const items_el = panel_el.querySelectorAll('.autocomplete-item')

    items_el.forEach(el => el.classList.remove('active'))

    const active_el = items_el[active_index]
    if (active_el) {
        active_el.classList.add('active')
        active_el.scrollIntoView({ block: 'nearest' })
    }
}

function selectItem(item, input_el, hidden_el, panel_el) {
    setInputValue(item, input_el)
    hidden_el.value = item.id

    hidden_el.dispatchEvent(new Event('change'))

    closePanel(panel_el)
}


function setInputValue(item, input_el) {
    if (typeof item.balance === 'number') {
        input_el.value = `${item.name} (${formatBalance(item.balance)})`
        // opcional: color general según balance
        input_el.style.color = item.balance > 0 ? 'green' : 'red'
    } else {
        input_el.value = item.name || ''
        input_el.style.color = 'inherit'
    }
}

function openPanel(panel_el) {
    panel_el.classList.add('open')
}

function closePanel(panel_el) {
    panel_el.classList.remove('open')
}

function formatBalance(value) {
    const number_value = Number(value) || 0
    return number_value.toFixed(2)
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\forms\category-form.js
```
 
```js
document.addEventListener('DOMContentLoaded', () => {
  // ============================
  // Toggle "Es categoría padre"
  // ============================
  const checkbox = document.getElementById('is-parent-checkbox')
  const typeContainer = document.getElementById('type-container')
  const parentContainer = document.getElementById('parent-container')
  const typeRadios = document.querySelectorAll('input[name="type"]')
  const parentInputHidden = parentContainer?.querySelector('input[name="parent_id"]')
  const parentInputText = parentContainer?.querySelector('input[data-autocomplete-input]')

  function ensureTypeSelected() {
    const hasChecked = [...typeRadios].some(r => r.checked)
    if (!hasChecked && typeRadios.length) {
      typeRadios[0].checked = true
    }
  } 

  function toggleParentMode() {
    if (!typeContainer || !parentContainer || !checkbox) return

    if (checkbox.checked) {
      typeContainer.style.display = 'none'
      parentContainer.style.display = 'none'
      if (parentInputHidden) parentInputHidden.value = ''
      if (parentInputText) parentInputText.value = ''
      ensureTypeSelected()
    } else {
      typeContainer.style.display = 'block'
      parentContainer.style.display = 'block'
    }
  }

  if (checkbox) {
    checkbox.addEventListener('change', toggleParentMode)
    toggleParentMode()
  }

  // ============================
  // Autocomplete
  // ============================
  document.querySelectorAll('[data-autocomplete]').forEach(container => {
    const input = container.querySelector('[data-autocomplete-input]')
    const hidden = container.querySelector('[data-autocomplete-hidden]')
    const list = container.querySelector('[data-autocomplete-list]')

    if (!input || !hidden || !list) return

    input.addEventListener('focus', () => list.classList.remove('hidden'))

    input.addEventListener('input', () => {
      const value = input.value.toLowerCase()
      let visibleCount = 0

      list.querySelectorAll('[data-autocomplete-item]').forEach(item => {
        const match = item.dataset.label.toLowerCase().includes(value)
        item.style.display = match ? '' : 'none'
        if (match) visibleCount++
      })

      list.style.display = visibleCount ? '' : 'none'
    })

    list.querySelectorAll('[data-autocomplete-item]').forEach(item => {
      item.addEventListener('click', () => {
        input.value = item.dataset.label
        hidden.value = item.dataset.id
        list.classList.add('hidden')
      })
    })

    document.addEventListener('click', e => {
      if (!container.contains(e.target)) list.classList.add('hidden')
    })
  })
})
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\forms\category-group-form.js
```
 
```js
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\forms\loan-form.js
```
 
```js
document.addEventListener('DOMContentLoaded', () => {
  const checkbox = document.getElementById('is-parent-checkbox')
  if (!checkbox) return

  const form = checkbox.closest('form')

  function toggleParentMode() {
    const isParent = checkbox.checked

    const fields = Array.from(form.querySelectorAll('.mb-4'))

    fields.forEach(field => {
      if (field.contains(checkbox)) return

      const nameInput = field.querySelector('input[name="name"]')

      if (isParent) {
        if (nameInput) {
          field.style.display = 'block'
        } else {
          field.style.display = 'none'
        }
      } else {
        field.style.display = 'block'
      }
    })

    const parentContainer = document.getElementById('parent-container')
    if (isParent && parentContainer) {
      const parentHidden = parentContainer.querySelector('input[name="parent_id"]')
      const parentText = parentContainer.querySelector('input[data-autocomplete-input]')
      if (parentHidden) parentHidden.value = ''
      if (parentText) parentText.value = ''
    }
  }

  checkbox.addEventListener('change', toggleParentMode)
  toggleParentMode()

  // ============================
  // Autocomplete (igual que Categories)
  // ============================
  document.querySelectorAll('[data-autocomplete]').forEach(container => {
    const input = container.querySelector('[data-autocomplete-input]')
    const hidden = container.querySelector('[data-autocomplete-hidden]')
    const list = container.querySelector('[data-autocomplete-list]')

    if (!input || !hidden || !list) return

    input.addEventListener('focus', () => {
      list.classList.remove('hidden')
    })

    input.addEventListener('input', () => {
      const value = input.value.toLowerCase()
      let visibleCount = 0

      hidden.value = ''

      list.querySelectorAll('[data-autocomplete-item]').forEach(item => {
        const label = (item.dataset.label || '').toLowerCase()
        const match = label.includes(value)
        item.style.display = match ? '' : 'none'
        if (match) visibleCount++
      })

      if (visibleCount) list.classList.remove('hidden')
      else list.classList.add('hidden')
    })

    list.querySelectorAll('[data-autocomplete-item]').forEach(item => {
      item.addEventListener('click', () => {
        input.value = item.dataset.label || ''
        hidden.value = item.dataset.id || ''
        list.classList.add('hidden')
      })
    })

    document.addEventListener('click', e => {
      if (!container.contains(e.target)) {
        list.classList.add('hidden')
      }
    })
  })
})
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\forms\loan-payment-form.js
```
 
```js
/*
  category-form.js

  Archivo intencionalmente vacío de lógica.
  Este formulario es procesado completamente por el backend.

  Responsabilidades del backend:
  - Validación de campos
  - Control de modos (insert / update / status)
  - Persistencia en base de datos
  - Manejo de errores y mensajes

  Este archivo existe solo para:
  - Mantener coherencia estructural del proyecto
  - Facilitar futuras extensiones (si fueran necesarias)
*/

document.addEventListener('DOMContentLoaded', () => {
  /* 
    No se requiere lógica de frontend para este formulario.
    El submit es tradicional (POST) y el backend controla el flujo.
  */
})
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\forms\transactions-form.js
```
 
```js
document.addEventListener('DOMContentLoaded', () => {
  const originalType = document.getElementById('original-transaction-type')?.value || ''

  const radios = document.querySelectorAll('input[name="type"]')

  /* Bloque Cuenta destino */
  const toAccountHiddenInput = document.querySelector('input[name="to_account"]')
  const toAccountBlock = toAccountHiddenInput?.closest('.mb-4')

  /* Bloque Categoría */
  const categoryHiddenInput = document.querySelector('input[name="category"]')
  const categoryBlock = categoryHiddenInput?.closest('.mb-4')

  /* Bloque Cuenta origen */
  /* Bloque Cuenta origen */
  const accountHiddenInput = document.querySelector('input[name="account"]')
  const accountAutocomplete = accountHiddenInput?.closest('.autocomplete')

  const transferAccountItems =
    document.querySelector('input[name="to_account"]')
      ?.closest('.autocomplete')
      ?.dataset.items

  const originalAccountItems = accountAutocomplete?.dataset.items


  const categoryAutocomplete = categoryBlock?.querySelector('.autocomplete')
  const categoryTextInput = categoryBlock?.querySelector('.autocomplete-input')
  const categoryHiddenInputReal = categoryBlock?.querySelector('.autocomplete-hidden')

  function lockRadiosByOriginalType() {
    if (!originalType) return

    radios.forEach(radio => {
      if (originalType === 'transfer' && radio.value !== 'transfer') {
        radio.disabled = true
      }

      if (
        (originalType === 'income' || originalType === 'expense') &&
        radio.value === 'transfer'
      ) {
        radio.disabled = true
      }
    })
  }

  function updateCategorySource(type) {
    if (!categoryAutocomplete) return

    if (type === 'income') {
      categoryAutocomplete.dataset.items = categoryAutocomplete.dataset.itemsIncome
    } else if (type === 'expense') {
      categoryAutocomplete.dataset.items = categoryAutocomplete.dataset.itemsExpense
    }

    reloadCategoryAutocomplete()
  }

  function clearCategory() {
    if (categoryTextInput) categoryTextInput.value = ''
    if (categoryHiddenInputReal) categoryHiddenInputReal.value = ''
  }

  function clearToAccount() {
    if (toAccountHiddenInput) toAccountHiddenInput.value = ''
  }

  function updateAccountSource(type) {
    if (!accountAutocomplete) return

    if (type === 'transfer') {
      accountAutocomplete.dataset.items = transferAccountItems
    } else {
      accountAutocomplete.dataset.items = originalAccountItems
    }

    reloadAccountAutocomplete()
  }

  function updateVisibility(type) {
    updateAccountSource(type)

    if (toAccountBlock) {
      if (type === 'transfer') {
        toAccountBlock.style.display = ''
      } else {
        toAccountBlock.style.display = 'none'
        clearToAccount()
      }
    }

    if (categoryBlock) {
      if (type === 'transfer') {
        categoryBlock.style.display = 'none'
        clearCategory()
      } else {
        categoryBlock.style.display = ''
        updateCategorySource(type)
      }
    }
  }

  function reloadCategoryAutocomplete() {
    if (!categoryAutocomplete) return

    const input_el = categoryAutocomplete.querySelector('.autocomplete-input')
    const hidden_el = categoryAutocomplete.querySelector('.autocomplete-hidden')
    const panel_el = categoryAutocomplete.querySelector('.autocomplete-panel')

    if (!input_el || !hidden_el || !panel_el) return

    input_el.value = ''
    hidden_el.value = ''
    panel_el.innerHTML = ''

    // volver a inicializar SOLO este autocomplete
    // revisar la invocación global de setupAutocomplete en "src/public/js/forms/autocomplete-form.js" para evitar conflictos
    setupAutocomplete(categoryAutocomplete)
  }

  function reloadAccountAutocomplete() {
    if (!accountAutocomplete) return

    const input_el = accountAutocomplete.querySelector('.autocomplete-input')
    const hidden_el = accountAutocomplete.querySelector('.autocomplete-hidden')
    const panel_el = accountAutocomplete.querySelector('.autocomplete-panel')

    if (!input_el || !hidden_el || !panel_el) return

    input_el.value = ''
    hidden_el.value = ''
    panel_el.innerHTML = ''

    setupAutocomplete(accountAutocomplete)
  }

  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      updateVisibility(radio.value)
    })
  })

  lockRadiosByOriginalType()

  const checked = document.querySelector('input[name="type"]:checked')
  if (checked) {
    updateVisibility(checked.value)
  }
})
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\helpers\amount-helper.js
```
 
```js
function amountBox(value) {
  const amount = Number(value || 0).toFixed(2)

  return `
    <div class="amount-box">
      <span class="amount-value">${amount}</span>
    </div>
  `
}

function numberBox(value) {
  const number = Number(value || 0).toFixed(0)

  return `
    <div class="number-box">
      <span class="number-value">${number}</span>
    </div>
  `
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\helpers\autocomplete-helper.js
```
 
```js
// Inicializa todos los autocompletados de la página
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-autocomplete]').forEach(initAutocomplete)
})

function initAutocomplete(container) {
  const input = container.querySelector('[data-autocomplete-input]')
  const hidden = container.querySelector('[data-autocomplete-hidden]')
  const lists = Array.from(container.querySelectorAll('[data-autocomplete-list]'))
  const balanceDisplay = container.querySelector('[data-autocomplete-display-balance]')
  const balanceTarget = container.querySelector('[data-balance-target]')
  const fieldName = container.getAttribute('data-field') || ''

  if (!input || !hidden || lists.length === 0) return

  /* ================================
     LISTA ACTIVA (SIMPLE / MULTIPLE)
  ================================= */

  function getActiveList() {
    if (lists.length === 1) {
      return lists[0]
    }

    return lists.find(l => l.dataset.active === '1') || null
  }

  function getItems() {
    const list = getActiveList()
    if (!list) return []
    return Array.from(list.querySelectorAll('[data-autocomplete-item]'))
  }

  function hideAllLists() {
    lists.forEach(l => l.classList.add('hidden'))
  }

  /* ================================
     EVENTOS INPUT
  ================================= */

  input.addEventListener('focus', () => {
    hideAllLists()
    const list = getActiveList()
    if (list) {
      list.classList.remove('hidden')
    }
  })

  input.addEventListener('input', () => {
    const value = input.value.toLowerCase().trim()
    const list = getActiveList()
    const items = getItems()

    let visibleCount = 0

    items.forEach(item => {
      const label = item.dataset.label.toLowerCase()
      const visible = label.includes(value)

      item.style.display = visible ? '' : 'none'
      if (visible) visibleCount++
    })

    if (list) {
      list.classList.toggle('hidden', visibleCount === 0)
    }
  })

  /* ================================
     CLICK EN ITEM
  ================================= */

  lists.forEach(list => {
    const items = Array.from(list.querySelectorAll('[data-autocomplete-item]'))

    items.forEach(item => {
      item.addEventListener('click', () => {
        const label = item.dataset.label
        const bal =
          item.dataset.balance !== undefined ? Number(item.dataset.balance) : null

        input.value = label
        hidden.value = item.dataset.id

        if (balanceDisplay) {
          balanceDisplay.textContent = bal !== null ? bal.toFixed(2) : ''
          balanceDisplay.classList.toggle('amount-positive', bal > 0)
          balanceDisplay.classList.toggle('amount-negative', bal <= 0)
        }

        if (balanceTarget) {
          balanceTarget.value = bal !== null ? bal.toFixed(2) : ''
          balanceTarget.classList.toggle('amount-positive', bal > 0)
          balanceTarget.classList.toggle('amount-negative', bal <= 0)
        }

        if (fieldName === 'account' || fieldName === 'to_account') {
          document.dispatchEvent(
            new CustomEvent('account:balance', {
              detail: { balance: bal, field: fieldName }
            })
          )
        }

        if (fieldName === 'parent') {
          document.dispatchEvent(
            new CustomEvent('category:parentSelected', {
              detail: { id: item.dataset.id, label: item.dataset.label }
            })
          )
        }

        hideAllLists()
      })
    })
  })

  /* ================================
     CLICK FUERA
  ================================= */

  document.addEventListener('click', e => {
    if (!container.contains(e.target)) {
      hideAllLists()
    }
  })

  /* ================================
     INIT MODO EDICIÓN
  ================================= */

  if (hidden.value) {
    const items = lists.flatMap(l =>
      Array.from(l.querySelectorAll('[data-autocomplete-item]'))
    )

    const found = items.find(i => i.dataset.id === hidden.value)
    if (!found) return

    const bal =
      found.dataset.balance !== undefined ? Number(found.dataset.balance) : null

    if (balanceDisplay) {
      balanceDisplay.textContent = bal !== null ? bal.toFixed(2) : ''
      balanceDisplay.classList.toggle('amount-positive', bal > 0)
      balanceDisplay.classList.toggle('amount-negative', bal <= 0)
    }

    if (fieldName === 'account' || fieldName === 'to_account' || fieldName === 'disbursement_account') {
      document.dispatchEvent(
        new CustomEvent('account:balance', {
          detail: { balance: bal, field: fieldName }
        })
      )
    }
  }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\helpers\format-datetime-helper.js
```
 
```js
function formatDateTime(value) {
    if (!value || typeof value !== 'string') {
        return { date: '', time: '', weekday: '', tag: '' }
    }

    const d = new Date(value)

    const timeZone = window.TIMEZONE || 'America/Guayaquil'

    const parts = new Intl.DateTimeFormat('es-EC', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'long',
        hour12: false
    }).formatToParts(d)

    const get = t => parts.find(p => p.type === t)?.value

    const date = `${get('year')}-${get('month')}-${get('day')}`
    const time = `${get('hour')}:${get('minute')}`
    const weekday = get('weekday') || ''

    return {
        date,
        time,
        weekday,
    }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\helpers\icon-helper.js
```
 
```js
/* ============================
   Íconos SVG reutilizables
============================ */

/* Insertar / Nuevo */
function iconInsert() {
    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  `
}

/* Editar */
function iconEdit() {
    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4Z"/>
    </svg>
  `
}

/* Clonar */
function iconClone() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/>
      <rect x="2" y="2" width="13" height="13" rx="2"/>
    </svg>
  `
}

/* Eliminar */
function iconDelete() {
    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6 17.5 20H6.5L5 6"/>
      <path d="M10 11v6"/>
      <path d="M14 11v6"/>
    </svg>
  `
}

/* Ver / Ojo */
function iconView() {
    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  `
}

/* Oculto / Ojo cruzado */
function iconViewOff() {
    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <path d="M17.94 17.94C16.23 19.21 14.21 20 12 20
        5 20 1 12 1 12a21.77 21.77 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4
        c7 0 11 8 11 8a21.94 21.94 0 0 1-2.88 4.88"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M14.12 14.12a3 3 0 0 1-4.24-4.24"/>
    </svg>
  `
}

/* Lista / Detalles */
function iconList() {
    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <circle cx="3" cy="6" r="1"/>
      <circle cx="3" cy="12" r="1"/>
      <circle cx="3" cy="18" r="1"/>
    </svg>
  `
}

/* Refrescar / Recargar */
function iconRefresh() {
    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10"/>
      <path d="M20.49 15a9 9 0 0 1-14.13 3.36L1 14"/>
    </svg>
  `
}

/* ============================
   Flechas navegación
============================ */

/* Flecha derecha (siguiente / avanzar) */
function iconArrowRight({ size = 4, color = 'currentColor' } = {}) {
    return `
    <svg class="w-${size} h-${size}" fill="none" stroke="${color}" stroke-width="2"
      viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  `
}

/* Flecha izquierda (anterior / retroceder) */
function iconArrowLeft({ size = 4, color = 'currentColor' } = {}) {
    return `
    <svg class="w-${size} h-${size}" fill="none" stroke="${color}" stroke-width="2"
      viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
  `
}

/* Chevron abierto */
function iconChevronOpen() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" width="24" height="24">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  `;
}

/* Chevron cerrado */
function iconChevronClose() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" width="24" height="24">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  `;
}

/* ============================
   Iconos transferencia
============================ */

/* Origen (sale dinero) */
function iconTransferOut() {
  return iconArrowLeft({ size: 3, color: '#dc2626' })
}

/* Destino (entra dinero) */
function iconTransferIn() {
  return iconArrowRight({ size: 3, color: '#16a34a' })
}

function iconCarouselPrev() {
  return `
    <svg width="20" height="20" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  `
}

function iconCarouselNext() {
  return `
    <svg width="20" height="20" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  `
}

/* Grupo / Agrupación */
function iconGroup({ size = 4, color = 'currentColor' } = {}) {
  return `
    <svg class="w-${size} h-${size}" fill="none" stroke="${color}" stroke-width="2"
      viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M3 7h18M6 12h12M9 17h6"/>
    </svg>
  `
}

function iconGrouped() {
  return iconGroup({ size: 3, color: '#1c1fdb' })
}

function iconTrendUp() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="#16a34a" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 17 9 11 13 15 21 7"/>
      <polyline points="14 7 21 7 21 14"/>
    </svg>
  `
}

function iconTrendDown() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="#dc2626" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 7 9 13 13 9 21 17"/>
      <polyline points="14 17 21 17 21 10"/>
    </svg>
  `
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\helpers\logger-helper.js
```
 
```js
// Logger para navegador
// Uso: log.info('mensaje'), log.error('mensaje', data)

(function (window) {

  const DEBUG = true

  function format(level, message, data) {
    const time = new Date().toISOString()
    return { time, level, message, data }
  }

  const log = {

    info(message, data = null) {
      if (!DEBUG) return
      console.log(format('INFO', message, data))
    },

    warn(message, data = null) {
      console.warn(format('WARN', message, data))
    },

    error(message, data = null) {
      console.error(format('ERROR', message, data))
    },

    debug(message, data = null) {
      if (!DEBUG) return
      console.debug(format('DEBUG', message, data))
    }

  }

  window.log = log

})(window)
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\helpers\message-box-helper.js
```
 
```js
class MessageBox {

  static success(message) {
    this.show(message, 'bg-green-600')
  }

  static error(message) {
    this.show(message, 'bg-red-600')
  }

  static show(message, bgClass) {
    const container = document.getElementById('message-container')

    const box = document.createElement('div')
    box.className = `${bgClass} text-white px-4 py-3 rounded shadow mb-2`
    box.style.minWidth = '260px'

    let seconds = 10

    const text = document.createElement('div')
    text.textContent = `${message} (${seconds}s)`
    box.appendChild(text)

    container.appendChild(box)

    const interval = setInterval(() => {
      seconds--
      text.textContent = `${message} (${seconds}s)`

      if (seconds <= 0) {
        clearInterval(interval)
        box.remove()
      }
    }, 1000)
  }
}

window.MessageBox = MessageBox
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\helpers\status-toggle-helper.js
```
 
```js
/* ============================
   Status Filter Toggle Button
============================ */

/* Ciclo de estados */
const STATUS_FILTER_CYCLE = ['all', 'active', 'inactive']

/* Configuración por estado */
const STATUS_FILTER_CONFIG = {
  all: {
    label: 'Todos',
    icon: iconList
  },
  active: {
    label: 'Activos',
    icon: iconView
  },
  inactive: {
    label: 'Inactivos',
    icon: iconViewOff
  }
}

/* Render del botón */
function renderStatusFilterToggle(button, status) {

  const config = STATUS_FILTER_CONFIG[status]
  if (!config) return

  button.dataset.status = status

  const iconContainer = button.querySelector('.ui-btn-icon')
  const textContainer = button.querySelector('.ui-btn-text')

  if (iconContainer) {
    iconContainer.innerHTML = config.icon()
  }

  if (textContainer) {
    textContainer.textContent = config.label
  }
}

/* Inicialización */
document.addEventListener('DOMContentLoaded', () => {

  document.querySelectorAll('.js-status-filter-toggle').forEach(button => {

    renderStatusFilterToggle(button, button.dataset.status)

    button.addEventListener('click', () => {

      const current = button.dataset.status
      const index = STATUS_FILTER_CYCLE.indexOf(current)
      const next = STATUS_FILTER_CYCLE[(index + 1) % STATUS_FILTER_CYCLE.length]

      renderStatusFilterToggle(button, next)

      saveFilters(STATUS_FILTER_KEY, { status: next })

      if (typeof applyStatusFilter === 'function') {
        applyStatusFilter(next)
      }
    })
  })
})

document.addEventListener('status-filter-change', (event) => {

  const { status } = event.detail

  document.querySelectorAll('.js-status-filter-toggle')
    .forEach(button => {
      renderStatusFilterToggle(button, status)
    })
})
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\helpers\storage-helper.js
```
 
```js
function saveFilters(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

function loadFilters(key) {
  const raw = localStorage.getItem(key)
  return raw ? JSON.parse(raw) : null
}

function clearFilters(key) {
  localStorage.removeItem(key)
}

/* Exponer globalmente */
window.saveFilters = saveFilters
window.loadFilters = loadFilters
window.clearFilters = clearFilters
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\helpers\timezone-helper.js
```
 
```js
/* ============================================================================
   Timezone helper
   Inyecta el timezone del navegador en todos los formularios
============================================================================ */

(function () {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  document.addEventListener('submit', function (e) {
    const form = e.target
    if (!(form instanceof HTMLFormElement)) return

    if (!form.querySelector('input[name="timezone"]')) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = 'timezone'
      input.value = timezone
      form.appendChild(input)
    }
  })
})()
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\helpers\type-tags-helper.js
```
 
```js
function transactionTypeTag(type) {
  switch (type) {
    case 'income':
      return `
        <div class="tx-tag tx-income">
          Ingresos
        </div>
      `
    case 'expense':
      return `
        <div class="tx-tag tx-expense">
          Egresos
        </div>
      `
    case 'transfer':
      return `
        <div class="tx-tag tx-transfer">
          Transferencias
        </div>
      `
    default:
      return `<div class="tx-tag">-</div>`
  }
}

function statusTag(isActive) {
  if (isActive) {
    return `<div class="tag tag-active">Activo</div>`
  }

  return `<div class="tag tag-inactive">Inactivo</div>`
}

// type!: 'cash' | 'bank' | 'card' | 'saving'
function accountTypeTag(type) {
  switch (type) {
    case 'cash':
      return `<div class="acc-tag tag-cash">Efectivo</div>`
    case 'bank':
      return `<div class="acc-tag tag-bank">Banco</div>`
    case 'card':
      return `<div class="acc-tag tag-card">Tarjeta</div>`
    case 'saving':
      return `<div class="acc-tag tag-saving">Ahorros</div>`
    default:
      return `<div class="acc-tag">-</div>`
  }
}

function categoryTypeTag(type) {
  switch (type) {
    case 'income':
      return `
        <div class="tx-tag tx-income">
          Ingresos
        </div>
      `
    case 'expense':
      return `
        <div class="tx-tag tx-expense">
          Egresos
        </div>
      `
    default:
      return `<div class="tx-tag">-</div>`
  }
}

function categoryTypeForLoanTag(type) {
  switch (type) {
    case 'loan':
      return `
        <div class="tx-tag">
          Prestamos
        </div>
      `
    case 'payment':
      return `
        <div class="tx-tag ">
          Pagos
        </div>
      `
    default:
      return ``
  }
}

 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\indexes\accounts-index.js
```
 
```js
/* ============================================================================
1. Constantes globales
2. Variables de estado
3. Selectores DOM
4. Utils generales
5. Render helpers (iconos, tags, cajas)
6. Render Desktop / Mobile
7. Render principal
8. Data (loadAccounts)
9. Filtros (texto + estado)
10. Status Filter UI
11. Acciones (redirects / selects)
12. Eventos
13. Scroll
14. Init (DOMContentLoaded + loadAccounts)
============================================================================ */

/* ============================
   1. Constantes globales
============================ */
const API_BASE = '/accounts/list'
const FILTER_KEY = `accounts.filters.${window.USER_ID}`
const SELECTED_KEY = `accounts.selected.${window.USER_ID}`
const SCROLL_KEY = `accounts.scroll.${window.USER_ID}`
const STATUS_FILTER_KEY = `accounts.statusFilter.${window.USER_ID}`

/* ============================
   2. Variables de estado
============================ */
let allAccounts = []

/* ============================
   Layout detection (AGREGADO)
============================ */
function getLayoutMode() {
  const w = window.innerWidth

  if (w >= 1024) return 'desktop'
  if (w >= 769) return 'tablet'
  return 'mobile'
}

let currentLayout = getLayoutMode()

/* ============================
   3. Selectores DOM
============================ */
const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')
const searchBtn = document.getElementById('search-btn')
const tableBody = document.getElementById('accounts-table')
const scrollContainer = document.querySelector('.ui-scroll-area')
const statusToggleBtn = document.querySelector('.js-status-filter-toggle')

/* ============================
   4. Utils generales
============================ */
function debounce(fn, delay) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), delay)
  }
}

/* ============================
   5. Render helpers (iconos, tags, cajas)
============================ */
// iconEdit()
// iconDelete()
// iconView()
// iconViewOff()
// iconList()
// amountBox()
// numberBox()
// statusTag()
// accountTypeTag()

/* ============================
   6. Render Desktop / Mobile
============================ */
function renderRow(account) {
  const rowClass = account.is_active ? '' : 'bg-red-50'

  /*const statusButton = account.is_active
    ? `
      <button 
        class="icon-btn deactivate" 
        onclick="goToAccountUpdateStatus(${account.id})">
        ${iconViewOff()}
        <span class="ui-btn-text">Desactivar</span>
      </button>
    `
    : `
      <button 
        class="icon-btn activate" 
        onclick="goToAccountUpdateStatus(${account.id})">
        ${iconView()}
        <span class="ui-btn-text">Activar</span>
      </button>
    `*/

  return `
    <tr id="account-${account.id}" class="${rowClass}">
      <td class="ui-td col-left">${account.name}</td>
      <td class="ui-td col-left">${accountTypeTag(account.type)}</td>
      <td class="ui-td col-left">${statusTag(account.is_active)}</td>
      <td class="ui-td col-right">${numberBox(account.transaction_count)}</td>
      <td class="ui-td col-right">${amountBox(account.balance)}</td>
      
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button 
            class="icon-btn edit" 
            onclick="goToAccountUpdate(${account.id})">
            ${iconEdit()}
            <span class="ui-btn-text">Editar</span>
          </button>
          <button 
            class="icon-btn delete" 
            onclick="goToAccountDelete(${account.id})">
            ${iconDelete()}
            <span class="ui-btn-text">Eliminar</span>
          </button>
          ${/*statusButton*/''}
        </div>
      </td>
    </tr>
  `
}

function renderCard(account) {
  /*const statusButton = account.is_active
    ? `
      <button 
        class="icon-btn deactivate"
        onclick="event.stopPropagation(); goToAccountUpdateStatus(${account.id})">
        ${iconViewOff()}
      </button>
    `
    : `
      <button 
        class="icon-btn activate"
        onclick="event.stopPropagation(); goToAccountUpdateStatus(${account.id})">
        ${iconView()}
      </button>
    `*/

  return `
    <div 
      class="account-card ${account.is_active ? '' : 'inactive'}"
      data-id="${account.id}"
      onclick="selectAccountCard(event, ${account.id})">

      <div class="card-header">
        <div class="card-title">${account.name}</div>
        <div class="card-actions">
          <button 
            class="icon-btn edit"
            onclick="event.stopPropagation(); goToAccountUpdate(${account.id})">
            ${iconEdit()}
          </button>
          <button 
            class="icon-btn delete"
            onclick="event.stopPropagation(); goToAccountDelete(${account.id})">
            ${iconDelete()}
          </button>
          ${/*statusButton*/''}
        </div>
      </div>

      <div class="card-balance">
        ${amountBox(account.balance)}
      </div>

      <div class="card-footer">
        <span>${numberBox(account.transaction_count)} trx</span>
        <div class="card-tags">
          ${accountTypeTag(account.type)}
          ${statusTag(account.is_active)}
        </div>
      </div>
    </div>
  `
}

/* ============================
   7. Render principal
============================ */
function renderTable(data) {
  if (!data.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="ui-td col-center text-gray-500">
          No se encontraron cuentas
        </td>
      </tr>
    `
    restoreScroll()
    return
  }

  tableBody.innerHTML = data.map(renderRow).join('')

  const selected = loadFilters(SELECTED_KEY)
  if (selected?.id) {
    const row = document.getElementById(`account-${selected.id}`)
    row?.classList.add('tr-selected')
  }

  restoreScroll()
}

function renderCards(data) {
  const container = document.getElementById('accounts-mobile')
  if (!container) return

  container.innerHTML = data.length
    ? data.map(renderCard).join('')
    : `<div class="ui-empty">No se encontraron cuentas</div>`

  const selected = loadFilters(SELECTED_KEY)
  if (selected?.id) {
    container
      .querySelector(`[data-id="${selected.id}"]`)
      ?.classList.add('card-selected')
  }

  restoreScroll()
}

function render(data) {
  window.innerWidth <= 768
    ? renderCards(data)
    : renderTable(data)
}

/* ============================
   8. Data (loadAccounts)
============================ */
async function loadAccounts() {
  const res = await fetch(API_BASE)
  allAccounts = await res.json()

  const cached = loadFilters(FILTER_KEY)
  const statusCached = loadFilters(STATUS_FILTER_KEY)
  const status = statusCached?.status || 'all'

  if (cached?.term) {
    searchInput.value = cached.term
    clearBtn.classList.remove('hidden')
  }

  syncStatusFilterButton(status)
  applyAllFilters()
}

/* ============================
   9. Filtros (texto + estado)
============================ */
function getFilteredAccounts() {
  const cached = loadFilters(FILTER_KEY)
  const statusCached = loadFilters(STATUS_FILTER_KEY)

  const term = cached?.term?.toLowerCase() || ''
  const status = statusCached?.status || 'all'

  return allAccounts.filter(account => {
    const matchText =
      !term ||
      account.name.toLowerCase().includes(term) ||
      account.type.toLowerCase().includes(term)

    const matchStatus =
      status === 'all' ||
      (status === 'active' && account.is_active) ||
      (status === 'inactive' && !account.is_active)

    return matchText && matchStatus
  })
}

function applyAllFilters() {
  render(getFilteredAccounts())
}

function filterAccounts() {
  const term = searchInput.value.trim().toLowerCase()
  saveFilters(FILTER_KEY, { term })
  saveFilters(SCROLL_KEY, { y: 0 })
  applyAllFilters()
}						   
													 
/* ============================
   10. Status Filter UI
============================ */
function syncStatusFilterButton(status) {
  if (!statusToggleBtn) return

  const icon = statusToggleBtn.querySelector('.ui-btn-icon')
  const text = statusToggleBtn.querySelector('.ui-btn-text')

  if (status === 'active') {
    icon.innerHTML = iconView()
    text.textContent = 'Activos'
  } else if (status === 'inactive') {
    icon.innerHTML = iconViewOff()
    text.textContent = 'Inactivos'
  } else {
    icon.innerHTML = iconList()
    text.textContent = 'Todos'
  }

  statusToggleBtn.dataset.status = status
}

function applyStatusFilter(status) {
  saveFilters(STATUS_FILTER_KEY, { status })
  syncStatusFilterButton(status)
  applyAllFilters()
}

/* ============================
   11. Acciones
============================ */
function goToAccountUpdate(id) {
  location.href = `/accounts/update/${id}`
}

function goToAccountDelete(id) {
  location.href = `/accounts/delete/${id}`
}

function goToAccountUpdateStatus(id) {
  location.href = `/accounts/status/${id}`
}

function selectAccountCard(event, id) {
  if (event.target.closest('button')) return

  document
    .querySelectorAll('.account-card')
    .forEach(c => c.classList.remove('card-selected'))

  event.currentTarget.classList.add('card-selected')
  saveFilters(SELECTED_KEY, { id })
}

/* ============================
   12. Eventos
============================ */
const debouncedFilter = debounce(filterAccounts, 300)

searchBtn?.addEventListener('click', filterAccounts)

searchInput?.addEventListener('input', () => {
  clearBtn.classList.toggle('hidden', !searchInput.value)
  debouncedFilter()
})

clearBtn?.addEventListener('click', () => {
  searchInput.value = ''
  clearBtn.classList.add('hidden')
  clearFilters(FILTER_KEY)
  clearFilters(SELECTED_KEY)
  applyAllFilters()
})

statusToggleBtn?.addEventListener('click', () => {
  const current = statusToggleBtn.dataset.status || 'all'
  const next =
    current === 'all' ? 'active' :
    current === 'active' ? 'inactive' : 'all'

  applyStatusFilter(next)
})

document
  .querySelector('.ui-table')
  ?.addEventListener('click', event => {
    if (event.target.closest('button') || event.target.closest('a')) return

    const row = event.target.closest('tr[id^="account-"]')
    if (!row) return

    document
      .querySelectorAll('#accounts-table tr')
      .forEach(tr => tr.classList.remove('tr-selected'))

    row.classList.add('tr-selected')
    saveFilters(SELECTED_KEY, { id: row.id.replace('account-', '') })
  })

/* ============================
   13. Scroll
============================ */
function restoreScroll() {
  const saved = loadFilters(SCROLL_KEY)
  if (!saved?.y || !scrollContainer) return

  requestAnimationFrame(() => {
    scrollContainer.scrollTop = saved.y
  })
}

scrollContainer?.addEventListener('scroll', () => {
  saveFilters(SCROLL_KEY, { y: scrollContainer.scrollTop })
})

/* ============================
   14. Init
============================ */
document.addEventListener('DOMContentLoaded', () => {
  loadAccounts()

  window.addEventListener('resize', () => {
    const nextLayout = getLayoutMode()

    if (nextLayout !== currentLayout) {
      currentLayout = nextLayout
      applyAllFilters()
    }
  })
})
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\indexes\batch-categorize-index.js
```
 
```js
/* ============================================================================
1. Datos iniciales desde el servidor
============================================================================ */
const BATCH_TRANSACTIONS = Array.isArray(window.BATCH_TRANSACTIONS) ? window.BATCH_TRANSACTIONS : []

/* ============================================================================
2. Layout detection
============================================================================ */
function getLayoutMode() {
  const w = window.innerWidth

  if (w >= 1024) return 'desktop'
  if (w >= 769) return 'tablet'
  return 'mobile'
}

let currentLayout = getLayoutMode()

/* ============================================================================
3. Selectores DOM
============================================================================ */
const tableBody = document.getElementById('transactions-table')
const mobileContainer = document.getElementById('batch-categorize-mobile')

/* ============================================================================
4. Utils
============================================================================ */
function rowClassByType(type) {
  if (type === 'income') return 'income'
  if (type === 'expense') return 'expense'
  if (type === 'transfer') return 'transfer'
  return ''
}

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/* ============================================================================
5. Render Desktop (tabla)
============================================================================ */
function renderRow(transaction) {
  const date = formatDate(transaction.date)

  return `
    <tr class="${rowClassByType(transaction.type)}">
      <td class="ui-td col-left">${date}</td>
      <td class="ui-td col-left col-sm">${transactionTypeTag(transaction.type)}</td>
      <td class="ui-td col-right">${amountBox(transaction.amount)}</td>
      <td class="ui-td col-left">${transaction.description}</td>
      <td class="ui-td col-left">${transaction.category?.name || '-'}</td>
      <td class="ui-td col-left">
        <span class="text-gray-400">Seleccione categoría...</span>
      </td>
    </tr>
  `
}

function renderTable(data) {
  if (!tableBody) return

  if (!data.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="ui-td col-center text-gray-500">
          No hay transacciones para categorizar
        </td>
      </tr>
    `
    return
  }

  tableBody.innerHTML = data.map(renderRow).join('')
}

/* ============================================================================
6. Render Mobile (cards)
============================================================================ */
function renderCard(transaction) {
  const date = formatDate(transaction.date)

  return `
    <div class="transaction-card ${rowClassByType(transaction.type)}">
      <div class="card-header">
        <div class="card-datetime">
          <span class="card-date">${date}</span>
        </div>
        <div class="card-type">
          ${transactionTypeTag(transaction.type)}
        </div>
      </div>

      <div class="card-content">
        <div class="card-info">
          <div class="card-description">
            ${transaction.description}
          </div>
          <div class="card-category">
            Categoría actual:
            <strong>${transaction.category?.name || '-'}</strong>
          </div>
        </div>

        <div class="card-amount">
          ${amountBox(transaction.amount)}
        </div>
      </div>

      <div class="card-footer">
        <span class="text-gray-400">Seleccione nueva categoría...</span>
      </div>
    </div>
  `
}

function renderCards(data) {
  if (!mobileContainer) return

  if (!data.length) {
    mobileContainer.innerHTML = `<div class="ui-empty">No hay transacciones para categorizar</div>`
    return
  }

  mobileContainer.innerHTML = data.map(renderCard).join('')
}

/* ============================================================================
7. Render principal
============================================================================ */
function render(data) {
  if (window.innerWidth <= 768) {
    renderCards(data)
  } else {
    renderTable(data)
  }
}

/* ============================================================================
9. Estado de categorías seleccionadas
============================================================================ */
let selected_income_category = null
let selected_expense_category = null

const incomeHidden = document.getElementById('batch-income-category-id')
const expenseHidden = document.getElementById('batch-expense-category-id')

const incomeInput = document.getElementById('batch-income-category-input')
const expenseInput = document.getElementById('batch-expense-category-input')

function updateNewCategoryLabels() {
  // Desktop
  document.querySelectorAll('#transactions-table tr').forEach((tr, index) => {
    const tx = BATCH_TRANSACTIONS[index]
    if (!tx) return

    const tdNew = tr.querySelector('td:last-child')
    if (!tdNew) return

    let label = '<span class="text-gray-400">Seleccione categoría...</span>'

    if (tx.type === 'income' && selected_income_category) {
      label = selected_income_category.name
    }

    if (tx.type === 'expense' && selected_expense_category) {
      label = selected_expense_category.name
    }

    tdNew.innerHTML = label
  })

  // Mobile
  document.querySelectorAll('.transaction-card').forEach((card, index) => {
    const tx = BATCH_TRANSACTIONS[index]
    if (!tx) return

    const footer = card.querySelector('.card-footer')
    if (!footer) return

    let label = '<span class="text-gray-400">Seleccione nueva categoría...</span>'

    if (tx.type === 'income' && selected_income_category) {
      label = selected_income_category.name
    }

    if (tx.type === 'expense' && selected_expense_category) {
      label = selected_expense_category.name
    }

    footer.innerHTML = label
  })
}


/* ============================================================================
10. Init
============================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  render(BATCH_TRANSACTIONS)

  if (incomeHidden && incomeInput) {
    incomeHidden.addEventListener('change', () => {
      const id = incomeHidden.value
      const name = incomeInput.value

      if (id) {
        selected_income_category = { id, name }
      } else {
        selected_income_category = null
      }

      updateNewCategoryLabels()
    })
  }

  if (expenseHidden && expenseInput) {
    expenseHidden.addEventListener('change', () => {
      const id = expenseHidden.value
      const name = expenseInput.value

      if (id) {
        selected_expense_category = { id, name }
      } else {
        selected_expense_category = null
      }

      updateNewCategoryLabels()
    })
  }

  window.addEventListener('resize', () => {
    const nextLayout = getLayoutMode()

    if (nextLayout !== currentLayout) {
      currentLayout = nextLayout
      render(BATCH_TRANSACTIONS)
      updateNewCategoryLabels()
    }
  })
})

/* ============================================================================
11. Guardar / Cancelar
============================================================================ */
const form = document.getElementById('batch-categorize-form')
const cancelBtn = document.getElementById('batch-cancel-btn')
const incomeIdsInput = document.getElementById('income-ids-input')
const expenseIdsInput = document.getElementById('expense-ids-input')

function buildPayload() {
  const income_ids = []
  const expense_ids = []

  BATCH_TRANSACTIONS.forEach(tx => {
    if (tx.type === 'income') income_ids.push(tx.id)
    if (tx.type === 'expense') expense_ids.push(tx.id)
  })

  return {
    income_ids,
    expense_ids
  }
}

function validateBatch() {
  const payload = buildPayload()

  if (payload.income_ids.length && !selected_income_category?.id) {
    showError('Debe seleccionar categoría de ingresos')
    return false
  }

  if (payload.expense_ids.length && !selected_expense_category?.id) {
    showError('Debe seleccionar categoría de gastos')
    return false
  }

  return true
}

function showError(message) {
  alert(message)
}

if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault()

    if (!validateBatch()) {
      return
    }

    const payload = buildPayload()
    incomeIdsInput.value = JSON.stringify(payload.income_ids)
    expenseIdsInput.value = JSON.stringify(payload.expense_ids)

    form.submit()
  })
}

if (cancelBtn) {
  cancelBtn.addEventListener('click', () => {
    window.history.back()
  })
}


 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\indexes\categories-index.js
```
 
```js
/* ============================================================================
1. Constantes globales
2. Variables de estado
3. Selectores DOM
4. Utils generales
5. Render helpers (iconos, tags, cajas)
6. Render Desktop / Mobile
7. Render principal
8. Data (loadCategories)
9. Filtros (texto + estado)
10. Status Filter UI
11. Acciones (redirects / selects)
12. Eventos
13. Scroll
14. Init
============================================================================ */

/* ============================
   1. Constantes globales
============================ */
const API_BASE = '/categories/list'
const FILTER_KEY = `categories.filters.${window.USER_ID}`
const SELECTED_KEY = `categories.selected.${window.USER_ID}`
const SCROLL_KEY = `categories.scroll.${window.USER_ID}`
const STATUS_FILTER_KEY = `categories.statusFilter.${window.USER_ID}`
const COLLAPSE_KEY = `categories.collapse.${window.USER_ID}`

/* ============================
   2. Variables de estado
============================ */
let allCategories = []

/* ============================
   Layout detection (AGREGADO)
============================ */
function getLayoutMode() {
  const w = window.innerWidth

  if (w >= 1024) return 'desktop'
  if (w >= 769) return 'tablet'
  return 'mobile'
}

let currentLayout = getLayoutMode()

/* ============================
   3. Selectores DOM
============================ */
const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')
const searchBtn = document.getElementById('search-btn')
const tableBody = document.getElementById('categories-table')
const scrollContainer = document.querySelector('.ui-scroll-area')
const statusToggleBtn = document.querySelector('.js-status-filter-toggle')

const newBtn = document.querySelector('[data-btn="new"]')
const insertModal = document.getElementById('insert-modal')
const insertModalContent = document.getElementById('insert-modal-content')
const insertGroupBtn = document.getElementById('insert-group')
const insertChildBtn = document.getElementById('insert-child')
const closeInsertModalBtn = document.getElementById('close-modal')

/* ============================
   4. Utils generales
============================ */
function debounce(fn, delay) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), delay)
  }
}

function isCategoryGroupCollapsed(parentId) {
  const state = loadFilters(COLLAPSE_KEY) || {}
  return !!state[parentId]
}

function toggleCategoryGroupCollapse(parentId) {
  const state = loadFilters(COLLAPSE_KEY) || {}
  state[parentId] = !state[parentId]
  saveFilters(COLLAPSE_KEY, state)
  applyAllFilters()
}

function getParentBackgroundColor(index, total) {
  if (total <= 1) return 'hsl(210, 40%, 96%)'

  const startLightness = 96
  const endLightness = 88
  const step = (startLightness - endLightness) / (total - 1)

  const lightness = startLightness - (step * index)

  return `hsl(140, 35%, ${lightness}%)`
}

/* ============================
   5. Render helpers
============================ */
// iconEdit()
// iconDelete()
// iconView()
// iconViewOff()
// iconList()
// numberBox()
// statusTag()
// categoryTypeTag()

/* ============================
   6. Render Desktop / Mobile
============================ */
function renderRow(category) {
  const isParent = false
  const isChild = true
  const collapsed = isCategoryGroupCollapsed(category.category_group.id)
  if (collapsed) {
    return ''
  }

  const rowClass = category.is_active ? '' : 'bg-red-50'
  return `
    <tr id="category-${category.id}" class="${rowClass}">
      <td class="ui-td col-left">
        <div class="child-cell">
          <span class="child-indent"></span>
          <span class="child-name">${category.name}</span>
        </div>
      </td>
      <td class="ui-td col-left">${categoryTypeTag(category.type)}</td>
      <td class="ui-td col-right">${numberBox(category.transactions_count)}</td>
      <td class="ui-td col-left">${statusTag(category.is_active)}</td>
      
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button 
            class="icon-btn edit" 
            onclick="goToCategoryUpdate(${category.id})">
            ${iconEdit()}
            <span class="ui-btn-text">Editar</span>
          </button>
          <button 
            class="icon-btn delete" 
            onclick="goToCategoryDelete(${category.id})">
            ${iconDelete()}
            <span class="ui-btn-text">Eliminar</span>
          </button>
          <button 
            class="icon-btn"
            onclick="goToCategoryList(${category.id})">
            ${iconList()}
            <span class="ui-btn-text">Transacciones</span>
          </button> 
        </div>
      </td>
    </tr>
  `
}

function renderCard(category) {
  const collapsed = isCategoryGroupCollapsed(category.category_group.id)
  if (collapsed) {
    return ''
  }

  return `
    <div 
      class="category-card ${category.is_active ? '' : 'inactive'}"
      data-id="${category.id}"
      onclick="selectCategoryCard(event, ${category.id})">
      <div class="card-header">
        <div class="card-title">
          ${category.name}
        </div>
        <div class="card-actions">
          <button 
            class="icon-btn edit"
            onclick="event.stopPropagation(); goToCategoryUpdate(${category.id})">
            ${iconEdit()}
          </button>
          <button 
            class="icon-btn delete"
            onclick="event.stopPropagation(); goToCategoryDelete(${category.id})">
            ${iconDelete()}
          </button> 
          <button 
            class="icon-btn"
            onclick="event.stopPropagation(); goToCategoryList(${category.id})">
            ${iconList()}
          </button> 
        </div>
      </div>

      <div class="card-footer">
        <span class="card-meta">
          ${numberBox(category.transactions_count)} trx
        </span>

        <div class="card-tags">
          ${categoryTypeTag(category.type)}
          ${categoryTypeForLoanTag(category.type_for_loan)}
          ${statusTag(category.is_active)}
        </div>
      </div>
    </div>
  `
}

/* ============================
   7. Render principal
============================ */
function renderTable(data) {
  const selected = loadFilters(SELECTED_KEY)

  if (!data.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="ui-td col-center text-gray-500">
          No se encontraron categorías
        </td>
      </tr>
    `
    restoreScroll()
    return
  }

  const groupsMap = new Map()

  data.forEach(cat => {
    const g = cat.category_group
    if (!groupsMap.has(g.id)) {
      groupsMap.set(g.id, { group: g, items: [] })
    }
    groupsMap.get(g.id).items.push(cat)
  })

  const groups = Array.from(groupsMap.values())

  const html = groups.map(({ group, items }, index) => {
    const collapsed = isCategoryGroupCollapsed(group.id)

    const parentRow = `
      <tr class="parent-row">
        <td class="ui-td col-left">
          <div class="group-cell">
            <button class="group-toggle" onclick="toggleCategoryGroupCollapse(${group.id})">
              ${collapsed ? iconChevronOpen() : iconChevronClose()}
            </button>
            <span class="group-name">${group.name}</span>
          </div>
        </td>
        <td class="ui-td col-right" colspan="4">
          <div class="icon-actions">
            <button 
              class="icon-btn edit" 
              onclick="goToCategoryGroupUpdate(${group.id})">
              ${iconEdit()}
              <span class="ui-btn-text">Editar</span>
            </button>
            <button 
              class="icon-btn delete" 
              onclick="goToCategoryGroupDelete(${group.id})">
              ${iconDelete()}
              <span class="ui-btn-text">Eliminar</span>
            </button>
          </div>
        </td>
      </tr>
    `

    const childRows = collapsed ? '' : items.map(c => renderRow(c)).join('')

    return parentRow + childRows
  }).join('')

  tableBody.innerHTML = html

  if (selected?.id) {
    document
      .getElementById(`category-${selected.id}`)
      ?.classList.add('tr-selected')
  }

  restoreScroll()
}

function renderCards(data) {
  const container = document.getElementById('categories-mobile')
  if (!container) return

  const groupsMap = new Map()

  data.forEach(cat => {
    const g = cat.category_group
    if (!groupsMap.has(g.id)) {
      groupsMap.set(g.id, { group: g, items: [] })
    }
    groupsMap.get(g.id).items.push(cat)
  })

  const groups = Array.from(groupsMap.values())
  const totalParents = groups.length

  const html = groups.map(({ group, items }, index) => {
    const collapsed = isCategoryGroupCollapsed(group.id)
    const bgColor = getParentBackgroundColor(index, totalParents)

    const childCards = collapsed ? '' : items.map(c => renderCard(c)).join('')

    return `
      <div class="category-group ${collapsed ? 'collapsed' : ''}" style="background: ${bgColor};">
        <div class="category-group-header">
          <div class="group-header-left">
            <button onclick="toggleCategoryGroupCollapse(${group.id})">
              ${collapsed ? iconChevronOpen() : iconChevronClose()}
            </button>
            <span>${group.name}</span>
          </div>
          <div class="group-header-actions">
            <button 
              class="icon-btn edit"
              onclick="event.stopPropagation(); goToCategoryGroupUpdate(${group.id})">
              ${iconEdit()}
            </button>
            <button 
              class="icon-btn delete"
              onclick="event.stopPropagation(); goToCategoryGroupDelete(${group.id})">
              ${iconDelete()}
            </button>
          </div>
        </div>
        <div class="category-group-body">
          ${childCards}
        </div>
      </div>
    `
  }).join('')

  container.innerHTML = html
  restoreScroll()
}

function render(data) {
  window.innerWidth <= 768
    ? renderCards(data)
    : renderTable(data)
}

/* ============================
   8. Data
============================ */
async function loadCategories() {
  const res = await fetch(API_BASE)
  allCategories = await res.json()

  const cached = loadFilters(FILTER_KEY)
  const statusCached = loadFilters(STATUS_FILTER_KEY)
  const status = statusCached?.status || 'all'

  if (cached?.term) {
    searchInput.value = cached.term
    clearBtn.classList.remove('hidden')
  }

  syncStatusFilterButton(status)
  applyAllFilters()
}

/* ============================
   9. Filtros (texto + estado)
============================ */
function getFilteredCategories() {
  const cached = loadFilters(FILTER_KEY)
  const statusCached = loadFilters(STATUS_FILTER_KEY)

  const term = cached?.term?.toLowerCase() || ''
  const status = statusCached?.status || 'all'

  return allCategories.filter(category => {
    const matchText =
      !term ||
      category.name.toLowerCase().includes(term) ||
      category.type.toLowerCase().includes(term)

    const matchStatus =
      status === 'all' ||
      (status === 'active' && category.is_active) ||
      (status === 'inactive' && !category.is_active)

    return matchText && matchStatus
  })
}

function applyAllFilters() {
  const filtered = getFilteredCategories()
  render(filtered)
}

function filterCategories() {
  const term = searchInput.value.trim().toLowerCase()
  saveFilters(FILTER_KEY, { term })
  saveFilters(SCROLL_KEY, { y: 0 })
  applyAllFilters()
}

/* ============================
   10. Status Filter UI
============================ */
function syncStatusFilterButton(status) {
  if (!statusToggleBtn) return

  const icon = statusToggleBtn.querySelector('.ui-btn-icon')
  const text = statusToggleBtn.querySelector('.ui-btn-text')

  if (status === 'active') {
    icon.innerHTML = iconView()
    text.textContent = 'Activas'
  } else if (status === 'inactive') {
    icon.innerHTML = iconViewOff()
    text.textContent = 'Inactivas'
  } else {
    icon.innerHTML = iconList()
    text.textContent = 'Todas'
  }

  statusToggleBtn.dataset.status = status
}

function applyStatusFilter(status) {
  saveFilters(STATUS_FILTER_KEY, { status })
  syncStatusFilterButton(status)
  applyAllFilters()
}

/* ============================
   11. Acciones
============================ */
function goToCategoryUpdateStatus(id) {
  location.href = `/categories/status/${id}`
}

function goToCategoryUpdate(id) {
  location.href = `/categories/update/${id}`
}

function goToCategoryDelete(id) {
  location.href = `/categories/delete/${id}`
}

function goToCategoryList(id) {
  location.href = `/transactions?category_id=${id}&from=categories`
}

function selectCategoryCard(event, id) {
  if (event.target.closest('button')) return

  document
    .querySelectorAll('.category-card')
    .forEach(c => c.classList.remove('card-selected'))

  event.currentTarget.classList.add('card-selected')
  saveFilters(SELECTED_KEY, { id })
}

function goToCategoryGroupInsert() {
  location.href = `/category-groups/insert`
}

function goToCategoryGroupUpdate(id) {
  location.href = `/category-groups/update/${id}`
}

function goToCategoryGroupDelete(id) {
  location.href = `/category-groups/delete/${id}`
}

/* ============================
   12. Eventos
============================ */
const debouncedFilter = debounce(filterCategories, 300)

searchBtn?.addEventListener('click', filterCategories)

searchInput?.addEventListener('input', () => {
  clearBtn.classList.toggle('hidden', !searchInput.value)
  debouncedFilter()
})

clearBtn?.addEventListener('click', () => {
  searchInput.value = ''
  clearBtn.classList.add('hidden')
  clearFilters(FILTER_KEY)
  clearFilters(SELECTED_KEY)
  applyAllFilters()
})

statusToggleBtn?.addEventListener('click', () => {
  const current = statusToggleBtn.dataset.status || 'all'
  const next =
    current === 'all' ? 'active' :
      current === 'active' ? 'inactive' : 'all'

  applyStatusFilter(next)
})

/* ============================
   Modal Nuevo (Grupo o Hija)
============================ */
function openModal() {
  if (insertModal) insertModal.classList.remove('hidden')
}
function closeModal() {
  if (insertModal) insertModal.classList.add('hidden')
}

newBtn?.addEventListener('click', (e) => {
  e.preventDefault()
  openModal()
})

closeInsertModalBtn?.addEventListener('click', () => {
  closeModal()
})

insertGroupBtn?.addEventListener('click', () => {
  goToCategoryGroupInsert()
})

insertChildBtn?.addEventListener('click', () => {
  location.href = '/categories/insert'
})

insertModal?.addEventListener('click', (e) => {
  if (!insertModalContent?.contains(e.target)) {
    insertModal.classList.add('hidden')
  }
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    insertModal?.classList.add('hidden')
  }
})

/* ============================
   13. Scroll
============================ */
function restoreScroll() {
  const saved = loadFilters(SCROLL_KEY)
  if (!saved?.y || !scrollContainer) return

  requestAnimationFrame(() => {
    scrollContainer.scrollTop = saved.y
  })
}

scrollContainer?.addEventListener('scroll', () => {
  saveFilters(SCROLL_KEY, { y: scrollContainer.scrollTop })
})

/* ============================
   14. Init
============================ */
document.addEventListener('DOMContentLoaded', () => {
  loadCategories()

  window.addEventListener('resize', () => {
    const nextLayout = getLayoutMode()

    if (nextLayout !== currentLayout) {
      currentLayout = nextLayout
      applyAllFilters()
    }
  })
})
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\indexes\home-index.js
```
 
```js
/* ============================
   Constantes globales
============================ */
const CARD_IDS = [
    'html-balance-kpi',
    'html-cash-flow-summary',
]

const KPI_CONFIG = [
    { key: 'available_balance', label: 'Disponible', color: 'green', trend: true },
    { key: 'net_savings', label: 'Ahorrado', color: 'blue', trend: true },
    { key: 'incomes', label: 'Ingresos', color: 'green', trend: true },
    { key: 'expenses', label: 'Egresos', color: 'red', trend: true },
    { key: 'loans', label: 'Prestamos', color: 'green', trend: true },
    { key: 'payments', label: 'Pagos', color: 'red', trend: true },
    { key: 'savings', label: 'Ahorros', color: 'green', trend: true },
    { key: 'withdrawals', label: 'Retiros', color: 'red', trend: true },
    { key: 'total_inflows', label: 'Total Ingresos', color: 'green', trend: true },
    { key: 'total_outflows', label: 'Total Egresos', color: 'red', trend: true },
    //{ key: 'principal_breakdown', label: 'Desglose Capital', color: 'green', trend: true },
    //{ key: 'interest_breakdown', label: 'Desglose Interes', color: 'red', trend: true },
    { key: 'net_cash_flow', label: 'Neto', color: 'blue', trend: true },
]

const CARD_STATE_KEY = `home.cards.state.${window.USER_ID}`
const CAROUSEL_POSITION_KEY = `home.carousel.position.${window.USER_ID}`
const KPI_YEAR_STATE_KEY = `home.kpi.year.${window.USER_ID}`
const CASH_FLOW_YEAR_STATE_KEY = `home.cash.flow.year.${window.USER_ID}`
const LOAN_FLOW_YEAR_STATE_KEY = `home.loan.flow.year.${window.USER_ID}`

const labelForKpi = 'KPIs'
const labelForTrendBalance = 'Balances'
const labelForTrendLoan = 'Préstamos'

let kpi_years = []
let kpi_year_index = 0
let cash_flow_year_index = 0
let cashFlowChart = null
let loan_flow_year_index = 0
let loanFlowChart = null

/* ============================
   DOM Ready
============================ */
document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar los Cards
    const savedState = loadFilters(CARD_STATE_KEY) || {}
    CARD_IDS.forEach(id => {
        const body = document.getElementById(id)
        const icon = document.getElementById(`icon-${id}`)
        if (!body || !icon) return
        const isOpen = savedState[id] ?? true
        body.classList.toggle('collapsed', !isOpen)
        icon.innerHTML = isOpen ? iconChevronClose() : iconChevronOpen()
    })
    const carousel_prev = document.getElementById('carousel-prev')
    const carousel_next = document.getElementById('carousel-next')
    if (carousel_prev) carousel_prev.innerHTML = iconCarouselPrev()
    if (carousel_next) carousel_next.innerHTML = iconCarouselNext()
    const kpi_prev = document.getElementById('html-balance-kpi-prev')
    const kpi_next = document.getElementById('html-balance-kpi-next')
    if (kpi_prev) kpi_prev.innerHTML = iconCarouselPrev()
    if (kpi_next) kpi_next.innerHTML = iconCarouselNext()
    const cash_prev = document.getElementById('html-cash-flow-summary-prev')
    const cash_next = document.getElementById('html-cash-flow-summary-next')
    if (cash_prev) cash_prev.innerHTML = iconCarouselPrev()
    if (cash_next) cash_next.innerHTML = iconCarouselNext()
    const loan_prev = document.getElementById('html-loan-flow-summary-prev')
    const loan_next = document.getElementById('html-loan-flow-summary-next')
    if (loan_prev) loan_prev.innerHTML = iconCarouselPrev()
    if (loan_next) loan_next.innerHTML = iconCarouselNext()

    // Inicializar el Html para KPIs
    renderBalanceKpiHtml()
    // Invocar desde el backend
    try {
        const res_kpi = await fetch('/kpis', { credentials: 'same-origin' })
        if (!res_kpi.ok) throw new Error('No autorizado')
        const { availableYearsKpi, } = await res_kpi.json()

        // Inicializar navegación año
        kpi_years = availableYearsKpi || [0]
        const savedYearRawKpi = loadFilters(KPI_YEAR_STATE_KEY)
        const savedYearRawCashFlow = loadFilters(CASH_FLOW_YEAR_STATE_KEY)
        const savedYearKpi = savedYearRawKpi !== null ? Number(savedYearRawKpi) : null
        const savedYearCashFlow = savedYearRawCashFlow !== null ? Number(savedYearRawCashFlow) : null
        kpi_year_index = kpi_years.includes(savedYearKpi) ? kpi_years.indexOf(savedYearKpi) : 0
        cash_flow_year_index = kpi_years.includes(savedYearCashFlow) ? kpi_years.indexOf(savedYearCashFlow) : 0
        const current_year_kpi = kpi_years[kpi_year_index]
        const current_year_cash_flow = kpi_years[cash_flow_year_index]

        const savedYearRawLoanFlow = loadFilters(LOAN_FLOW_YEAR_STATE_KEY)
        const savedYearLoanFlow = savedYearRawLoanFlow !== null ? Number(savedYearRawLoanFlow) : null
        loan_flow_year_index = kpi_years.includes(savedYearLoanFlow) ? kpi_years.indexOf(savedYearLoanFlow) : 0
        const current_year_loan_flow = kpi_years[loan_flow_year_index]

        updateLabelForBalanceKpi(current_year_kpi)
        initYearNavForBalanceKpi()
        await changeYearForBalanceKpi()

        updateLabelForCashFlowSumm(current_year_cash_flow)
        await changeYearForCashFlowSumm()
        initYearNavForCashFlowSumm()

        updateLabelForLoanFlowSumm(current_year_loan_flow)
        await changeYearForLoanFlowSumm()
        initYearNavForLoanFlowSumm()

        initHomeCarousel()
    } catch (err) {
        console.error('Error cargando dashboard', err)
    }
})

/* ============================
   KPI Balance Section
============================ */
function renderBalanceKpiHtml() {
    const container = document.getElementById('html-balance-kpi')
    let html = ''
    let chunk = []
    KPI_CONFIG.forEach((kpi, index) => {
        chunk.push(kpi)
        if (chunk.length === 6 || index === KPI_CONFIG.length - 1) {
            html += `<div class="ui-kpi-grid cols-6">`
            chunk.forEach(item => {
                const id = item.key.replace(/_/g, '-')
                html += `
                    <div class="ui-kpi-item">
                        <p class="ui-kpi-label">${item.label}</p>
                        ${item.trend
                        ? `
                        <div class="ui-kpi-row">
                            <div class="ui-kpi-values">
                                <p class="ui-kpi-value ui-kpi-${item.color}" id="html-balance-kpi-${id}">–</p>
                                <p class="ui-kpi-value ui-kpi-trend-${item.color}" id="html-trend-kpi-${item.key}">–</p>
                            </div>
                            <div class="ui-kpi-arrow" id="html-trend-kpi-arrow-${item.key}"></div>
                        </div>
                        `
                        : `
                        <p class="ui-kpi-value ui-kpi-${item.color}" id="html-balance-kpi-${id}">–</p>
                        `
                    }
                    </div>
                `
            })
            html += `</div>`
            chunk = []
        }
    })
    container.innerHTML = html
}

function renderKpis(year, balanceKpi, trendKpi) {
    const fields = ['incomes', 'expenses', 'loans', 'payments', 'savings', 'withdrawals', 'total_inflows', 'total_outflows', 'net_cash_flow', 'net_savings', 'available_balance', 'principal_breakdown', 'interest_breakdown']
    fields.forEach(field => {
        const el = document.getElementById(`html-balance-kpi-${field.replace(/_/g, '-')}`)
        if (el) el.textContent = (balanceKpi[field] ?? 0).toFixed(2)
    })
    KPI_CONFIG.forEach(({ key, trend }) => {
        if (!trend) return
        const el_trend = document.getElementById(`html-trend-kpi-${key}`)
        const el_arrow = document.getElementById(`html-trend-kpi-arrow-${key}`)
        if (!el_trend || !el_arrow) return
        if (year !== 0 && trendKpi?.trend?.[key]) {
            el_trend.style.display = 'block'
            el_arrow.style.display = 'block'
            el_trend.textContent = (trendKpi.previous?.[key] ?? 0).toFixed(2)
            el_arrow.innerHTML = trendKpi.trend[key].direction === 'up' ? iconTrendUp() : iconTrendDown()
        } else {
            el_trend.style.display = 'none'
            el_arrow.style.display = 'none'
        }
    })
}

function initYearNavForBalanceKpi() {
    const prevBtn = document.getElementById('html-balance-kpi-prev')
    const nextBtn = document.getElementById('html-balance-kpi-next')
    if (!prevBtn || !nextBtn) return
    prevBtn.addEventListener('click', async () => {
        if (kpi_year_index < kpi_years.length - 1) {
            kpi_year_index++
            await changeYearForBalanceKpi()
        }
    })
    nextBtn.addEventListener('click', async () => {
        if (kpi_year_index > 0) {
            kpi_year_index--
            await changeYearForBalanceKpi()
        }
    })
    updateYearNavForBalanceKpi()
}

async function changeYearForBalanceKpi() {
    const year = kpi_years[kpi_year_index]
    saveFilters(KPI_YEAR_STATE_KEY, year)
    updateLabelForBalanceKpi(year)
    updateYearNavForBalanceKpi()
    const res = await fetch(`/kpis?year_period_for_kpi=${year}&month_period_for_kpi=0`, { credentials: 'same-origin' })
    if (!res.ok) return
    const { balanceKpi, trendKpi } = await res.json()
    renderKpis(year, balanceKpi, trendKpi)
}

function updateLabelForBalanceKpi(year) {
    const label = document.getElementById('html-balance-kpi-year-label')
    if (!label) return
    label.textContent = year === 0 ? `${labelForKpi} - Todos` : `${labelForKpi} - ${year}`
}

function updateYearNavForBalanceKpi() {
    const prevBtn = document.getElementById('html-balance-kpi-prev')
    const nextBtn = document.getElementById('html-balance-kpi-next')
    if (!prevBtn || !nextBtn) return
    prevBtn.disabled = kpi_year_index >= kpi_years.length - 1
    nextBtn.disabled = kpi_year_index <= 0
}

/* ============================
   Cash Flow Summary Section
============================ */
function renderCashFlowSummChart(data) {
    const ctx = document.getElementById('cashFlowChart').getContext('2d')

    if (cashFlowChart) cashFlowChart.destroy()

    cashFlowChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                { label: 'Ingresos', data: data.total_inflows, tension: 0.35 },
                { label: 'Egresos', data: data.total_outflows, tension: 0.35 },
                { label: 'Neto', data: data.net_cash_flow, borderDash: [6, 4], tension: 0.35 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    })
}

function renderLoanFlowSummChart(data) {
    const ctx = document.getElementById('loanFlowChart').getContext('2d')

    if (loanFlowChart) loanFlowChart.destroy()

    loanFlowChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                { label: 'Préstamos', data: data.total_loans, tension: 0.35 },
                { label: 'Pagos', data: data.total_payments, tension: 0.35 },
                { label: 'Balance', data: data.net_balance, borderDash: [6, 4], tension: 0.35 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    })
}

async function changeYearForCashFlowSumm() {
    const year = kpi_years[cash_flow_year_index]

    saveFilters(CASH_FLOW_YEAR_STATE_KEY, year)
    updateLabelForCashFlowSumm(year)
    updateYearNavForCashFlowSumm()

    const res = await fetch(`/cash-summary?year_period_for_cash_summ=${year}`, { credentials: 'same-origin' })
    if (!res.ok) return

    const { cashSummary } = await res.json()

    renderCashFlowSummChart(cashSummary)
}

async function changeYearForLoanFlowSumm() {
    const year = kpi_years[loan_flow_year_index]

    saveFilters(LOAN_FLOW_YEAR_STATE_KEY, year)
    updateLabelForLoanFlowSumm(year)
    updateYearNavForLoanFlowSumm()

    const res = await fetch(`/loan-summary?year_period_for_loan_summ=${year}`, { credentials: 'same-origin' })
    if (!res.ok) return

    const { loanSummary } = await res.json()

    renderLoanFlowSummChart(loanSummary)
}

function initYearNavForCashFlowSumm() {
    const prevBtn = document.getElementById('html-cash-flow-summary-prev')
    const nextBtn = document.getElementById('html-cash-flow-summary-next')

    if (!prevBtn || !nextBtn) return

    prevBtn.addEventListener('click', async () => {
        if (cash_flow_year_index < kpi_years.length - 1) {
            cash_flow_year_index++
            await changeYearForCashFlowSumm()
        }
    })

    nextBtn.addEventListener('click', async () => {
        if (cash_flow_year_index > 0) {
            cash_flow_year_index--
            await changeYearForCashFlowSumm()
        }
    })

    updateYearNavForCashFlowSumm()
}

function initYearNavForLoanFlowSumm() {
    const prevBtn = document.getElementById('html-loan-flow-summary-prev')
    const nextBtn = document.getElementById('html-loan-flow-summary-next')

    if (!prevBtn || !nextBtn) return

    prevBtn.addEventListener('click', async () => {
        if (loan_flow_year_index < kpi_years.length - 1) {
            loan_flow_year_index++
            await changeYearForLoanFlowSumm()
        }
    })

    nextBtn.addEventListener('click', async () => {
        if (loan_flow_year_index > 0) {
            loan_flow_year_index--
            await changeYearForLoanFlowSumm()
        }
    })

    updateYearNavForLoanFlowSumm()
}

function updateLabelForCashFlowSumm(year) {
    const label = document.getElementById('html-cash-flow-summary-year-label')
    if (!label) return

    label.textContent = year === 0 ? `${labelForTrendBalance} - Todos` : `${labelForTrendBalance} - ${year}`
}

function updateLabelForLoanFlowSumm(year) {
    const label = document.getElementById('html-loan-flow-summary-year-label')
    if (!label) return

    label.textContent = year === 0 ? `${labelForTrendLoan} - Todos` : `${labelForTrendLoan} - ${year}`
}

function updateYearNavForCashFlowSumm() {
    const prevBtn = document.getElementById('html-cash-flow-summary-prev')
    const nextBtn = document.getElementById('html-cash-flow-summary-next')

    if (!prevBtn || !nextBtn) return

    prevBtn.disabled = cash_flow_year_index >= kpi_years.length - 1
    nextBtn.disabled = cash_flow_year_index <= 0
}

function updateYearNavForLoanFlowSumm() {
    const prevBtn = document.getElementById('html-loan-flow-summary-prev')
    const nextBtn = document.getElementById('html-loan-flow-summary-next')

    if (!prevBtn || !nextBtn) return

    prevBtn.disabled = loan_flow_year_index >= kpi_years.length - 1
    nextBtn.disabled = loan_flow_year_index <= 0
}

/* ============================
   Carousel Event Section
============================ */
function toggleCard(id) {
    const body = document.getElementById(id)
    const icon = document.getElementById(`icon-${id}`)
    const isOpen = !body.classList.contains('collapsed')
    body.classList.toggle('collapsed', isOpen)
    icon.innerHTML = isOpen ? iconChevronOpen() : iconChevronClose()
    const state = loadFilters(CARD_STATE_KEY) || {}
    state[id] = !isOpen
    saveFilters(CARD_STATE_KEY, state)
}

function initHomeCarousel() {
    const carousel = document.querySelector('.home-carousel')
    if (!carousel) return
    const prevBtn = document.getElementById('carousel-prev')
    const nextBtn = document.getElementById('carousel-next')
    const savedPosition = loadFilters(CAROUSEL_POSITION_KEY)
    if (savedPosition && typeof savedPosition.scrollLeft === 'number') {
        requestAnimationFrame(() => {
            carousel.scrollLeft = savedPosition.scrollLeft
        })
    }
    carousel.addEventListener('scroll', () => {
        saveFilters(CAROUSEL_POSITION_KEY, {
            scrollLeft: carousel.scrollLeft
        })
        updateCarouselButtons()
    })

    function updateCarouselButtons() {
        if (!prevBtn || !nextBtn) return
        const maxScrollLeft = carousel.scrollWidth - carousel.clientWidth
        prevBtn.disabled = carousel.scrollLeft <= 0
        nextBtn.disabled = carousel.scrollLeft >= maxScrollLeft - 1
    }

    updateCarouselButtons()
    window.addEventListener('resize', updateCarouselButtons)
}

function scrollCarouselNext() {
    const carousel = document.querySelector('.home-carousel')
    if (!carousel) return
    carousel.scrollBy({ left: carousel.clientWidth * 0.8, behavior: 'smooth' })
}

function scrollCarouselPrev() {
    const carousel = document.querySelector('.home-carousel')
    if (!carousel) return
    carousel.scrollBy({ left: -carousel.clientWidth * 0.8, behavior: 'smooth' })
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\indexes\loan-payments-index.js
```
 
```js
/* ============================================================================
1. Constantes globales
2. Variables de estado
3. Selectores DOM
4. Utils generales
5. Render helpers (formatters)
6. Render Desktop / Mobile
7. Render principal
8. Data (loadPayments)
9. Filtros (texto)
10. Status Filter UI (N/A)
11. Acciones (redirects / selects)
12. Eventos
13. Scroll 
14. Init (DOMContentLoaded + loadPayments)
============================================================================ */

/* ============================
   1. Constantes globales
============================ */
const API_BASE = `/payments/list/${window.LOAN_ID}/loan`
const FILTER_KEY = `payments.filters.${window.USER_ID}.${window.LOAN_ID}`
const SELECTED_KEY = `payments.selected.${window.USER_ID}.${window.LOAN_ID}`
const SCROLL_KEY = `payments.scroll.${window.USER_ID}.${window.LOAN_ID}`

/* ============================
   2. Variables de estado
============================ */
let allPayments = []

/* ============================
   Layout detection (AGREGADO)
============================ */
function getLayoutMode() {
  const w = window.innerWidth

  if (w >= 1024) return 'desktop'
  if (w >= 769) return 'tablet'
  return 'mobile'
}

let currentLayout = getLayoutMode()

/* ============================
   3. Selectores DOM
============================ */
const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')
const searchBtn = document.getElementById('search-btn')
const tableBody = document.getElementById('payments-table')
const scrollContainer = document.querySelector('.ui-scroll-area')

/* ============================
   4. Utils generales
============================ */
function debounce(fn, delay) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), delay)
  }
}

const formatAmount = value =>
  Number(value).toLocaleString('es-EC', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

/*const formatDate = value =>
  new Date(value).toLocaleDateString('es-EC')*/

/* ============================
   5. Render helpers
============================ */
function paymentLabel(payment_number) {
  if (payment_number === 0) return 'No Aplica'
  return `${numberBox(payment_number)}`
}

function renderRow(payment) {
  const { date, time, weekday } = formatDateTime(payment.payment_date)

  return `
    <tr id="payment-${payment.id}">
      <td class="px-4 py-2 text-center col-nowrap">
        <div>${date}</div>
        <div class="text-xs text-gray-600">${time}</div>
        <div class="text-xs text-gray-600">${weekday}</div>
      </td>
      <td class="ui-td col-right">${formatAmount(payment.principal_paid)}</td>
      <td class="ui-td col-right">${formatAmount(payment.interest_paid)}</td>
      <td class="ui-td col-left">${payment.account?.name || '-'}</td>
      <td class="ui-td col-left">${payment.category?.name || '-'}</td>
      <td class="ui-td col-right">${paymentLabel(payment.payment_number)}</td>
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button
            class="icon-btn edit"
            title="Editar"
            onclick="goToPaymentUpdate(${payment.id})">
            ${iconEdit()}
            <span class="ui-btn-text">Editar</span>
          </button>
          <button 
            class="icon-btn clone" 
            title="Clonar"
            onclick="goToPaymentClone(${payment.id})">
            ${iconClone()}
            <span class="ui-btn-text">Clonar</span>
          </button>
          <button
            class="icon-btn delete"
            title="Eliminar"
            onclick="goToPaymentDelete(${payment.id})">
            ${iconDelete()}
            <span class="ui-btn-text">Eliminar</span>
          </button>
        </div>
      </td>
    </tr>
  `
}

function renderCard(payment) {
  const { date, time, weekday } = formatDateTime(payment.payment_date)

  return `
    <div class="payment-card"
         data-id="${payment.id}"
         onclick="selectPaymentCard(event, ${payment.id})">

      <div class="card-header">
        <div class="card-datetime">
          <span class="card-date">${date}</span>
          <span class="card-weekday">${weekday}</span>
        </div>

        <div class="card-actions">
          <button
            class="icon-btn edit"
            onclick="event.stopPropagation(); goToPaymentUpdate(${payment.id})">
            ${iconEdit()}
          </button>
          <button 
            class="icon-btn clone"
            onclick="event.stopPropagation(); goToPaymentClone(${payment.id})">
            ${iconClone()}
          </button>
          <button
            class="icon-btn delete"
            onclick="event.stopPropagation(); goToPaymentDelete(${payment.id})">
            ${iconDelete()}
          </button>
        </div>
      </div>

      <div class="card-body payment-amounts">
        <div class="amount-item">
          <div class="amount-label">Capital</div>
          <div class="amount-value">${formatAmount(payment.principal_paid)}</div>
        </div>

        <div class="amount-item">
          <div class="amount-label">Interés</div>
          <div class="amount-value">${formatAmount(payment.interest_paid)}</div>
        </div>

        <div class="amount-item">
          <div class="amount-label">Total</div>
          <div class="amount-value">${formatAmount(payment.principal_paid + payment.interest_paid)}</div>
        </div>
      </div>

      <div class="card-footer">
        <div class="footer-left">
          <div class="footer-account">${payment.account?.name || '-'}</div>
          <div class="footer-category">${payment.category?.name || '-'}</div>
        </div>

        <div class="footer-right">
          <span class="footer-label">Pago No.</span>
          <span class="footer-number">${paymentLabel(payment.payment_number)}</span>
        </div>
      </div>
    </div>
  `
}

/* ============================
   6. Render Desktop / Mobile
============================ */
function renderTable(data) {
  if (!data.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="ui-td col-center text-gray-500">
          No se encontraron pagos
        </td>
      </tr>
    `
    restoreScroll()
    return
  }

  tableBody.innerHTML = data.map(renderRow).join('')

  const selected = loadFilters(SELECTED_KEY)
  if (selected?.id) {
    const row = document.getElementById(`payment-${selected.id}`)
    if (row) row.classList.add('tr-selected')
  }

  restoreScroll()
}

function renderCards(data) {
  const container = document.getElementById('payments-mobile')
  if (!container) return

  container.innerHTML = data.length
    ? data.map(renderCard).join('')
    : `<div class="ui-empty">No se encontraron pagos</div>`

  const selected = loadFilters(SELECTED_KEY)
  if (selected?.id) {
    const card = container.querySelector(`[data-id="${selected.id}"]`)
    if (card) card.classList.add('card-selected')
  }

  restoreScroll()
}

/* ============================
   7. Render principal
============================ */
function render(data) {
  if (window.innerWidth <= 768) {
    renderCards(data)
  } else {
    renderTable(data)
  }
}

/* ============================
   8. Data (loadPayments)
============================ */
async function loadPayments() {
  const res = await fetch(API_BASE)
  allPayments = await res.json()

  const cached = loadFilters(FILTER_KEY)
  if (cached?.term) {
    searchInput.value = cached.term
    clearBtn.classList.remove('hidden')
    filterPayments()
  } else {
    render(allPayments)
  }
}

/* ============================
   9. Filtros (texto)
============================ */
function filterPayments() {
  const term = searchInput.value.trim().toLowerCase()
  saveFilters(FILTER_KEY, { term })
  saveFilters(SCROLL_KEY, { y: 0 })

  render(
    !term
      ? allPayments
      : allPayments.filter(p =>
        p.account?.name?.toLowerCase().includes(term)
      )
  )
}

const debouncedFilter = debounce(filterPayments, 300)

/* ============================
   10. Status Filter UI
============================ */
// No aplica para Payments

/* ============================
   11. Acciones (redirects / selects)
============================ */
function goToPaymentUpdate(id) {
  window.location.href = `/payments/update/${id}`
}

function goToPaymentClone(id) {
  location.href = `/payments/clone/${id}`
}

function goToPaymentDelete(id) {
  window.location.href = `/payments/delete/${id}`
}

function selectPaymentCard(event, id) {
  if (event.target.closest('button')) return

  document
    .querySelectorAll('.payment-card')
    .forEach(card => card.classList.remove('card-selected'))

  event.currentTarget.classList.add('card-selected')
  saveFilters(SELECTED_KEY, { id })
}

/* ============================
   12. Eventos
============================ */
searchBtn.addEventListener('click', filterPayments)

searchInput.addEventListener('input', () => {
  clearBtn.classList.toggle('hidden', !searchInput.value)
  debouncedFilter()
})

clearBtn.addEventListener('click', () => {
  searchInput.value = ''
  clearBtn.classList.add('hidden')
  clearFilters(FILTER_KEY)
  clearFilters(SELECTED_KEY)
  render(allPayments)
})

document
  .querySelector('.ui-table')
  ?.addEventListener('click', event => {

    if (event.target.closest('button') || event.target.closest('a')) return

    const row = event.target.closest('tr[id^="payment-"]')
    if (!row) return

    document
      .querySelectorAll('#payments-table tr')
      .forEach(tr => tr.classList.remove('tr-selected'))

    row.classList.add('tr-selected')

    const id = row.id.replace('payment-', '')
    saveFilters(SELECTED_KEY, { id })
  })

/* ============================
   13. Scroll
============================ */
function restoreScroll() {
  if (!scrollContainer) return

  const saved = loadFilters(SCROLL_KEY)
  if (!saved?.y) return

  requestAnimationFrame(() => {
    scrollContainer.scrollTop = saved.y
  })
}

scrollContainer?.addEventListener('scroll', () => {
  saveFilters(SCROLL_KEY, { y: scrollContainer.scrollTop })
})

/* ============================
   14. Init
============================ */
document.addEventListener('DOMContentLoaded', () => {
  loadPayments()

  window.addEventListener('resize', () => {
    const nextLayout = getLayoutMode()

    if (nextLayout !== currentLayout) {
      currentLayout = nextLayout
      filterPayments()
    }
  })
})
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\indexes\loans-index.js
```
 
```js
/* ============================================================================
1. Constantes globales
2. Variables de estado
3. Selectores DOM
4. Utils generales
5. Render helpers (iconos, tags, cajas)
6. Render Desktop / Mobile
7. Render principal
8. Data (loadLoans)
9. Filtros (texto + estado)
10. Status Filter UI
11. Acciones (redirects / selects)
12. Eventos
13. Scroll
14. Init
============================================================================ */

/* =========================================================
1. Constantes globales
========================================================= */
const API_BASE = '/loans/list'
const FILTER_KEY = `loans.filters.${window.USER_ID}`
const SELECTED_KEY = `loans.selected.${window.USER_ID}`
const SCROLL_KEY = `loans.scroll.${window.USER_ID}`
const STATUS_FILTER_KEY = `loans.statusFilter.${window.USER_ID}`
const COLLAPSE_KEY = `loans.collapse.${window.USER_ID}`

/* =========================================================
2. Variables de estado
========================================================= */
let allLoans = []

/* ============================
   Layout detection
============================ */
function getLayoutMode() {
  const w = window.innerWidth

  if (w >= 1024) return 'desktop'
  if (w >= 769) return 'tablet'
  return 'mobile'
}

let currentLayout = getLayoutMode()

/* =========================================================
3. Selectores DOM
========================================================= */
const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')
const searchBtn = document.getElementById('search-btn')
const tableBody = document.getElementById('loans-table')
const scrollContainer = document.querySelector('.ui-scroll-area')
const statusToggleBtn = document.querySelector('.js-status-filter-toggle')

const newBtn = document.querySelector('[data-btn="new"]')
const insertModal = document.getElementById('insert-modal')
const insertModalContent = document.getElementById('insert-modal-content')
const insertGroupBtn = document.getElementById('insert-group')
const insertChildBtn = document.getElementById('insert-child')
const closeInsertModalBtn = document.getElementById('close-modal')

/* =========================================================
4. Utils generales
========================================================= */
function debounce(fn, delay) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), delay)
  }
}

function isLoanGroupCollapsed(groupId) {
  const state = loadFilters(COLLAPSE_KEY) || {}
  return !!state[groupId]
}

function toogleLoanGroupCollapse(groupId) {
  const state = loadFilters(COLLAPSE_KEY) || {}
  state[groupId] = !state[groupId]
  saveFilters(COLLAPSE_KEY, state)
  applyAllFilters()
}

function getGroupPendingTotal(group_id) {
  if (!window.groupTotals) return 0
  const group = window.groupTotals.find(g => g.loan_group_id === group_id)
  return group ? group.total_balance : 0
}

function getParentBackgroundColor(index, total) {
  if (total <= 1) return 'hsl(210, 40%, 96%)'

  const startLightness = 96
  const endLightness = 88
  const step = (startLightness - endLightness) / (total - 1)

  const lightness = startLightness - (step * index)

  return `hsl(140, 35%, ${lightness}%)`
}

/* =========================================================
5. Render helpers
========================================================= */
/*
  iconEdit()
  iconDelete()
  iconList()
  iconView()
  iconViewOff()
  iconChevronOpen()
  iconChevronClose()
  amountBox()
  statusTag()
  → ya existen en tu proyecto
*/

/* =========================================================
6. Render Desktop
========================================================= */
function renderRow(loan) {
  const { date, time, weekday } = formatDateTime(loan.start_date)
  const group_id = loan.loan_group ? loan.loan_group.id : null
  if (group_id && isLoanGroupCollapsed(group_id)) {
    return ''
  }

  const rowClass = loan.is_active ? '' : 'bg-red-50'
  return `
    <tr id="loan-${loan.id}" class="${rowClass}">
      <td class="ui-td col-left">
        <div class="child-cell">
          <span class="child-indent"></span>
          <div class="loan-name-block">
            <div class="loan-name">${loan.name}</div>
            <div class="loan-date">
              ${date} · ${weekday}
            </div>
          </div>
        </div>
      </td>
      <td class="ui-td col-right">${amountBox(loan.total_amount)}</td>
      <td class="ui-td col-right">${amountBox(loan.principal_paid)}</td>
      <td class="ui-td col-right">${amountBox(loan.interest_paid)}</td>
      <td class="ui-td col-right">${amountBox(loan.balance)}</td>
      <td class="ui-td col-left">${statusTag(loan.is_active)}</td>
      <td class="ui-td col-left">${loan.disbursement_account ? loan.disbursement_account.name : '-'}</td>
      <td class="ui-td col-left">${loan.category ? loan.category.name : '-'}</td>
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button 
            class="icon-btn edit" 
            onclick="goToLoanUpdate(${loan.id})">
            ${iconEdit()}
            <span class="ui-btn-text">Editar</span>
          </button>
          <button
            class="icon-btn delete" 
            onclick="goToLoanDelete(${loan.id})">
            ${iconDelete()}
            <span class="ui-btn-text">Eliminar</span>
          </button>
          <button 
            class="icon-btn" 
            onclick="goToLoanView(${loan.id})">
            ${iconList()}
            <span class="ui-btn-text">Detalles</span>
          </button>
        </div>
      </td>
    </tr>
  `
}

/* =========================================================
7. Render Mobile
========================================================= */
function renderCard(loan) {
  const { date, time, weekday } = formatDateTime(loan.start_date)
  const group_id = loan.loan_group ? loan.loan_group.id : null
  if (group_id && isLoanGroupCollapsed(group_id)) {
    return ''
  }

  return `
    <div 
      class="loan-card ${loan.is_active ? '' : 'inactive'}"
      data-id="${loan.id}"
      onclick="selectLoanCard(event, ${loan.id})">

      <div class="card-header">
        <div class="card-title">
          ${loan.name}
        </div>
        <div class="card-actions">
          <button 
            class="icon-btn edit"
            onclick="event.stopPropagation(); goToLoanUpdate(${loan.id})">
            ${iconEdit()}
          </button>
          <button 
            class="icon-btn delete"
            onclick="event.stopPropagation(); goToLoanDelete(${loan.id})">
            ${iconDelete()}
          </button>
          <button 
            class="icon-btn"
            onclick="event.stopPropagation(); goToLoanView(${loan.id})">
            ${iconList()}
          </button>
        </div>
      </div>

      <div class="card-balance">${amountBox(loan.balance)}</div>

      <div class="card-sub loan-amounts">
        <div class="loan-amount-item">
          <div class="loan-amount-title">Monto</div>
          <div class="loan-amount-value">${amountBox(loan.total_amount)}</div>
        </div>
        <div class="loan-amount-item">
          <div class="loan-amount-title">Capital</div>
          <div class="loan-amount-value">${amountBox(loan.principal_paid)}</div>
        </div>
        <div class="loan-amount-item">
          <div class="loan-amount-title">Interés</div>
          <div class="loan-amount-value">${amountBox(loan.interest_paid)}</div>
        </div>
      </div>

      <div class="card-footer">
        <span>
          <div class="date-block">
            <div class="date-text">${date}</div>
            <div class="weekday-text">${weekday}</div>
          </div>
        </span>

        <div class="card-tags">
          <div class="tag-line">
            ${statusTag(loan.is_active)}
          </div>
          <div class="tag-line">
            ${loan.disbursement_account ? loan.disbursement_account.name : '-'}
          </div>
          <div class="tag-line">
            ${loan.category ? loan.category.name : '-'}
          </div>
        </div> 

        </div>
    </div>
  `
}

/* =========================================================
8. Render principal
========================================================= */
function renderTable(data) {
  if (!data.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" class="ui-td col-center text-gray-500">
          No se encontraron préstamos
        </td>
      </tr>
    `
    restoreScroll()
    return
  }

  const groupsMap = new Map()

  data.forEach(loan => {
    const group = loan.loan_group || { id: 0, name: 'Sin grupo' }
    if (!groupsMap.has(group.id)) {
      groupsMap.set(group.id, { group, loans: [] })
    }
    groupsMap.get(group.id).loans.push(loan)
  })

  const html = Array.from(groupsMap.values()).map(entry => {
    const group = entry.group
    const loans = entry.loans
    const collapsed = isLoanGroupCollapsed(group.id)
    const pending = getGroupPendingTotal(group.id)

    const groupRow = `
      <tr class="parent-row">
        <td class="ui-td col-left">
          <div class="group-cell">
            <button class="group-toggle" onclick="toogleLoanGroupCollapse(${group.id})">
              ${collapsed ? iconChevronOpen() : iconChevronClose()}
            </button>
            <span class="group-name">${group.name}</span>
          </div>
        </td>
        <td class="ui-td col-right group-pending" colspan="3">
          Pendiente: ${amountBox(pending)}
        </td>
        <td class="ui-td col-right" colspan="5">
          <div class="icon-actions">
            <button 
                class="icon-btn edit" 
                onclick="goToLoanGroupUpdate(${group.id})">
                ${iconEdit()}
                <span class="ui-btn-text">Editar</span>
              </button>
              <button 
                class="icon-btn delete" 
                onclick="goToLoanGroupDelete(${group.id})">
                ${iconDelete()}
                <span class="ui-btn-text">Eliminar</span>
              </button>
            </div>
        </td>
      </tr>
    `

    const loanRows = collapsed ? '' : loans.map(l => renderRow(l)).join('')
    return groupRow + loanRows
  }).join('')

  tableBody.innerHTML = html

  const selected = loadFilters(SELECTED_KEY)
  if (selected?.id) {
    const row = document.getElementById(`loan-${selected.id}`)
    if (row) row.classList.add('tr-selected')
  }

  restoreScroll()
}

function renderCards(data) {
  const container = document.getElementById('loans-mobile')
  if (!container) return

  const groupsMap = new Map()

  data.forEach(loan => {
    const group = loan.loan_group || { id: 0, name: 'Sin grupo' }
    if (!groupsMap.has(group.id)) {
      groupsMap.set(group.id, { group, loans: [] })
    }
    groupsMap.get(group.id).loans.push(loan)
  })

  const groups = Array.from(groupsMap.values())
  const totalParents = groups.length

  const html = groups.map((entry, index) => {
    const group = entry.group
    const loans = entry.loans
    const collapsed = isLoanGroupCollapsed(group.id)
    const bgColor = getParentBackgroundColor(index, totalParents)
    const pending = getGroupPendingTotal(group.id)


    const cards = collapsed ? '' : loans.map(l => renderCard(l)).join('')

    return `
      <div class="loan-group ${collapsed ? 'collapsed' : ''}" style="background:${bgColor};">
        <div class="loan-group-header">

          <div class="loans-group-header-left">
            <button onclick="toogleLoanGroupCollapse(${group.id})">
              ${collapsed ? iconChevronOpen() : iconChevronClose()}
            </button>
          </div>

          <div class="loans-group-center">
            <span class="loans-group-title">${group.name}</span>
            <span class="loans-group-pending">
              Pendiente: ${amountBox(pending)}
            </span>
          </div>

          <div class="loans-group-actions">
            <button 
              class="icon-btn edit"
              onclick="event.stopPropagation();goToLoanGroupUpdate(${group.id})">
              ${iconEdit()}
            </button>
            <button 
              class="icon-btn delete"
              onclick="event.stopPropagation();goToLoanGroupDelete(${group.id})">
              ${iconDelete()}
            </button>
          </div>

        </div>

        <div class="loan-group-body">
          ${cards}
        </div>
      </div>
    `

  }).join('')

  container.innerHTML = html

  const selected = loadFilters(SELECTED_KEY)
  if (selected?.id) {
    const card = container.querySelector(`[data-id="${selected.id}"]`)
    if (card) card.classList.add('card-selected')
  }

  restoreScroll()
}

function render(data) {
  window.innerWidth <= 768 ? renderCards(data) : renderTable(data)
}

/* ============================
   8. Data
============================ */
async function loadLoans() {
  const res = await fetch(API_BASE)
  const data = await res.json()
  allLoans = data.loans || []
  window.groupTotals = data.group_totals || []

  const cachedText = loadFilters(FILTER_KEY)
  const cachedStatus = loadFilters(STATUS_FILTER_KEY)

  if (cachedText?.term) {
    searchInput.value = cachedText.term
    clearBtn.classList.remove('hidden')
  }

  syncStatusFilterButton(cachedStatus?.status || 'all')
  applyAllFilters()
}

/* =========================================================
9. Filtros (texto + estado)
========================================================= */
function getFilteredLoans() {
  const cached = loadFilters(FILTER_KEY)
  const statusCached = loadFilters(STATUS_FILTER_KEY)

  const term = cached?.term?.toLowerCase() || ''
  const status = statusCached?.status || 'all'

  return allLoans.filter(loan => {
    const matchText =
      !term || loan.name.toLowerCase().includes(term)

    const matchStatus =
      status === 'all' ||
      (status === 'active' && loan.is_active) ||
      (status === 'inactive' && !loan.is_active)

    return matchText && matchStatus
  })
}

function applyAllFilters() {
  const filtered = getFilteredLoans()
  render(filtered)
}

function filterLoans() {
  const term = searchInput.value.trim().toLowerCase()
  saveFilters(FILTER_KEY, { term })
  saveFilters(SCROLL_KEY, { y: 0 })
  applyAllFilters()
}

/* =========================================================
10. Status Filter UI
========================================================= */
function syncStatusFilterButton(status) {
  if (!statusToggleBtn) return

  const icon = statusToggleBtn.querySelector('.ui-btn-icon')
  const text = statusToggleBtn.querySelector('.ui-btn-text')

  if (status === 'active') {
    icon.innerHTML = iconView()
    text.textContent = 'Activas'
  } else if (status === 'inactive') {
    icon.innerHTML = iconViewOff()
    text.textContent = 'Inactivas'
  } else {
    icon.innerHTML = iconList()
    text.textContent = 'Todas'
  }

  statusToggleBtn.dataset.status = status
}

function applyStatusFilter(status) {
  saveFilters(STATUS_FILTER_KEY, { status })
  syncStatusFilterButton(status)
  applyAllFilters()
}

/* =========================================================
11. Acciones
========================================================= */
function goToLoanUpdate(id) {
  location.href = `/loans/update/${id}`
}

function goToLoanDelete(id) {
  location.href = `/loans/delete/${id}`
}

function goToLoanView(id) {
  location.href = `/loans/${id}/loan`
}

function selectLoanCard(event, id) {
  if (event.target.closest('button')) return

  document.querySelectorAll('.loan-card')
    .forEach(card => card.classList.remove('card-selected'))

  event.currentTarget.classList.add('card-selected')
  saveFilters(SELECTED_KEY, { id })
}

function goToLoanGroupInsert() {
  location.href = `/loan-groups/insert`
}

function goToLoanGroupUpdate(id) {
  location.href = `/loan-groups/update/${id}`
}

function goToLoanGroupDelete(id) {
  location.href = `/loan-groups/delete/${id}`
}

/* =========================================================
12. Eventos
========================================================= */
const debouncedFilter = debounce(filterLoans, 300)

searchBtn?.addEventListener('click', applyAllFilters)

searchInput?.addEventListener('input', () => {
  clearBtn.classList.toggle('hidden', !searchInput.value)
  debouncedFilter()
})


clearBtn?.addEventListener('click', () => {
  searchInput.value = ''
  clearBtn.classList.add('hidden')
  clearFilters(FILTER_KEY)
  clearFilters(SELECTED_KEY)
  applyAllFilters()
})

statusToggleBtn?.addEventListener('click', () => {
  const current = statusToggleBtn.dataset.status || 'all'
  const next =
    current === 'all' ? 'active'
      : current === 'active' ? 'inactive'
        : 'all'

  applyStatusFilter(next)
})

/* ============================
   Modal Nuevo (Grupo o Hija)
============================ */
function openModal() {
  if (insertModal) insertModal.classList.remove('hidden')
}
function closeModal() {
  if (insertModal) insertModal.classList.add('hidden')
}

newBtn?.addEventListener('click', (e) => {
  e.preventDefault()
  openModal()
})

closeInsertModalBtn?.addEventListener('click', () => {
  closeModal()
})

insertGroupBtn?.addEventListener('click', () => {
  goToLoanGroupInsert()
})

insertChildBtn?.addEventListener('click', () => {
  location.href = '/loans/insert'
})

insertModal?.addEventListener('click', (e) => {
  if (!insertModalContent?.contains(e.target)) {
    insertModal.classList.add('hidden')
  }
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    insertModal?.classList.add('hidden')
  }
})

/* =========================================================
13. Scroll
========================================================= */
function restoreScroll() {
  if (!scrollContainer) return
  const saved = loadFilters(SCROLL_KEY)
  if (!saved?.y) return

  requestAnimationFrame(() => {
    scrollContainer.scrollTop = saved.y
  })
}

scrollContainer?.addEventListener('scroll', () => {
  saveFilters(SCROLL_KEY, { y: scrollContainer.scrollTop })
})

/* =========================================================
14. Init
========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  loadLoans()

  window.addEventListener('resize', () => {
    const nextLayout = getLayoutMode()

    if (nextLayout !== currentLayout) {
      currentLayout = nextLayout
      applyAllFilters()
    }
  })
})

 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\indexes\transactions-batch-categorize-index.js
```
 
```js
/* ============================================================================
   1. Constantes batch (NO colisionan con las existentes)
============================================================================ */
const BATCH_STATE_KEY = `transactions.batch_state.${window.USER_ID}`
const BATCH_SELECTED_KEY = `transactions.batch_selected.${window.USER_ID}`

/* ============================================================================
   2. Selectores de botones batch
============================================================================ */
const btn_batch_start = document.getElementById('btn-batch-start')
const btn_batch_accept = document.getElementById('btn-batch-accept')
const btn_batch_cancel = document.getElementById('btn-batch-cancel')

/* ============================================================================
   3. Estado batch usando helpers existentes (saveFilters / loadFilters / clearFilters)
============================================================================ */
function batchGetState() {
  return loadFilters(BATCH_STATE_KEY) || { active: false }
}

function batchSetState(state) {
  saveFilters(BATCH_STATE_KEY, state)
}

function batchClearState() {
  clearFilters(BATCH_STATE_KEY)
}

/* ============================================================================
   4. Selección batch (lista de IDs)
============================================================================ */
function batchGetSelected() {
  const data = loadFilters(BATCH_SELECTED_KEY)
  return data?.ids || []
}

function batchSetSelected(ids) {
  saveFilters(BATCH_SELECTED_KEY, { ids })
}

function batchClearSelected() {
  clearFilters(BATCH_SELECTED_KEY)
}

/* ============================================================================
   5. UI: alternar toolbar normal / batch
============================================================================ */
function batchApplyUi(is_active) {
  const batch_actions = document.getElementById('toolbar-batch-actions')
  const btn_new = document.querySelector('[data-btn="new"]')
  const btn_categorize = document.querySelector('[data-btn="categorize"]')

  if (!batch_actions) return

  if (is_active) {
    if (btn_new) btn_new.classList.add('hidden')
    if (btn_categorize) btn_categorize.classList.add('hidden')
    batch_actions.classList.remove('hidden')
  } else {
    if (btn_new) btn_new.classList.remove('hidden')
    if (btn_categorize) btn_categorize.classList.remove('hidden')
    batch_actions.classList.add('hidden')
  }
}

/* ============================================================================
   6. UI: desactivar acciones por fila (editar / clonar / eliminar)
============================================================================ */
function batchToggleActionButtons(hide) {
  const buttons = document.querySelectorAll('.icon-btn')

  buttons.forEach(btn => {
    btn.classList.toggle('hidden', hide)
  })
}

/* ============================================================================
   7. Toggle de selección de una transacción en modo batch
============================================================================ */
function batchToggleSelection(id, checked) {
  const current = batchGetSelected()

  let next

  if (checked) {
    if (!current.includes(id)) {
      next = [...current, id]
    } else {
      next = current
    }
  } else {
    next = current.filter(x => x !== id)
  }

  batchSetSelected(next)
}

/* ============================================================================
   8. Restaurar selección visual al cargar o volver a la página
============================================================================ */
function batchRestoreSelection() {
  const selected = batchGetSelected()

  selected.forEach(id => {
    const checkbox = document.querySelector(`[data-transaction-id="${id}"]`)
    if (checkbox) {
      checkbox.checked = true
    }
  })
}

/* ============================================================================
   9. Limpiar selección visual
============================================================================ */
function batchClearUiSelection() {
  const checkboxes = document.querySelectorAll('[data-transaction-id]')
  checkboxes.forEach(cb => {
    cb.checked = false
  })
}

/* ============================================================================
   10. Acciones de botones batch
============================================================================ */
function batchStartCategorize() {
  batchSetState({ active: true })
  batchApplyUi(true)
  render(allItems)
  batchToggleActionButtons(true)
  batchRestoreSelection()
}

function batchAcceptCategorize() {
  const ids = batchGetSelected()
  if (!ids.length) {
    alert('Debe seleccionar al menos una transacción')
    return
  }
  const params = new URLSearchParams(window.location.search)
  const category_id = params.get('category_id')
  const from = params.get('from')
  const query = ids.join(',')
  const next = new URLSearchParams({ ids: query })
  if (category_id) next.set('category_id', category_id)
  if (from) next.set('from', from)
  location.href = `/transactions/batch-categorize?${next.toString()}`
}


function batchCancelCategorize() {
  batchClearState()
  batchClearSelected()
  batchApplyUi(false)
  render(allItems)
  batchToggleActionButtons(false)
  batchClearUiSelection()
}

function batchRestoreState() {
  batchClearState()
  batchClearSelected()
  batchApplyUi(false)
  batchToggleActionButtons(false)
  batchClearUiSelection()
}

/* ============================================================================
   11. Binding de eventos
============================================================================ */
if (btn_batch_start) {
  btn_batch_start.addEventListener('click', batchStartCategorize)
}

if (btn_batch_accept) {
  btn_batch_accept.addEventListener('click', batchAcceptCategorize)
}

if (btn_batch_cancel) {
  btn_batch_cancel.addEventListener('click', batchCancelCategorize)
}

/* ============================================================================
   13. Exponer funciones batch globalmente (para usar desde render de filas/cards)
============================================================================ */
window.batchToggleSelection = batchToggleSelection
window.batchStartCategorize = batchStartCategorize
window.batchAcceptCategorize = batchAcceptCategorize
window.batchCancelCategorize = batchCancelCategorize
window.batchRestoreState = batchRestoreState
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\public\js\indexes\transactions-index.js
```
 
```js
/* ============================================================================
1. Constantes globales
============================================================================ */
const API_BASE = '/transactions/list'
const FILTER_KEY = `transactions.filters.${window.USER_ID}`
const SELECTED_KEY = `transactions.selected.${window.USER_ID}`
const PAGE_SIZE = 10

const context = window.TRANSACTIONS_CONTEXT || {}
const CATEGORY_ID = context.category_id || null
const SAVED_BATCH = context.saved_batch || false

/* ============================================================================
2. Variables de estado
============================================================================ */
let currentPage = 1
let currentSearch = ''
let totalPages = 1
let allItems = []

/* ============================
   Layout detection (AGREGADO)
============================ */
function getLayoutMode() {
  const w = window.innerWidth

  if (w >= 1024) return 'desktop'
  if (w >= 769) return 'tablet'
  return 'mobile'
}

let currentLayout = getLayoutMode()

/* ============================================================================
3. Selectores DOM
============================================================================ */
const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')
const searchBtn = document.getElementById('search-btn')
const tableBody = document.getElementById('transactions-table')
const table = document.querySelector('.ui-table')

/* ============================================================================
4. Utils generales
============================================================================ */
function debounce(fn, delay) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), delay)
  }
}

function rowClassByType(type) {
  if (type === 'income') return 'income'
  if (type === 'expense') return 'expense'
  if (type === 'transfer') return 'transfer'
  return ''
}

function isBatchActive() {
  if (typeof batchGetState !== 'function') return false
  const state = batchGetState()
  return !!state?.active
}

/* ============================================================================
5. Render helpers (iconos, tags, cajas)
============================================================================ */
function hideAllTransactionDetails() {
  document.querySelectorAll('.transaction-detail-row')
    .forEach(row => row.classList.add('hidden'))
}

function showTransactionDetail(id) {
  hideAllTransactionDetails()

  const detail_row = document.getElementById(`transaction-detail-${id}`)

  if (detail_row) {
    detail_row.classList.remove('hidden')
  }
}

function showTransactionCardDetail(id) {
  document
    .querySelectorAll('.transaction-card-detail')
    .forEach(el => el.classList.add('hidden'))

  document
    .getElementById(`transaction-card-detail-${id}`)
    ?.classList.remove('hidden')
}

function renderTable(data) {
  if (!data.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="ui-td col-center text-gray-500">
          No se encontraron transacciones
        </td>
      </tr>
    `
    return
  }

  tableBody.innerHTML = data.map(renderRow).join('')

  const selected = loadFilters(SELECTED_KEY)
  if (selected?.id) {
    const row = document.getElementById(`transaction-${selected.id}`)
    if (row) {
      row.classList.add('tr-selected')
      showTransactionDetail(selected.id)
    }
  }
}

function renderCards(data) {
  const container = document.getElementById('transactions-mobile')
  if (!container) return

  container.innerHTML = data.length
    ? data.map(renderCard).join('')
    : `<div class="ui-empty">No se encontraron transacciones</div>`

  const selected = loadFilters(SELECTED_KEY)
  if (selected?.id) {
    const card = container.querySelector(`[data-id="${selected.id}"]`)
    if (card) {
      card.classList.add('card-selected')
      showTransactionCardDetail(selected.id)
    }
  }
}

/* ============================================================================
6. Render Desktop / Mobile
============================================================================ */
function renderRow(transaction) {
  const { date, time, weekday } = formatDateTime(transaction.date)

  let action_name = ""
  let action_id = 0
  if (transaction.loan) {
    action_name = "loan"
    action_id = transaction.loan.id
  } else if (transaction.loan_payment) {
    action_name = "payment"
    action_id = transaction.loan_payment.id
  } else {
    action_name = "transaction"
    action_id = transaction.id
  }

  return `
    <tr id="transaction-${transaction.id}" class="${rowClassByType(transaction.type)}">
      <td class="px-4 py-2 text-center col-nowrap">
        <div>${date}</div>
        <div class="text-xs text-gray-600">${time}</div>
        <div class="text-xs text-gray-600">${weekday}</div>
      </td>
      <td class="ui-td col-left">${transactionTypeTag(transaction.type)}</td>
      <td class="ui-td col-right">${amountBox(transaction.amount)}</td>
      <td class="ui-td col-left col-nowrap">
        ${transaction.type === 'transfer'
      ? `
            <div class="grouped-icon-line">
              <span class="grouped-icon">${iconTransferOut()}</span>
              <span>${transaction.account?.name || '-'}</span>
            </div>
            <div class="grouped-icon-line">
              <span class="grouped-icon">${iconTransferIn()}</span>
              <span>${transaction.to_account?.name || '-'}</span>
            </div>
          `
      : transaction.type === 'income'
        ? `
        <div class="grouped-icon-line">
          <span class="grouped-icon">${iconTransferIn()}</span>
          <span>${transaction.account?.name || '-'}</span>
        </div>
      `
        : transaction.type === 'expense'
          ? `
        <div class="grouped-icon-line">
          <span class="grouped-icon">${iconTransferOut()}</span>
          <span>${transaction.account?.name || '-'}</span>
        </div>
      `
          : '-'
    }
      </td>
      <td class="ui-td col-left col-nowrap">
      ${transaction.category?.name
      ? `
        <div class="grouped-icon-line">
          <span class="grouped-icon">${iconGrouped()}</span>
          <span>${transaction.category?.name || '-'}</span>
        </div>
        ` : ''
    }
      ${transaction.loan_payment?.loan?.name
      ? `
        <div class="grouped-icon-line">
          <span class="grouped-icon">${iconGrouped()}</span>
          <span>${transaction.loan_payment?.loan?.name || '-'}</span>
        </div>
        ` : ''
    }
      ${transaction.loan_payment?.loan?.category?.name
      ? `
        <div class="grouped-icon-line">
          <span class="grouped-icon">${iconGrouped()}</span>
          <span>${transaction.loan_payment?.loan?.category?.name || '-'}</span>
        </div>
        ` : ''
    }
      </td>
      
      <td class="ui-td col-center col-nowrap">
        <div class="icon-actions">

          ${isBatchActive() ? `
            <input
              type="checkbox"
              data-transaction-id="${transaction.id}"
              onclick="event.stopPropagation(); batchToggleSelection(${transaction.id}, this.checked)"
            >
          ` : ''}

          <button 
            class="icon-btn edit" 
            title="Editar"
            onclick="goToRouteUpdate('${action_name}', ${action_id})">
            ${iconEdit()}
            <span class="ui-btn-text">Editar</span>
          </button>
          <button 
            class="icon-btn clone" 
            title="Clonar"
            onclick="goToRouteClone('${action_name}', ${action_id})">
            ${iconClone()}
            <span class="ui-btn-text">Clonar</span>
          </button>
          <button 
            class="icon-btn delete" 
            title="Eliminar"
            onclick="goToRouteDelete('${action_name}', ${action_id})">
            ${iconDelete()}
            <span class="ui-btn-text">Eliminar</span>
          </button>
        </div>
      </td>
    </tr> 

    <tr id="transaction-detail-${transaction.id}" class="transaction-detail-row hidden">
      <td colspan="8">
        ${transaction.description || '-'}
      </td>
    </tr>
  `
}

function renderCard(transaction) {
  const { date, time, weekday } = formatDateTime(transaction.date)

  let action_name = ""
  let action_id = 0
  if (transaction.loan) {
    action_name = "loan"
    action_id = transaction.loan.id
  } else if (transaction.loan_payment) {
    action_name = "payment"
    action_id = transaction.loan_payment.id
  } else {
    action_name = "transaction"
    action_id = transaction.id
  }

  return `
    <div 
      class="transaction-card ${rowClassByType(transaction.type)}"
      data-id="${transaction.id}"
      onclick="selectTransactionCard(event, ${transaction.id})">

      <div class="card-header">
        <div class="card-datetime">
          <span class="card-date">${date}</span>
          <span class="card-time">${time}</span>
          <span class="card-weekday">${weekday}</span>
        </div>

        <div class="card-actions">

          ${isBatchActive() ? `
            <input
              type="checkbox"
              data-transaction-id="${transaction.id}"
              onclick="event.stopPropagation(); batchToggleSelection(${transaction.id}, this.checked)"
            >
          ` : ''}

          <button 
            class="icon-btn edit"
            onclick="event.stopPropagation(); goToRouteUpdate('${action_name}', ${action_id})">
            ${iconEdit()}
          </button>
          <button 
            class="icon-btn clone"
            onclick="event.stopPropagation(); goToRouteClone('${action_name}', ${action_id})">
            ${iconClone()}
          </button>
          <button  
            class="icon-btn delete"
            onclick="event.stopPropagation(); goToRouteDelete('${action_name}', ${action_id})">
            ${iconDelete()}
          </button>
        </div>
      </div>

      <div class="card-content">
        <div class="card-info">
          <div class="card-account">
            ${transaction.type === 'transfer'
      ? `
                <div class="grouped-icon-line">
                  <span class="grouped-icon">${iconTransferOut()}</span>
                  <span>${transaction.account?.name || '-'}</span>
                </div>
                <div class="grouped-icon-line">
                  <span class="grouped-icon">${iconTransferIn()}</span>
                  <span>${transaction.to_account?.name || '-'}</span>
                </div>
              `
      : transaction.type === 'income'
        ? `
                <div class="grouped-icon-line">
                  <span class="grouped-icon">${iconTransferIn()}</span>
                  <span>${transaction.account?.name || '-'}</span>
                </div>
                `
        : transaction.type === 'expense'
          ? `
                <div class="grouped-icon-line">
                  <span class="grouped-icon">${iconTransferOut()}</span>
                  <span>${transaction.account?.name || '-'}</span>
                </div>
                `
          : '-'
    }
          </div>
          ${transaction.category?.name
      ? `<div class="card-category">
              <div class="grouped-icon-line">
                <span class="grouped-icon">${iconGrouped()}</span>
                <span>${transaction.category?.name || '-'}</span>
              </div>
            </div>
          ` : ''
    }
          ${transaction.loan_payment?.loan?.name
      ? `<div class="card-category">
                <div class="grouped-icon-line">
                  <span class="grouped-icon">${iconGrouped()}</span>
                  <span>${transaction.loan_payment?.loan?.name || '-'}</span>
                </div>
              </div>
            ` : ''
    }
          ${transaction.loan_payment?.loan?.category?.name
      ? `<div class="card-category">
                <div class="grouped-icon-line">
                  <span class="grouped-icon">${iconGrouped()}</span>
                  <span>${transaction.loan_payment?.loan?.category?.name || '-'}</span>
                </div>
              </div>
            ` : ''
    }
          <div id="transaction-card-detail-${transaction.id}" class="transaction-card-detail hidden" >
            ${transaction.description}
          </div>
        </div>

        <div class="card-amount">
          ${amountBox(transaction.amount)}
        </div>
      </div>
    </div>
  `
}

/* ============================================================================
7. Render principal
============================================================================ */
function render(data) {
  window.innerWidth <= 768 ? renderCards(data) : renderTable(data)
}

/* ============================================================================
8. Data (loadCategories / loadTransactions)
============================================================================ */
function updatePaginationInfo() {
  document.getElementById('page-info-top').textContent =
    `Página ${currentPage} de ${totalPages}`
}

async function loadTransactions(page = 1) {
  try {
    const params = new URLSearchParams({ page, limit: PAGE_SIZE })
    if (currentSearch) params.append('search', currentSearch)
    if (CATEGORY_ID) params.append('category_id', CATEGORY_ID)

    const res = await fetch(`${API_BASE}?${params}`)

    // Manejar errores de rate limiting
    if (res.status === 429) {
      const errorData = await res.json().catch(() => ({}))
      const retryAfter = errorData.retryAfter || 60
      alert(`⏱️ Límite de solicitudes excedido.\n\nEspera ${retryAfter} segundos antes de intentar nuevamente.`)
      return
    }

    if (!res.ok) {
      throw new Error(`Error ${res.status}: ${res.statusText}`)
    }

    const data = await res.json()

    allItems = data.items
    totalPages = Math.ceil(data.total / PAGE_SIZE)
    currentPage = page

    // 🔹 Guardar filtros incluyendo página
    saveFilters(FILTER_KEY, { term: currentSearch, page: currentPage })

    render(allItems)
    updatePaginationInfo()

    if (isBatchActive()) {
      if (typeof batchApplyUi === 'function') batchApplyUi(true)
      if (typeof batchToggleActionButtons === 'function') batchToggleActionButtons(true)
      if (typeof batchRestoreSelection === 'function') batchRestoreSelection()
    }
  } catch (error) {
    console.error('Error cargando transacciones:', error)
    alert('Error al cargar transacciones. Intenta nuevamente.')
  }
}

/* ============================================================================
9. Filtros (texto + estado)
============================================================================ */
function applySearch() {
  currentSearch = searchInput.value.trim()
  currentPage = 1   // 🔹 Siempre volver a página 1 en nueva búsqueda

  saveFilters(FILTER_KEY, {
    term: currentSearch,
    page: currentPage
  })

  clearBtn.classList.toggle('hidden', !currentSearch)
  loadTransactions(currentPage)
}

/* ============================================================================
10. Status Filter UI
============================================================================ */
/* (reservado para futuros filtros visuales) */

/* ============================================================================
11. Acciones (redirects / selects)
============================================================================ */
function goToRouteUpdate(action_name, action_id) {
  const params = new URLSearchParams()
  if (CATEGORY_ID) {
    params.set('category_id', CATEGORY_ID)
    params.set('from', 'categories')
  }
  if (action_name === "loan") {
    location.href = `/loans/update/${action_id}?${params.toString()}`
  } else if (action_name === "payment") {
    location.href = `/payments/update/${action_id}?${params.toString()}`
  } else {
    location.href = `/transactions/update/${action_id}?${params.toString()}`
  }
}

function goToRouteClone(action_name, action_id) {
  const params = new URLSearchParams()
  if (CATEGORY_ID) {
    params.set('category_id', CATEGORY_ID)
    params.set('from', 'categories')
  }
  if (action_name === "loan") {
    location.href = `/loans/clone/${action_id}?${params.toString()}`
  } else if (action_name === "payment") {
    location.href = `/payments/clone/${action_id}?${params.toString()}`
  } else {
    location.href = `/transactions/clone/${action_id}?${params.toString()}`
  }
}

function goToRouteDelete(action_name, action_id) {
  const params = new URLSearchParams()
  if (CATEGORY_ID) {
    params.set('category_id', CATEGORY_ID)
    params.set('from', 'categories')
  }
  if (action_name === "loan") {
    location.href = `/loans/delete/${action_id}?${params.toString()}`
  } else if (action_name === "payment") {
    location.href = `/payments/delete/${action_id}?${params.toString()}`
  } else {
    location.href = `/transactions/delete/${action_id}?${params.toString()}`
  }
}

function goBackToCategories() {
  location.href = '/categories'
}

function selectTransactionCard(event, id) {
  if (event.target.closest('button')) return

  const card = event.target.closest('.transaction-card')
  if (!card) return

  const detail = document.getElementById(`transaction-card-detail-${id}`)
  const is_open = detail && !detail.classList.contains('hidden')

  if (is_open) {
    card.classList.remove('card-selected')
    detail.classList.add('hidden')
    clearFilters(SELECTED_KEY)
    return
  }

  document.querySelectorAll('.transaction-card')
    .forEach(c => c.classList.remove('card-selected'))

  document.querySelectorAll('.transaction-card-detail')
    .forEach(d => d.classList.add('hidden'))

  card.classList.add('card-selected')
  detail?.classList.remove('hidden')

  saveFilters(SELECTED_KEY, { id })
}

/* ============================================================================
12. Eventos
============================================================================ */
searchInput.addEventListener('input', debounce(applySearch, 300))

clearBtn.addEventListener('click', () => {
  searchInput.value = ''
  currentSearch = ''
  clearBtn.classList.add('hidden')
  clearFilters(FILTER_KEY)
  clearFilters(SELECTED_KEY)
  loadTransactions(1)
})

document.getElementById('prev-page-top')?.addEventListener('click', () => {
  if (currentPage > 1) loadTransactions(currentPage - 1)
})

document.getElementById('next-page-top')?.addEventListener('click', () => {
  if (currentPage < totalPages) loadTransactions(currentPage + 1)
})

if (table) {
  table.addEventListener('click', event => {
    if (event.target.closest('button') || event.target.closest('a')) return

    const row = event.target.closest('tr[id^="transaction-"]')
    if (!row) return

    const id = row.id.replace('transaction-', '')
    const detail_row = document.getElementById(`transaction-detail-${id}`)

    const is_open = detail_row && !detail_row.classList.contains('hidden')

    if (is_open) {
      row.classList.remove('tr-selected')
      detail_row.classList.add('hidden')
      clearFilters(SELECTED_KEY)
      return
    }

    document.querySelectorAll('#transactions-table tr')
      .forEach(tr => tr.classList.remove('tr-selected'))

    document.querySelectorAll('.transaction-detail-row')
      .forEach(tr => tr.classList.add('hidden'))

    row.classList.add('tr-selected')
    detail_row?.classList.remove('hidden')

    saveFilters(SELECTED_KEY, { id })
  })
}

/* ============================================================================
13. Scroll
============================================================================ */
/* (no implementado todavía) */

/* ============================================================================
14. Init
============================================================================ */
const savedFilters = loadFilters(FILTER_KEY)
if (savedFilters?.term) {
  currentSearch = savedFilters.term
  searchInput.value = savedFilters.term
  clearBtn.classList.remove('hidden')
}

document.addEventListener('DOMContentLoaded', () => {
  const savedFilters = loadFilters(FILTER_KEY)

  if (savedFilters?.term) {
    currentSearch = savedFilters.term
    searchInput.value = savedFilters.term
    clearBtn.classList.remove('hidden')
  }

  const savedPage = savedFilters?.page || 1
  currentPage = savedPage

  loadTransactions(currentPage)

  if (SAVED_BATCH) {
    if (typeof batchRestoreState === 'function') {
      batchRestoreState()
    }

    if (window.history.replaceState) {
      const url = new URL(window.location)
      url.searchParams.delete('saved_batch')
      window.history.replaceState({}, document.title, url.toString())
    }
  }

  window.addEventListener('resize', () => {
    const nextLayout = getLayoutMode()

    if (nextLayout !== currentLayout) {
      currentLayout = nextLayout
      render(allItems)

      if (isBatchActive()) {
        batchApplyUi(true)
        batchToggleActionButtons(true)
        batchRestoreSelection()
      }
    }
  })
}) 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\routes\account.route.ts
```
 
```ts
import { Router } from 'express'
import {
    apiForGettingAccounts,
    apiForSavingAccount,
    routeToFormDeleteAccount,
    routeToFormInsertAccount,
    routeToFormUpdateAccount,
    routeToPageAccount
} from '../controllers/account/account.controller'

const router = Router()

/*Eventos de acción */
router.get('/list', apiForGettingAccounts)
router.post('/', apiForSavingAccount)

/*Eventos de enrutamiento */
router.get('/', routeToPageAccount)
router.get('/insert', routeToFormInsertAccount)
router.get('/update/:id', routeToFormUpdateAccount)
router.get('/delete/:id', routeToFormDeleteAccount)


export default router
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\routes\auth.route.ts
```
 
```ts
import { Router } from 'express'
import { show2FA, verify2FA } from '../controllers/home/2fa.controller'
import { twoFALimiter } from '../config/rate-limiter'

const router = Router()

router.get('/2fa', show2FA)
router.post('/2fa', twoFALimiter, verify2FA)

export default router
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\routes\category-group.route.ts
```
 
```ts
import { Router } from 'express'
import {
    apiForSavingCategoryGroup,
    routeToFormDeleteCategoryGroup,
    routeToFormInsertCategoryGroup,
    routeToFormUpdateCategoryGroup
} from '../controllers/category-group/category-group.controller'

const router = Router()

/*Eventos de acción */
router.post('/', apiForSavingCategoryGroup)

/*Eventos de enrutamiento */
router.get('/insert', routeToFormInsertCategoryGroup)
router.get('/update/:id', routeToFormUpdateCategoryGroup)
router.get('/delete/:id', routeToFormDeleteCategoryGroup)

export default router 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\routes\category.route.ts
```
 
```ts
import { Router } from 'express'
import {
    apiForGettingCategories,
    apiForSavingCategory,
    routeToFormDeleteCategory,
    routeToFormInsertCategory,
    routeToFormUpdateCategory,
    routeToPageCategory
} from '../controllers/category/category.controller'

const router = Router()

/*Eventos de acción */
router.get('/list', apiForGettingCategories)
router.post('/', apiForSavingCategory)

/*Eventos de enrutamiento */
router.get('/', routeToPageCategory)
router.get('/insert', routeToFormInsertCategory)
router.get('/update/:id', routeToFormUpdateCategory)
router.get('/delete/:id', routeToFormDeleteCategory)

export default router 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\routes\home.route.ts
```
 
```ts
import { Router } from 'express'
import {
    apiForGettingCashSummary,
    apiForGettingKpis,
    apiForGettingLoanSummary,
    apiForLogout,
    apiForValidatingLogin,
    routeToPageHome,
    routeToPageLogin,
    routeToPageRoot
} from '../controllers/home/home.controller'
import { injectNetBalance } from '../middlewares/inject-net-balance.middleware'
import { sessionAuthMiddleware } from '../middlewares/session-auth.middleware'
import { loginLimiter } from '../config/rate-limiter'

const router = Router()

// Public routes
router.post('/login', loginLimiter, apiForValidatingLogin)
router.get('/login', routeToPageLogin)
router.get('/', routeToPageRoot)

// Protected routes
const protectedSubRouter = Router()
protectedSubRouter.use(sessionAuthMiddleware)
protectedSubRouter.use(injectNetBalance)

protectedSubRouter.get('/logout', apiForLogout)
protectedSubRouter.get('/kpis', apiForGettingKpis)
protectedSubRouter.get('/cash-summary', apiForGettingCashSummary)
protectedSubRouter.get('/loan-summary', apiForGettingLoanSummary)
protectedSubRouter.get('/home', routeToPageHome)

router.use(protectedSubRouter)

export default router
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\routes\loan-group.route.ts
```
 
```ts
import { Router } from 'express'
import {
    apiForSavingLoanGroup,
    routeToFormDeleteLoanGroup,
    routeToFormInsertLoanGroup,
    routeToFormUpdateLoanGroup
}
    from '../controllers/loan-group/loan-group.controller'

const router = Router()

/*Eventos de acción */
router.post('/', apiForSavingLoanGroup)

/*Eventos de enrutamiento */
router.get('/insert', routeToFormInsertLoanGroup)
router.get('/update/:id', routeToFormUpdateLoanGroup)
router.get('/delete/:id', routeToFormDeleteLoanGroup)

export default router 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\routes\loan-payment.route.ts
```
 
```ts
import { Router } from 'express'
import {
    apiForGettingPayments,
    apiForSavingAccount,
    routeToFormClonePayment,
    routeToFormDeletePayment,
    routeToFormInsertPayment,
    routeToFormUpdatePayment,
    routeToPagePayment
} from '../controllers/loan-payment/loan-payment.controller'

const router = Router()

/*Eventos de acción */
router.get('/list/:loan_id/loan', apiForGettingPayments)
router.post('/', apiForSavingAccount)

/*Eventos de enrutamiento */
router.get('/:id/loan', routeToPagePayment)
router.get('/insert/:loan_id', routeToFormInsertPayment)
router.get('/update/:id', routeToFormUpdatePayment)
router.get('/clone/:id', routeToFormClonePayment)
router.get('/delete/:id', routeToFormDeletePayment)

export default router
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\routes\loan.route.ts
```
 
```ts
import { Router } from "express"
import {
    apiForGettingLoans,
    apiForSavingLoan,
    routeToFormCloneLoan,
    routeToFormDeleteLoan,
    routeToFormInsertLoan,
    routeToFormUpdateLoan,
    routeToPageLoan
} from "../controllers/loan/loan.controller"
import { routeToPagePayment } from "../controllers/loan-payment/loan-payment.controller"

const router = Router()

/*Eventos de acción */
router.get('/list', apiForGettingLoans) 
router.post('/', apiForSavingLoan)

/*Eventos de enrutamiento */
router.get('/', routeToPageLoan)
router.get('/insert', routeToFormInsertLoan)
router.get('/update/:id', routeToFormUpdateLoan)
router.get('/clone/:id', routeToFormCloneLoan)
router.get('/delete/:id', routeToFormDeleteLoan)
router.get('/:id/loan', routeToPagePayment)

export default router 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\routes\transaction.route.ts
```
 
```ts
import { Router } from 'express'
import {
  apiForBatchCategorize,
  apiForGettingCategorizeTransactions
} from '../controllers/transaction/batch-categorize.controller'
import {
  apiForGettingTransactions,
  apiForSavingTransaction,
  routeToFormCloneTransaction,
  routeToFormDeleteTransaction,
  routeToFormInsertTransaction,
  routeToFormUpdateTransaction,
  routeToPageTransaction
} from '../controllers/transaction/transaction.controller'

const router = Router()

/*Eventos de acción */
router.post('/', apiForSavingTransaction)
router.get('/list', apiForGettingTransactions)
router.get('/batch-categorize', apiForGettingCategorizeTransactions)

/*Eventos de enrutamiento */
router.get('/', routeToPageTransaction)
router.get('/insert', routeToFormInsertTransaction)
router.get('/update/:id', routeToFormUpdateTransaction)
router.get('/clone/:id', routeToFormCloneTransaction)
router.get('/delete/:id', routeToFormDeleteTransaction)
router.post('/batch-categorize', apiForBatchCategorize)

export default router 
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\services\account-balance.service.ts
```
 
```ts
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
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\services\kpi-cache.service.ts
```
 
```ts
import { AppDataSource } from '../config/typeorm.datasource'
import { CacheKpiBalance } from '../entities/CacheKpiBalance.entity'
import { CacheKpiCategory } from '../entities/CacheKpiCategory.entity'
import { AuthRequest } from '../types/auth-request'
import { formatDateForInputLocal } from '../utils/date.util'
import { parseError } from '../utils/error.util'
import { logger } from '../utils/logger.util'

function money(n: number) {
  return Number(n.toFixed(2))
}

/* ============================
   QUERY BASE (ÚNICA FUENTE)
============================ */
const query_base = `
SELECT
  COALESCE(SUM(CASE WHEN COALESCE(NULLIF(t.detailed_type, ''), t.type) = 'income' THEN t.amount ELSE 0 END), 0) AS incomes,
  COALESCE(SUM(CASE WHEN COALESCE(NULLIF(t.detailed_type, ''), t.type) = 'expense' THEN t.amount ELSE 0 END), 0) AS expenses,
  COALESCE(SUM(CASE WHEN COALESCE(NULLIF(t.detailed_type, ''), t.type) = 'income_for_loan' THEN t.amount ELSE 0 END), 0) AS loans,
  COALESCE(SUM(CASE WHEN COALESCE(NULLIF(t.detailed_type, ''), t.type) = 'payment_for_loan' THEN t.amount ELSE 0 END), 0) AS payments,
  COALESCE(SUM(CASE WHEN COALESCE(NULLIF(t.detailed_type, ''), t.type) = 'saving' THEN t.amount ELSE 0 END), 0) AS savings,
  COALESCE(SUM(CASE WHEN COALESCE(NULLIF(t.detailed_type, ''), t.type) = 'withdrawal' THEN t.amount ELSE 0 END), 0) AS withdrawals
 FROM transactions t
WHERE t.user_id = ?
  AND (? IS NULL OR t.date >= ?)
  AND (? IS NULL OR t.date <  ?)
`

const category_query_base = `
SELECT
  cg.id AS category_group_id,
  c.id AS category_id,
  COALESCE(cg.name, '') AS cat_group_name,
  COALESCE(c.name, '') AS cat_name,
  SUM(t.amount) AS amount,
  COUNT(*) AS transaction_count
FROM transactions t
LEFT JOIN categories c ON c.id = t.category_id
LEFT JOIN category_groups cg ON cg.id = c.category_group_id
WHERE t.user_id = ?
  AND t.category_id IS NOT NULL
  AND (? IS NULL OR t.date >= ?)
  AND (? IS NULL OR t.date <  ?)
GROUP BY cg.id, cg.name, c.id, c.name
ORDER BY cg.name, c.name
`

export class KpiCacheService {


  /* ============================
   PARA RECALCULAR EL KPI DE BALANCE DEL MES ACTUAL Y TOTAL
  ============================ */
  private static async recalculateCurrMonthBalanceKPI(auth_req: AuthRequest, period_year: number, period_month: number) {

    const user_id = auth_req.user.id
    const timezone = auth_req.timezone || 'UTC'

    try {

      const start_local = new Date(period_year, period_month - 1, 1)
      const end_local = new Date(period_year, period_month, 1)


      const start_date = new Date(formatDateForInputLocal(start_local, timezone))
      const end_date = new Date(formatDateForInputLocal(end_local, timezone))

      logger.debug('KPI_DATE_RANGE', { user_id, period_year, period_month, timezone, start_local, end_local, start_date, end_date })

      const result = await AppDataSource.manager.query(query_base, [
        user_id,
        start_date, start_date,
        end_date, end_date
      ])



      if (!result?.length) return

      const r = result[0]

      logger.debug('KPI_QUERY_RESULT', { user_id, period_year, period_month, timezone, start_date, end_date, result: r })

      const incomes = Number(r.incomes || 0)
      const expenses = Number(r.expenses || 0)
      const loans = Number(r.loans || 0)
      const payments = Number(r.payments || 0)
      const savings = Number(r.savings || 0)
      const withdrawals = Number(r.withdrawals || 0)

      const total_inflows = money(incomes + loans)
      const total_outflows = money(expenses + payments)
      const net_cash_flow = money(total_inflows - total_outflows)
      const net_savings = money(savings - withdrawals)
      const available_balance = money(net_cash_flow - net_savings)

      const repo = AppDataSource.getRepository(CacheKpiBalance)

      const existing = await repo.findOne({
        where: { user: { id: user_id }, period_year, period_month },
        relations: ['user']
      })
      logger.debug('KPI_COMPARE', { period_year, period_month, old_available_balance: existing?.available_balance, old_incomes: existing?.incomes, old_expenses: existing?.expenses, old_loans: existing?.loans, old_payments: existing?.payments, old_savings: existing?.savings, old_withdrawals: existing?.withdrawals, new_available_balance: available_balance, new_incomes: incomes, new_expenses: expenses, new_loans: loans, new_payments: payments, new_savings: savings, new_withdrawals: withdrawals })

      const payload = {
        incomes,
        expenses,
        savings,
        withdrawals,
        loans,
        payments,
        total_inflows,
        total_outflows,
        net_cash_flow,
        net_savings,
        available_balance,
        principal_breakdown: 0,
        interest_breakdown: 0
      }
      logger.debug('KPI_MONTH_AFTER', { user_id, period_year, period_month, incomes, expenses, loans, payments, savings, withdrawals, available_balance })

      if (existing) {
        await repo.update({ id: existing.id }, payload)
      } else {
        await repo.insert({
          user: { id: user_id } as any,
          period_year,
          period_month,
          ...payload
        })
      }
      logger.debug('KPI_MONTH_BEFORE', { user_id, period_year, period_month, incomes, expenses, loans, payments, savings, withdrawals, available_balance })
      logger.info(`KPI MES recalculado user=${user_id} periodo=${period_month}/${period_year}`)

    } catch (error: any) {
      logger.error('Error recalculando KPI mes', parseError(error))
    }
  }

  private static async recalculateAllBalanceKPI(user_id: number, timezone: string) {

    try {

      const repo = AppDataSource.getRepository(CacheKpiBalance)

      await repo.delete({ user: { id: user_id } })

      const rows = await AppDataSource.manager.query(`
        SELECT DISTINCT YEAR(date) as year, MONTH(date) as month
        FROM transactions
        WHERE user_id = ?
      `, [user_id])

      for (const row of rows) {

        const year = Number(row.year)
        const month = Number(row.month)

        const start_local = new Date(year, month - 1, 1)
        const end_local = new Date(year, month, 1)

        const start_date = new Date(formatDateForInputLocal(start_local, timezone))
        const end_date = new Date(formatDateForInputLocal(end_local, timezone))

        const result = await AppDataSource.manager.query(query_base, [
          user_id,
          start_date, start_date,
          end_date, end_date
        ])

        if (!result?.length) continue

        const r = result[0]

        const incomes = Number(r.incomes || 0)
        const expenses = Number(r.expenses || 0)
        const loans = Number(r.loans || 0)
        const payments = Number(r.payments || 0)
        const savings = Number(r.savings || 0)
        const withdrawals = Number(r.withdrawals || 0)

        const total_inflows = money(incomes + loans)
        const total_outflows = money(expenses + payments)
        const net_cash_flow = money(total_inflows - total_outflows)
        const net_savings = money(savings - withdrawals)
        const available_balance = money(net_cash_flow - net_savings)

        await repo.insert({
          user: { id: user_id } as any,
          period_year: year,
          period_month: month,
          incomes,
          expenses,
          savings,
          withdrawals,
          loans,
          payments,
          total_inflows,
          total_outflows,
          net_cash_flow,
          net_savings,
          available_balance,
          principal_breakdown: 0,
          interest_breakdown: 0
        })
      }

      logger.info(`KPI FULL REBUILD user=${user_id}`)

    } catch (error) {
      logger.error('Error en recalculateAllBalanceKPI', parseError(error))
    }
  }

    static async recalculateBalanceKPIByTransaction(auth_req: AuthRequest, transaction: any) {
    logger.debug('recalculateBalanceKPIByTransaction', { trx_id: transaction.id, trx_date: transaction.date, trx_created_at: transaction.created_at, amount: transaction.amount, timezone: auth_req.timezone })

    const user_id = auth_req.user.id
    const timezone = auth_req.timezone || 'UTC'

    try {

      if (!transaction?.date) {
        logger.warn('recalculateBalanceKPIByTransaction sin transaction.date')
        return
      }

      const trx_utc = new Date(formatDateForInputLocal(transaction.date, timezone))
      const trx_year = trx_utc.getUTCFullYear()
      const trx_month = trx_utc.getUTCMonth() + 1

      const now_utc = new Date(formatDateForInputLocal(new Date(), timezone))
      const current_year = now_utc.getUTCFullYear()
      const current_month = now_utc.getUTCMonth() + 1

      const is_current_period = trx_year === current_year && trx_month === current_month

      logger.debug('KPI_PERIOD_RAW', { trx_id: transaction.id, trx_date: transaction.date })
      if (is_current_period) {
        await this.recalculateCurrMonthBalanceKPI(auth_req, trx_year, trx_month)
      } else {
        await this.recalculateAllBalanceKPI(user_id, timezone)
      }

      logger.debug('KPI recalculado por transacción', { trx_year, trx_month, current_year, current_month, is_current_period })
    } catch (error: any) {
      logger.error('Error en recalculateBalanceKPIByTransaction', parseError(error))
    }
  }

  /* ============================
  PARA RECALCULAR EL KPI DE CATEGORÍAS DEL MES ACTUAL Y TOTAL
  ============================ */
  private static async recalculateCurrMonthCategoryKPI(auth_req: AuthRequest, period_year: number, period_month: number) {
    const user_id = auth_req.user.id
    const timezone = auth_req.timezone || 'UTC'

    try {
      const start_local = new Date(period_year, period_month - 1, 1)
      const end_local = new Date(period_year, period_month, 1)

      const start_date = new Date(formatDateForInputLocal(start_local, timezone))
      const end_date = new Date(formatDateForInputLocal(end_local, timezone))

      const repo = AppDataSource.getRepository(CacheKpiCategory)

      await repo.delete({ user: { id: user_id }, year_period: period_year, month_period: period_month })

      const rows = await AppDataSource.manager.query(category_query_base, [
        user_id,
        start_date, start_date,
        end_date, end_date
      ])

      for (const row of rows) {
        await repo.insert({
          user: { id: user_id } as any,
          year_period: period_year,
          month_period: period_month,
          category_group: { id: Number(row.category_group_id) } as any,
          category: { id: Number(row.category_id) } as any,
          amount: Number(row.amount || 0),
          transaction_count: Number(row.transaction_count || 0)
        })
      }

      logger.info(`KPI CATEGORIAS MES recalculado user=${user_id} periodo=${period_month}/${period_year}`)
    } catch (error: any) {
      logger.error('Error recalculando KPI categorías mes', parseError(error))
    }
  }

  private static async recalculateAllCategoryKPI(user_id: number, timezone: string) {
    try {
      const repo = AppDataSource.getRepository(CacheKpiCategory)

      await repo.delete({ user: { id: user_id } })

      const rows = await AppDataSource.manager.query(`
        SELECT DISTINCT YEAR(date) as year, MONTH(date) as month
        FROM transactions
        WHERE user_id = ?
      `, [user_id])

      for (const row of rows) {
        const year = Number(row.year)
        const month = Number(row.month)

        const start_local = new Date(year, month - 1, 1)
        const end_local = new Date(year, month, 1)

        const start_date = new Date(formatDateForInputLocal(start_local, timezone))
        const end_date = new Date(formatDateForInputLocal(end_local, timezone))

        const category_rows = await AppDataSource.manager.query(category_query_base, [
          user_id,
          start_date, start_date,
          end_date, end_date
        ])

        for (const category_row of category_rows) {
          await repo.insert({
            user: { id: user_id } as any,
            year_period: year,
            month_period: month,
            category_group: { id: Number(category_row.category_group_id) } as any,
            category: { id: Number(category_row.category_id) } as any,
            amount: Number(category_row.amount || 0),
            transaction_count: Number(category_row.transaction_count || 0)
          })
        }
      }

      logger.info(`KPI CATEGORIAS FULL REBUILD user=${user_id}`)
    } catch (error) {
      logger.error('Error en recalculateAllCategoryKPI', parseError(error))
    }
  }

  static async recalculateCategoryKPIByTransaction(auth_req: AuthRequest, transaction: any) {
    logger.debug('recalculateCategoryKPIByTransaction', { trx_id: transaction.id, trx_date: transaction.date, timezone: auth_req.timezone })

    const user_id = auth_req.user.id
    const timezone = auth_req.timezone || 'UTC'

    try {
      if (!transaction?.date) {
        logger.warn('recalculateCategoryKPIByTransaction sin transaction.date')
        return
      }

      const trx_utc = new Date(formatDateForInputLocal(transaction.date, timezone))
      const trx_year = trx_utc.getUTCFullYear()
      const trx_month = trx_utc.getUTCMonth() + 1

      const now_utc = new Date(formatDateForInputLocal(new Date(), timezone))
      const current_year = now_utc.getUTCFullYear()
      const current_month = now_utc.getUTCMonth() + 1

      const is_current_period = trx_year === current_year && trx_month === current_month

      if (is_current_period) {
        await this.recalculateCurrMonthCategoryKPI(auth_req, trx_year, trx_month)
      } else {
        await this.recalculateAllCategoryKPI(user_id, timezone)
      }

      logger.debug('KPI CATEGORÍAS recalculado por transacción', { trx_year, trx_month, current_year, current_month, is_current_period })
    } catch (error: any) {
      logger.error('Error en recalculateCategoryKPIByTransaction', parseError(error))
    }
  }

}

 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\services\loan-balance.service.ts
```
 
```ts
import { AppDataSource } from '../config/typeorm.datasource'
import { Loan } from '../entities/Payable.entity'

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
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\services\loan-payment-number.service.ts
```
 
```ts
import { AppDataSource } from "../config/typeorm.datasource"
import { LoanPayment } from "../entities/PayablePayment.entity"

/* =========================================================
Obtener siguiente número de pago para un préstamo
========================================================= */

export const getNextPaymentNumber = async (loan_id: number): Promise<number> => {

  const last_payment = await AppDataSource
    .getRepository(LoanPayment)
    .createQueryBuilder('p')
    .where('p.loan_id = :loan_id', { loan_id })
    .andWhere('p.payment_number > 0')
    .orderBy('p.payment_number', 'DESC')
    .getOne()

  if (!last_payment?.payment_number) return 1

  return last_payment.payment_number + 1
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\services\next-valid-trx-date.service.ts
```
 
```ts
import { DateTime } from "luxon"
import { AppDataSource } from "../config/typeorm.datasource"
import { Transaction } from "../entities/Transaction.entity"
import { AuthRequest } from "../types/auth-request"

export const getNextValidTransactionDate = async (auth_req: AuthRequest): Promise<Date> => {

    const user_id = auth_req.user.id
    const timezone = auth_req.timezone ?? 'UTC'
    const now_utc = DateTime.utc()
    const now_local = now_utc.setZone(timezone)
    const start_of_day_utc = now_local.startOf('day').toUTC().toJSDate()
    const end_of_day_utc = now_local.endOf('day').toUTC().toJSDate()

    const last_transaction = await AppDataSource
        .getRepository(Transaction)
        .createQueryBuilder('t')
        .where('t.user_id = :user_id', { user_id })
        .andWhere('t.date BETWEEN :start AND :end', { start: start_of_day_utc, end: end_of_day_utc })
        .orderBy('t.date', 'DESC')
        .getOne()

    if (!last_transaction?.date) return now_utc.toJSDate()

    const last_transaction_utc = DateTime.fromJSDate(last_transaction.date, { zone: 'utc' })
    const remainder = last_transaction_utc.minute % 5
    const increment = remainder === 0 ? 5 : 5 - remainder
    const next_valid_utc = last_transaction_utc.plus({ minutes: increment }).set({ second: 0, millisecond: 0 })
    
    if (next_valid_utc < now_utc) return now_utc.set({ second: 0, millisecond: 0 }).toJSDate()

    return next_valid_utc.toJSDate()
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\services\populate-items.service.ts
```
 
```ts
import { In, IsNull, MoreThanOrEqual, Not } from "typeorm"
import { AppDataSource } from "../config/typeorm.datasource"
import { Account } from "../entities/Account.entity"
import { LoanGroup } from "../entities/PayableGroup.entity"
import { AuthRequest } from "../types/auth-request"
import { Category } from "../entities/Category.entity"
import { CategoryGroup } from "../entities/CategoryGroups.entity"

export const getActiveParentLoansByUser = async (auth_req: AuthRequest): Promise<LoanGroup[]> => {
  const repo = AppDataSource.getRepository(LoanGroup)

  return await repo.find({
    where: {
      user: { id: auth_req.user.id },
      is_active: true
    },
    order: { name: 'ASC' }
  })
}

export const getActiveParentCategoriesByUser = async (auth_req: AuthRequest): Promise<CategoryGroup[]> => {
  const repo = AppDataSource.getRepository(CategoryGroup)

  return await repo.find({
    where: {
      user: { id: auth_req.user.id },
      is_active: true
    },
    order: { name: 'ASC' }
  })
}

export const getActiveAccountsByUser_Deprecated = async (authReq: AuthRequest): Promise<Account[]> => {
  const repo = AppDataSource.getRepository(Account)
  /* type!: 'cash' | 'bank' | 'card' | 'saving' */
  const accounts = await repo.find({
    where: {
      user: { id: authReq.user.id },
      is_active: true,
      balance: MoreThanOrEqual(0),
      type: In(['cash', 'bank', 'card'])
    },
    order: { name: 'ASC' }
  })
  return accounts
}

export const getActiveAccountsForTransferByUser_Deprecated = async (authReq: AuthRequest): Promise<Account[]> => {
  const repo = AppDataSource.getRepository(Account)
  const accounts = await repo.find({
    where: {
      user: { id: authReq.user.id },
      is_active: true,
      balance: MoreThanOrEqual(0),
    },
    order: { name: 'ASC' }
  })
  return accounts
}

export const getActiveCategoriesByUser_Deprecated = async (authReq: AuthRequest): Promise<Category[]> => {
  const repo = AppDataSource.getRepository(Category)
  const categories = await repo.find({
    where: {
      user: { id: authReq.user.id },
      is_active: true,
    },
    order: { name: 'ASC' }
  })
  return categories
}

export const getActiveCategoriesForLoansByUser = async (authReq: AuthRequest): Promise<Category[]> => {
  const repo = AppDataSource.getRepository(Category)
  const categories = await repo.find({
    where: {
      user: { id: authReq.user.id },
      is_active: true,
      type_for_loan: 'loan'
    },
    order: { name: 'ASC' }
  })
  return categories
}

export const getActiveCategoriesForPaymentsByUser = async (authReq: AuthRequest): Promise<Category[]> => {
  const repo = AppDataSource.getRepository(Category)
  const categories = await repo.find({
    where: {
      user: { id: authReq.user.id },
      is_active: true,
      type_for_loan: 'payment'
    },
    order: { name: 'ASC' }
  })
  return categories
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\services\send-2fa-mail.service.ts
```
 
```ts
import nodemailer from 'nodemailer'
import { logger } from '../utils/logger.util'
import { parseError } from '../utils/error.util'

const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: process.env.MAIL_SECURE === 'true',
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
})

export async function send2FACodeMail(to: string, name: string, code: string): Promise<void> {
    try {
        await transporter.sendMail({
            from: process.env.MAIL_FROM,
            to,
            subject: 'Código de verificación (2FA)',
            text: `Hola ${name}, tu código de verificación es: ${code}`,
            html: `
        <p>Hola <strong>${name}</strong>,</p>
        <p>Tu código de verificación es:</p>
        <h2>${code}</h2>
        <p>Este código expira en 10 minutos.</p>
        <p>Favor no responder a este correo.</p>
      `
        })
    } catch (error) {
        logger.error('[MAIL] Error enviando correo 2FA', parseError(error))
        throw error
    }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\services\send-2fa.service.ts
```
 
```ts
import { IsNull } from 'typeorm'
import { AppDataSource } from '../config/typeorm.datasource'
import { AuthCode } from '../entities/AuthCode.entity'
import { User } from '../entities/User.entity'
import { generateNumericCode, hashCode } from '../utils/auth-code.util'
import { logger } from '../utils/logger.util'
import { send2FACodeMail } from './send-2fa-mail.service'

export async function send2FACode(user: User): Promise<void> {
    const repo = AppDataSource.getRepository(AuthCode)

    await repo.delete({ user: { id: user.id }, used_at: IsNull() })

    const code = generateNumericCode(6)
    const codeHash = await hashCode(code)

    const expires = new Date()
    expires.setMinutes(expires.getMinutes() + 10)

    const authCode = repo.create({ user, code_hash: codeHash, expires_at: expires })

    await repo.save(authCode)
    await send2FACodeMail(user.email, user.name, code)
    logger.info(`[2FA] Código enviado por correo a [${user.email}], codigo: [${code}]`)
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\types\auth-request.d.ts
```
 
```ts
import { Request } from 'express'
import { RoleUser } from '../policies/roles-user.policy'

/* Usuario seguro para sesión (no depende de la entidad) */
export interface SessionUser {
  id: number
  email: string
  name: string
  created_at: Date
}


export interface AuthRequest extends Request {
  user: SessionUser
  timezone?: string
  role?: RoleUser
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\types\express-mysql-session.d.ts
```
 
```ts
declare module 'express-mysql-session' {

  function MySQLStoreFactory(session: typeof import('express-session')): any
  export = MySQLStoreFactory

}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\types\express-session.d.ts
```
 
```ts
import 'express-session'

declare module 'express-session' {
  interface SessionData {
    user_id?: number
    timezone?: string
    pending2FAUserId?: number
    csrfToken?: string
  }
  
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\types\form-view-params.d.ts
```
 
```ts
import { AuthRequest } from "./auth-request"

export type AccountFormMode = 'insert' | 'update' | 'delete'
export type AccountFieldPolicy = 'editable' | 'readonly' | 'hidden'
type AccountFieldMatrix = Record<string, AccountFieldPolicy>
type AccountFormMatrix = Record<AccountFormMode, AccountFieldMatrix>

export type CaterogyFieldMode = 'hidden' | 'readonly' | 'editable'
export type CategoryFormMode = 'insert' | 'update' | 'delete'
type CategoryFieldMatrix = Record<string, CaterogyFieldMode>
type CategoryFormMatrix = Record<CategoryFormMode, CategoryFieldMatrix>

export type CategoryGroupFieldMode = 'hidden' | 'readonly' | 'editable'
export type CategoryGroupFormMode = 'insert' | 'update' | 'delete'
type CategoryGroupFieldMatrix = Record<string, CategoryGroupFieldMode>
type CategoryGroupFormMatrix = Record<CategoryGroupFormMode, CategoryGroupFieldMatrix>

export type LoanFieldMode = 'hidden' | 'readonly' | 'editable'
export type LoanFormMode = 'insert' | 'update' | 'delete'
type LoanFieldMatrix = Record<string, LoanFieldMode>
type LoanFormMatrix = Record<LoanFormMode, LoanFieldMatrix>

export type LoanGroupFieldMode = 'hidden' | 'readonly' | 'editable'
export type LoanGroupFormMode = 'insert' | 'update' | 'delete'
type LoanGroupFieldMatrix = Record<string, LoanGroupFieldMode>
type LoanGroupFormMatrix = Record<LoanGroupFormMode, LoanGroupFieldMatrix>

export type PaymentFieldMode = 'hidden' | 'readonly' | 'editable'
export type PaymentFormMode = 'insert' | 'update' | 'delete'
type PaymentFieldMatrix = Record<string, PaymentFieldMode>
type PaymentFormMatrix = Record<PaymentFormMode, PaymentFieldMatrix>

export type TransactionFieldMode = 'hidden' | 'readonly' | 'editable'
export type TransactionFormMode = 'insert' | 'update' | 'delete'
type TransactionFieldMatrix = Record<string, TransactionFieldMode>
type TransactionFormMatrix = Record<TransactionFormMode, TransactionFieldMatrix>

export type BaseFormViewParams = {
    title: string
    view: string
    errors: any
    mode: 'insert' | 'update' | 'delete'
    auth_req: AuthRequest
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\utils\auth-code.util.ts
```
 
```ts
import bcrypt from 'bcryptjs'

export function generateNumericCode(length = 6): string {
  const min = 10 ** (length - 1)
  const max = 10 ** length - 1
  return Math.floor(Math.random() * (max - min + 1) + min).toString()
}

export async function hashCode(code: string): Promise<string> {
  return bcrypt.hash(code, 10)
}

export async function compareCode(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash)
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\utils\bool.util.ts
```
 
```ts
export function parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') {
        return value
    }
    if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') return true
        if (value.toLowerCase() === 'false') return false
    }
    if (typeof value === 'number') {
        if (value === 1) return true
        if (value === 0) return false
    }
    return false
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\utils\date.util.ts
```
 
```ts
import { DateTime } from 'luxon';

export const parseLocalDateToUTC = (localDate: string, timezone: string): Date => {
  const dt = DateTime.fromISO(localDate, { zone: timezone }).toUTC().toJSDate()
  return dt
}

export function formatDateForInputLocal(date: Date, timeZone: string = 'America/Guayaquil'): string {
  const dt = DateTime.fromJSDate(date, { zone: 'utc' }).setZone(timeZone).toFormat("yyyy-MM-dd'T'HH:mm")
  return dt
}

export function formatDateForSystemLocal(date: Date, timeZone: string = 'America/Guayaquil'): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).formatToParts(date);

  const pad = (n: number) => n.toString().padStart(2, '0');
  const pad3 = (n: number) => n.toString().padStart(3, '0');

  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  const hour = parts.find(p => p.type === 'hour')?.value;
  const minute = parts.find(p => p.type === 'minute')?.value;
  const second = parts.find(p => p.type === 'second')?.value;
  const milliseconds = pad3(date.getMilliseconds());

  return `${year}-${month}-${day} ${hour}:${minute}:${second}.${milliseconds}`;
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\utils\error.util.ts
```
 
```ts
export const parseError = (err: unknown) => {
    if (!err) { return { message: 'Unknown error', raw: err } }
    if (err instanceof Error) { return { name: err.name, message: err.message, stack: err.stack } }
    if (typeof err === 'object') {
        try {
            return JSON.parse(JSON.stringify(err))
        } catch {
            return { message: 'Unserializable error object', raw: String(err) }
        }
    }
    return { message: String(err) }
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\utils\logger.util.ts
```
 
```ts
import 'dotenv/config'
import { formatDateForInputLocal, formatDateForSystemLocal } from './date.util'

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

const LEVELS: Record<LogLevel, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 }

const COLORS: Record<LogLevel, string> = {
  DEBUG: '\x1b[34m', // azul
  INFO: '\x1b[32m',  // verde 
  WARN: '\x1b[33m',  // amarillo
  ERROR: '\x1b[31m'  // rojo
}
const RESET_COLOR = '\x1b[0m'
class Logger {
  private currentLevel: number

  constructor() {
    const envLevel = (process.env.NODE_LOG_LEVEL || 'DEBUG').toUpperCase() as LogLevel
    this.currentLevel = LEVELS[envLevel] ?? 0
  }

  private shouldLog(level: LogLevel) {
    return LEVELS[level] >= this.currentLevel
  }

  private format(level: LogLevel, message: string, meta?: any) {
    const timestamp = formatDateForSystemLocal(new Date())
    const metaString = meta ? ` - ${JSON.stringify(meta)}` : ''
    return `[${timestamp}] [${level}] ${message}${metaString}`
  }

  private color(level: LogLevel, msg: string) {
    return `${COLORS[level]}${msg}${RESET_COLOR}`
  }

  debug(message: string, meta?: any) { if (this.shouldLog('DEBUG')) console.log(this.color('DEBUG', this.format('DEBUG', message, meta))) }
  info(message: string, meta?: any) { if (this.shouldLog('INFO')) console.log(this.color('INFO', this.format('INFO', message, meta))) }
  warn(message: string, meta?: any) { if (this.shouldLog('WARN')) console.warn(this.color('WARN', this.format('WARN', message, meta))) }
  error(message: string, meta?: any) { if (this.shouldLog('ERROR')) console.error(this.color('ERROR', this.format('ERROR', message, meta))) }
}

export const logger = new Logger() 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\utils\req-params.util.ts
```
 
```ts
import { Request } from 'express'

const hasValue = (value: any): boolean => {
    return value !== undefined && value !== null && value !== ''
}

export const getBoolFromBody = (req: Request, field: string): boolean | undefined => {
    const value = req.body?.[field]
    if (!hasValue(value)) return undefined
    if (value === true || value === 'true' || value === 1 || value === '1') {
        return true
    }
    if (value === false || value === 'false' || value === 0 || value === '0') {
        return false
    }
    return undefined
}

export const getDateFromBody = (req: Request, field: string): Date | undefined => {
    const value = req.body?.[field]
    if (!hasValue(value)) return undefined
    const date = new Date(`${value}T00:00:00`)
    return isNaN(date.getTime()) ? undefined : date
}

export const getDateTimeFromBody = (req: Request, field: string): Date | undefined => {
    const value = req.body?.[field]
    if (!hasValue(value)) return undefined
    const date = new Date(value)
    return isNaN(date.getTime()) ? undefined : date
}

export const getIdFromParams = (req: Request): number | undefined => {
    const { id } = req.params
    if (!id) return undefined
    const parsed = Number(id)
    return Number.isNaN(parsed) ? undefined : parsed
}

export const getNumberFromParams = (req: Request, paramName: string): number | undefined => {
    const value = req.params[paramName]
    if (value === undefined) return undefined
    const parsed = Number(value)
    return Number.isNaN(parsed) ? undefined : parsed
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\utils\sql-err.util.ts
```
 
```ts
export const getSqlErrorMessage = (err: any): string => {
    if (err?.code === 'ER_ROW_IS_REFERENCED_2' || err?.errno === 1451
    ) {
        return 'El registro no puede eliminarse porque pertenece a una referencia de integridad.'
    }
    return ''
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\validators\map-errors.validator.ts
```
 
```ts
import { ValidationError } from 'class-validator'

export function mapValidationErrors(errors: ValidationError[]) {
  const fieldErrors: Record<string, string> = {}

  errors.forEach(err => {
    if (err.constraints) {
      fieldErrors[err.property] = Object.values(err.constraints)[0]
    }

    if (err.children && err.children.length > 0) {
      err.children.forEach(child => {
        if (child.constraints) {
          fieldErrors[`${err.property}`] =
            Object.values(child.constraints)[0]
        }
      })
    }
  })

  return fieldErrors
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\validators\not-same-account.validator.ts
```
 
```ts
import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments
} from 'class-validator'
import { Transaction } from '../entities/Transaction.entity'

@ValidatorConstraint({ name: 'NotSameAccount', async: false })
export class NotSameAccount implements ValidatorConstraintInterface {

    validate(_: any, args: ValidationArguments): boolean {
        const t = args.object as Transaction

        if (t.type !== 'transfer') return true

        if (!t.account || !t.to_account) return true

        return t.account.id !== t.to_account.id
    }

    defaultMessage(): string {
        return 'La cuenta origen y la cuenta destino no pueden ser la misma'
    }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\layouts\main.ejs
```
 
```ejs
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>
        <%= title || 'SSR App' %>
    </title>

    <link rel="stylesheet" href="/css/app.css">
    <link rel="stylesheet" href="/css/output.css">

    <!-- Helper globales -->
    <script src="/js/helpers/logger-helper.js"></script>
    <script src="/js/helpers/storage-helper.js"></script>
    <script src="/js/helpers/timezone-helper.js"></script>
    <script src="/js/vendor/chart.js/global/chart.umd.js"></script>
    <script src="/js/vendor/lunox/global/luxon.min.js"></script>

</head>

<body class="bg-gray-100 min-h-screen">

    <!-- Overlay global (bloqueo de pantalla) -->
    <div id="overlay" class="hidden fixed inset-0 bg-black/40 z-40 flex items-center justify-center">
        <div class="bg-white px-6 py-4 rounded shadow">
            Procesando, por favor espere...
        </div>
    </div>

    <!-- MessageBox global centrado -->
    <div id="message-container"
        class="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 pointer-events-none">
    </div>

    <%- include('../partials/navbar') %>

        <main class="max-w-7xl mx-auto px-2 py-3 sm:px-4 sm:py-6 lg:px-6 lg:py-8">
            <%- include('../' + view) %>
        </main>
        <script src="/js/helpers/message-box-helper.js"></script>

</body>

</html> 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\pages\2fa.ejs
```
 
```ejs
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verificación</title>
  <link rel="stylesheet" href="/css/ui-login.css">
</head>

<body class="bg-gray-100 flex items-center justify-center min-h-screen">

  <div class="login-container p-6 bg-white rounded shadow-md w-96">
    <h1 class="text-2xl mb-4">Verificación en dos pasos</h1>

    <p class="mb-4 text-sm text-gray-600">
      Ingresa el código enviado a tu correo
    </p>

    <% if (error) { %>
      <p class="text-red-500 mb-4"><%= error %></p>
    <% } %>

    <form method="POST" action="/2fa" class="flex flex-col gap-4">
      <!-- Token CSRF -->
      <input type="hidden" name="_csrf" value="<%= csrfToken %>">
      
      <input
        type="text"
        name="code"
        maxlength="6"
        required
        class="border p-2 rounded text-center tracking-widest"
        placeholder="Código 6 dígitos"
      />

      <button type="submit" class="bg-blue-500 text-white py-2 rounded hover:bg-blue-600">
        Verificar
      </button>
    </form>
  </div>

</body>
</html>
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\pages\about.ejs
```
 
```ejs
<h1 class="text-2xl font-bold mb-4">Acerca</h1>

<p class="text-gray-700">
  Aplicación construida con SSR, TypeScript y TypeORM.
</p>
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\pages\home.ejs
```
 
```ejs
<script>
  window.USER_ID = "<%= USER_ID %>"
</script>

<h1 class="ui-title">Dashboard</h1>

<!-- ============================
     CAROUSEL CONTAINER CON CONTROLES
============================= -->
<div class="carousel-container">
  <button id="carousel-prev" class="carousel-nav carousel-nav-prev" onclick="scrollCarouselPrev()"
    title="Anterior"></button>

  <!-- ============================
       CARD: KPIs GLOBALES
  ============================= -->
  <div class="home-carousel">


    <!-- ============================
    KPI BALANCES
    ============================= -->
    <div class="ui-card home-slide">

      <div class="ui-card-header html-balance-kpi-header-nav">
        <button id="html-balance-kpi-prev" class="html-balance-kpi-year-btn"></button>
        <h2 id="html-balance-kpi-year-label" class="html-balance-kpi-year-label">
          KPIs Balances
        </h2>
        <button id="html-balance-kpi-next" class="html-balance-kpi-year-btn"></button>
      </div>

      <div id="html-balance-kpi" class="ui-card-body">
      </div>
    </div>

    <!-- ============================
    CASH FLOW SUMMARY
    ============================= -->
    <div class="ui-card home-slide">

      <div class="ui-card-header html-cash-flow-summary-header-nav">
        <button id="html-cash-flow-summary-prev" class="html-cash-flow-summary-year-btn"></button>
        <h2 id="html-cash-flow-summary-year-label" class="html-cash-flow-summary-year-label">
          Tendencia Saldos
        </h2>
        <button id="html-cash-flow-summary-next" class="html-cash-flow-summary-year-btn"></button>
      </div>

      <div id="html-cash-flow-summary" class="ui-card-body">
        <div style="height: 280px;">
          <canvas id="cashFlowChart"></canvas>
        </div>
      </div>
    </div>

    <!-- ============================
    LOAN FLOW SUMMARY
    ============================= -->
    <div class="ui-card home-slide">

      <div class="ui-card-header html-loan-flow-summary-header-nav">
        <button id="html-loan-flow-summary-prev" class="html-loan-flow-summary-year-btn"></button>
        <h2 id="html-loan-flow-summary-year-label" class="html-loan-flow-summary-year-label">
          Tendencia Préstamos
        </h2>
        <button id="html-loan-flow-summary-next" class="html-loan-flow-summary-year-btn"></button>
      </div>

      <div id="html-loan-flow-summary" class="ui-card-body">
        <div style="height: 280px;">
          <canvas id="loanFlowChart"></canvas>
        </div>
      </div>
    </div>

  </div>

  <button id="carousel-next" class="carousel-nav carousel-nav-next" onclick="scrollCarouselNext()" title="Siguiente">
  </button>

</div>

<script src="/js/helpers/icon-helper.js"></script>
<script src="/js/indexes/home-index.js"></script> 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\pages\login.ejs
```
 
```ejs
<!DOCTYPE html>
<html lang="es">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login</title>
  <link rel="stylesheet" href="/css/ui-login.css">
</head>

<body class="bg-gray-100 flex items-center justify-center min-h-screen">

  <div class="login-container p-6 bg-white rounded shadow-md w-96">
    <h1 class="text-2xl mb-4">Iniciar sesión</h1>

    <% if (error) { %>
      <p class="text-red-500 mb-4">
        <%= error %>
      </p>
      <% } %>

        <form method="POST" action="/login" class="flex flex-col gap-4">
          <!-- Token CSRF -->
          <input type="hidden" name="_csrf" value="<%= csrfToken %>">
          
          <div class="flex flex-col">
            <label>Usuario:</label>
            <input type="text" name="username" required class="border p-2 rounded">
          </div>

          <div class="flex flex-col">
            <label>Contraseña:</label>
            <input type="password" name="password" required class="border p-2 rounded">
          </div>

          <!-- Timezone del navegador -->
          <input type="hidden" name="timezone" id="timezone_input">

          <button type="submit" class="bg-blue-500 text-white py-2 rounded hover:bg-blue-600">
            Ingresar
          </button>
        </form>
  </div>

  <script>
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    document.getElementById('timezone_input').value = timezone
  </script>

</body>

</html> 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\pages\accounts\form.ejs
```
 
```ejs
<%
  const rules = account_form_policy
  const isHidden = field => rules[field] === 'hidden'
  const isReadOnly = field => rules[field] === 'readonly'
  const isEditable = field => rules[field] === 'editable'
%>

<div class="max-w-xl mx-auto">
  <h1 class="text-2xl font-semibold mb-6">
    <%=
      mode === 'insert' ? 'Insertar Cuenta' 
    : mode === 'update' ? 'Editar Cuenta' 
    : mode === 'delete' ? 'Eliminar Cuenta'
    : mode 
    %>
  </h1>

  <form method="post" action="/accounts/">
    <!-- Token CSRF -->
    <input type="hidden" name="_csrf" value="<%= csrfToken %>">
    
    <% if (errors?.general) { %>
    <div class="mb-4 p-3 bg-red-100 text-red-700 rounded">
      <%= errors.general %>
    </div>
    <% } %>

    <!-- ID -->
    <input type="hidden" name="id" value="<%= account?.id || '' %>">
    <input type="hidden" name="mode" value="<%= mode %>">

    <!-- Tipo de cuenta -->
    <% if (!isHidden('type')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Tipo</label>

      <div class="flex gap-6">
        <label class="flex items-center gap-1">
          <input
            type="radio"
            name="type"
            value="cash"
            <%= account?.type === 'cash' ? 'checked' : '' %>
            <%= isReadOnly('type') ? 'disabled' : '' %>
          >
          Efectivo
        </label>

        <label class="flex items-center gap-1">
          <input
            type="radio"
            name="type"
            value="bank"
            <%= account?.type === 'bank' ? 'checked' : '' %>
            <%= isReadOnly('type') ? 'disabled' : '' %>
          >
          Banco
        </label>

        <label class="flex items-center gap-1">
          <input
            type="radio"
            name="type"
            value="card"
            <%= account?.type === 'card' ? 'checked' : '' %>
            <%= isReadOnly('type') ? 'disabled' : '' %>
          >
          Tarjeta
        </label>

        <label class="flex items-center gap-1">
          <input
            type="radio"
            name="type"
            value="saving"
            <%= account?.type === 'saving' ? 'checked' : '' %>
            <%= isReadOnly('type') ? 'disabled' : '' %>
          >
          Ahorro
        </label>
      </div>

      <% if (isReadOnly('type')) { %>
        <input type="hidden" name="type" value="<%= account?.type %>">
      <% } %>

      <% if (errors?.type) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.type %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Nombre -->
    <% if (!isHidden('name')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Nombre</label>
      <input
        type="text"
        name="name"
        class="w-full border rounded px-3 py-2"
        value="<%= account?.name || '' %>"
        <%= isReadOnly('name') ? 'readonly' : '' %>
        required
      >

      <% if (errors?.name) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.name %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Estado (solo activar / inactivar) -->
    <% if (!isHidden('is_active')) { %>
      <div class="mb-6">
        <label class="block font-medium mb-1">Estado</label>
        <select 
          name="is_active" 
          class="w-full border rounded px-3 py-2"
          <%= isReadOnly('is_active') ? 'disabled' : '' %>
        >
          <option value="true" <%= account?.is_active ? 'selected' : '' %>>Activar</option>
          <option value="false" <%= !account?.is_active ? 'selected' : '' %>>Inactivar</option>
        </select>

        <% if (isReadOnly('is_active')) { %>
          <input type="hidden" name="is_active" value="<%= account?.is_active %>">
        <% } %>

        <% if (errors?.is_active) { %>
          <p class="text-red-600 text-sm mt-1"><%= errors.is_active %></p>
        <% } %>
      </div>
    <% } %>


    <!-- Acciones -->
    <div class="flex justify-end gap-2">
      <a href="/accounts" class="px-4 py-2 bg-gray-200 rounded">
        Cancelar
      </a>

      <% if (mode === 'delete') { %>
      <button class="px-4 py-2 bg-red-600 text-white rounded" onclick="this.form.action.value='delete'">
        Eliminar  
      </button>
      <% } else { %> 
      <button class="px-4 py-2 bg-blue-600 text-white rounded" >
        Guardar
      </button>
      <% } %>
    </div>

  </form>
</div>

<script src="/js/forms/account-form.js"></script>
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\pages\accounts\index.ejs
```
 
```ejs
<script>
  window.USER_ID = "<%= USER_ID %>"
</script>

<div class="max-w-4xl mx-auto ui-page">

  <!-- Header fijo -->
  <div class="ui-header">
    <h1 class="ui-title">Cuentas</h1>

    <!-- Toolbar -->
    <div class="ui-toolbar">
      <%- include('../../partials/btn-new', {
        href: '/accounts/insert',
        title: 'Nueva cuenta',
        text: 'Nuevo',
        data_btn: 'new'
      }) %>

      <%- include('../../partials/btn-toggle-status.ejs', {
        initialStatus: 'all'
      }) %>

      <%- include('../../partials/search-box', {
        placeholder: 'Buscar cuentas...'
      }) %>
    </div>
  </div>

  <!-- =========================
       SCROLL INTERNO
       ========================= -->
  <div class="ui-scroll-area">

    <!-- Mobile cards -->
    <div id="accounts-mobile" class="accounts-mobile"></div>

    <!-- Desktop table -->
    <div class="ui-table-wrapper">
      <table class="ui-table">
        <thead>
          <tr>
            <th class="ui-th col-left">Nombre</th>
            <th class="ui-th col-left">Tipo</th>
            <th class="ui-th col-left">Estado</th>
            <th class="ui-th col-left">Cant. Trx.</th>
            <th class="ui-th col-left">Balance</th>
            <th class="ui-th col-left">Acciones</th>
          </tr>
        </thead>
        <tbody id="accounts-table"></tbody>
      </table>
    </div>

  </div>
</div>

<script src="/js/indexes/accounts-index.js"></script>
<script src="/js/helpers/icon-helper.js"></script>
<script src="/js/helpers/amount-helper.js"></script>
<script src="/js/helpers/type-tags-helper.js"></script>
<script src="/js/helpers/status-toggle-helper.js"></script>
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\pages\categories\form.ejs
```
 
```ejs
<%
  const rules = category_form_policy
  const isHidden = field => rules[field] === 'hidden'
  const isReadOnly = field => rules[field] === 'readonly'
  const isEditable = field => rules[field] === 'editable'
%>

<div class="max-w-xl mx-auto">
  <h1 class="text-2xl font-semibold mb-6">
    <%= 
      mode === 'insert' ? 'Insertar Categoria' :
      mode === 'update' ? 'Editar Categoria' :
      mode === 'delete' ? 'Eliminar Categoria' :
      mode
    %>
  </h1>

  <form method="post" action="/categories/">
    <!-- Token CSRF -->
    <input type="hidden" name="_csrf" value="<%= csrfToken %>">

    <!-- Error general -->
    <% if (errors?.general) { %>
      <div class="mb-4 p-3 bg-red-100 text-red-700 rounded">
        <%= errors.general %>
      </div>
    <% } %>

    <!-- ID y acción -->
    <input type="hidden" name="id" value="<%= category?.id || '' %>">
    <input type="hidden" name="mode" value="<%= mode %>">

    <!-- Tipo de categoría -->
    <% if (!isHidden('type')) { %>
    <div class="mb-4" id="type-container">
      <label class="block font-medium mb-1">Tipo</label>

      <div class="flex gap-6">
        <label class="flex items-center gap-1">
          <input
            type="radio"
            name="type"
            value="income"
            <%= category?.type === 'income' || !category ? 'checked' : '' %>
            <%= isReadOnly('type') ? 'disabled' : '' %>
          >
          Ingreso
        </label>

        <label class="flex items-center gap-1">
          <input
            type="radio"
            name="type"
            value="expense"
            <%= category?.type === 'expense' ? 'checked' : '' %>
            <%= isReadOnly('type') ? 'disabled' : '' %>
          >
          Gasto
        </label>
      </div>

      <% if (isReadOnly('type')) { %>
        <input type="hidden" name="type" value="<%= category?.type %>">
      <% } %>

      <% if (errors?.type) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.type %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Tipo de categoría -->
    <% if (!isHidden('type_for_loan')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Tipo de categoría para préstamos</label>

      <div class="flex gap-6">
        <label class="flex items-center gap-1">
          <input
            type="radio"
            name="type_for_loan"
            value="loan"
            <%= category?.type_for_loan === 'loan' ? 'checked' : '' %>
            <%= isReadOnly('type_for_loan') ? 'disabled' : '' %>
          >
          Para Préstamos
        </label>

        <label class="flex items-center gap-1">
          <input
            type="radio"
            name="type_for_loan"
            value="payment"
            <%= category?.type_for_loan === 'payment' ? 'checked' : '' %>
            <%= isReadOnly('type_for_loan') ? 'disabled' : '' %>
          >
          Para Pagos
        </label>

        <label class="flex items-center gap-1">
          <input
            type="radio"
            name="type_for_loan"
            value=""
            <%= category?.type_for_loan == null ? 'checked' : '' %>
            <%= isReadOnly('type_for_loan') ? 'disabled' : '' %>
          >
          Sin tipo
        </label>
      </div>

      <% if (isReadOnly('type_for_loan')) { %>
        <input type="hidden" name="type_for_loan" value="<%= category?.type_for_loan || '' %>">
      <% } %>

      <% if (errors?.type_for_loan) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.type_for_loan %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Nombre -->
    <% if (!isHidden('name')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Nombre</label>
      <input
        type="text"
        name="name"
        class="w-full border rounded px-3 py-2"
        value="<%= category?.name || '' %>"
        <%= isReadOnly('name') ? 'readonly' : '' %>
        required
      >
      <% if (errors?.name) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.name %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Grupo de Prestamos -->
     <% if (!isHidden('category_group_id')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Grupo</label>

      <div
        class="autocomplete"
        data-items='<%- JSON.stringify(category_group_list) %>'
        data-default-id="<%= category?.category_group?.id || '' %>"
        data-placeholder="-- Escoja una opción --"
      >
        <input 
          type="text" 
          class="autocomplete-input" 
          autocomplete="off" 
          value="<%= category?.category_group?.name || '' %>" 
          <%= isReadOnly('category_group') ? 'readonly' : '' %>>
        
          <input type="hidden" 
          class="autocomplete-hidden" 
          name="category_group_id"
          value="<%= category?.category_group?.id || '' %>"
          >
          <% if (!isReadOnly('category_group_id')) { %>
          <div class="autocomplete-panel"></div>
          <% } %>
      </div>

      <% if (errors?.category_group) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.category_group %></p>
      <% } %>
    </div>
    <% } %>  

    <!-- Estado (solo activar / inactivar) -->
    <% if (!isHidden('is_active')) { %>
      <div class="mb-6">
        <label class="block font-medium mb-1">Estado</label>
        <select 
          name="is_active" 
          class="w-full border rounded px-3 py-2"
          <%= isReadOnly('is_active') ? 'disabled' : '' %>
        >
          <option value="true" <%= category?.is_active ? 'selected' : '' %>>Activar</option>
          <option value="false" <%= !category?.is_active ? 'selected' : '' %>>Inactivar</option>
        </select>
        
        <% if (isReadOnly('is_active')) { %>
          <input type="hidden" name="is_active" value="<%= category?.is_active %>">
        <% } %>

        <% if (errors?.is_active) { %>
          <p class="text-red-600 text-sm mt-1"><%= errors.is_active %></p>
        <% } %>
      </div>
    <% } %>

    <!-- Acciones -->
    <div class="flex justify-end gap-2">
      <a 
        href="/categories" 
        class="px-4 py-2 bg-gray-200 rounded">
        Cancelar
      </a>

      <% if (mode === 'delete') { %>
        <button 
          class="px-4 py-2 bg-red-600 text-white rounded" 
          onclick="this.form.action.value='delete'">
          Eliminar
        </button>
      <% } else { %>
        <button class="px-4 py-2 bg-blue-600 text-white rounded">
          Guardar
        </button>
      <% } %>
    </div>
  </form>
</div>

<script src="/js/forms/category-form.js"></script>
<script src="/js/forms/autocomplete-form.js"></script>
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\pages\categories\index.ejs
```
 
```ejs
<script>
  window.USER_ID = "<%= USER_ID %>"
</script>

<div class="max-w-4xl mx-auto ui-page">

  <!-- Header fijo -->
  <div class="ui-header">
    <h1 class="ui-title">Categorías</h1>

    <!-- Toolbar -->
    <div class="ui-toolbar">

      <%- include('../../partials/btn-new', 
            { href: '#' , 
            title: 'Nueva categoría', 
            text: 'Nuevo' ,
            data_btn: 'new' 
      }) %>

      <%- include('../../partials/btn-toggle-status.ejs', { 
        initialStatus: 'all' 
      }) %>

      <%- include('../../partials/search-box', { 
        placeholder: 'Buscar categorías...' 
      }) %>
    </div>

    <!-- Modal Insertar -->
    <%- include('../../partials/ui-modal',{
      modal_id:'insert-modal',
      title:'¿Qué desea insertar?',
      buttons:[
        {id:'insert-group', text:'Grupo de Categorías', variant:'ui-modal-btn-primary'},
        {id:'insert-child', text:'Categoría Hija', variant:'ui-modal-btn-success'},
        {id:'close-modal', text:'Cancelar', variant:'ui-modal-btn-neutral'}
      ]
    }) %>
  </div>

  <!-- =========================
       SCROLL INTERNO (IGUAL QUE ACCOUNTS)
       ========================= -->
  <div class="ui-scroll-area">

    <!-- Mobile cards -->
    <div id="categories-mobile" class="categories-mobile"></div>

    <!-- Desktop table -->
    <div class="ui-table-wrapper">
      <table class="ui-table">
        <thead>
          <tr>
            <th class="ui-th col-left">Nombre</th>
            <th class="ui-th col-left">Tipo</th>
            <th class="ui-th col-left">Cant. Trx.</th>
            <th class="ui-th col-left">Estado</th>
            <th class="ui-th col-left">Acciones</th>
          </tr>
        </thead>
        <tbody id="categories-table"></tbody>
      </table>
    </div>

  </div>
</div>

<script src="/js/indexes/categories-index.js"></script>
<script src="/js/helpers/icon-helper.js"></script>
<script src="/js/helpers/amount-helper.js"></script>
<script src="/js/helpers/type-tags-helper.js"></script>
<script src="/js/helpers/status-toggle-helper.js"></script> 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\pages\category-groups\form.ejs
```
 
```ejs
<%
  const rules = category_group_form_policy
  const isHidden = field => rules[field] === 'hidden'
  const isReadOnly = field => rules[field] === 'readonly'
  const isEditable = field => rules[field] === 'editable'
%>

<div class="max-w-xl mx-auto">
  <h1 class="text-2xl font-semibold mb-6">
    <%= 
      mode === 'insert' ? 'Insertar Grupo Categoria' :
      mode === 'update' ? 'Editar Grupo Categoria' :
      mode === 'delete' ? 'Eliminar Grupo Categoria' :
      mode
    %>
  </h1>

  <form method="post" action="/category-groups/">
    <!-- Token CSRF -->
    <input type="hidden" name="_csrf" value="<%= csrfToken %>">

    <!-- Error general -->
    <% if (errors?.general) { %>
      <div class="mb-4 p-3 bg-red-100 text-red-700 rounded">
        <%= errors.general %>
      </div>
    <% } %>

    <!-- ID y acción -->
    <input type="hidden" name="id" value="<%= category_group?.id || '' %>">
    <input type="hidden" name="mode" value="<%= mode %>">

    <!-- Nombre -->
    <% if (!isHidden('name')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Nombre</label>
      <input
        type="text"
        name="name"
        class="w-full border rounded px-3 py-2"
        value="<%= category_group?.name || '' %>"
        <%= isReadOnly('name') ? 'readonly' : '' %>
        required
      >
      <% if (errors?.name) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.name %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Estado (solo activar / inactivar) -->
    <% if (!isHidden('is_active')) { %>
      <div class="mb-6">
        <label class="block font-medium mb-1">Estado</label>
        <select 
          name="is_active" 
          class="w-full border rounded px-3 py-2"
          <%= isReadOnly('is_active') ? 'disabled' : '' %>
        >
          <option value="true" <%= category_group?.is_active ? 'selected' : '' %>>Activar</option>
          <option value="false" <%= !category_group?.is_active ? 'selected' : '' %>>Inactivar</option>
        </select>
        <% if (isReadOnly('is_active')) { %>
          <input type="hidden" name="is_active" value="<%= category_group?.is_active %>">
        <% } %>

        <% if (errors?.is_active) { %>
          <p class="text-red-600 text-sm mt-1"><%= errors.is_active %></p>
        <% } %>
      </div>
    <% } %>

    <!-- Acciones -->
    <div class="flex justify-end gap-2">
      <a 
        href="/categories" 
        class="px-4 py-2 bg-gray-200 rounded">
        Cancelar
      </a>

      <% if (mode === 'delete') { %>
        <button 
          class="px-4 py-2 bg-red-600 text-white rounded" 
          onclick="this.form.action.value='delete'">
          Eliminar
        </button>
      <% } else { %>
        <button class="px-4 py-2 bg-blue-600 text-white rounded">
          Guardar
        </button>
      <% } %>
    </div>
  </form>
</div>

 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\pages\loan-groups\form.ejs
```
 
```ejs
<%
  const rules = loan_group_form_policy
  const isHidden = field => rules[field] === 'hidden'
  const isReadOnly = field => rules[field] === 'read'
  const isEditable = field => rules[field] === 'edit'
%>

<div class="max-w-xl mx-auto">
  <h1 class="text-2xl font-semibold mb-6">
    <%= 
      mode === 'insert' ? 'Insertar Grupo Préstamo' :
      mode === 'update' ? 'Editar Grupo Préstamo' :
      mode === 'delete' ? 'Eliminar Grupo Préstamo' :
      mode
    %>
  </h1>

  <form method="post" action="/loan-groups/">
    <!-- Token CSRF -->
    <input type="hidden" name="_csrf" value="<%= csrfToken %>">

    <!-- Error general -->
    <% if (errors?.general) { %>
      <div class="mb-4 p-3 bg-red-100 text-red-700 rounded">
        <%= errors.general %>
      </div>
    <% } %>

    <!-- ID y acción -->
    <input type="hidden" name="id" value="<%= loan_group?.id || '' %>">
    <input type="hidden" name="mode" value="<%= mode %>">

    <!-- Nombre -->
    <% if (!isHidden('name')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Nombre</label>
      <input
        type="text"
        name="name"
        class="w-full border rounded px-3 py-2"
        value="<%= loan_group?.name || '' %>"
        <%= isReadOnly('name') ? 'readonly' : '' %>
        required
      >
      <% if (errors?.name) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.name %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Estado (solo activar / inactivar) -->
    <% if (!isHidden('is_active')) { %>
      <div class="mb-6">
        <label class="block font-medium mb-1">Estado</label>
        <select 
          name="is_active" 
          class="w-full border rounded px-3 py-2"
          <%= isReadOnly('is_active') ? 'disabled' : '' %>
        >
          <option value="true" <%= loan_group?.is_active ? 'selected' : '' %>>Activar</option>
          <option value="false" <%= !loan_group?.is_active ? 'selected' : '' %>>Inactivar</option>
        </select>
        <% if (errors?.is_active) { %>
          <p class="text-red-600 text-sm mt-1"><%= errors.is_active %></p>
        <% } %>
      </div>
    <% } %>

    <!-- Acciones -->
    <div class="flex justify-end gap-2">
      <a 
        href="/loans" 
        class="px-4 py-2 bg-gray-200 rounded">
        Cancelar
      </a>

      <% if (mode === 'delete') { %>
        <button 
          class="px-4 py-2 bg-red-600 text-white rounded" 
          onclick="this.form.action.value='delete'">
          Eliminar
        </button>
      <% } else { %>
        <button class="px-4 py-2 bg-blue-600 text-white rounded">
          Guardar
        </button>
      <% } %>
    </div>
  </form>
</div>

 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\pages\loan-payments\form.ejs
```
 
```ejs
<%
  const rules = payment_form_policy
  const isHidden = field => rules[field] === 'hidden'
  const isReadOnly = field => rules[field] === 'readonly'
  const isEditable = field => rules[field] === 'editable'
%>

<%
const cancel_url =
  context?.from === 'categories' && context?.category_id
    ? `/transactions?from=categories&category_id=${context.category_id}`
    : `/payments/${loan_id}/loan`
%>

<script>
  window.TRANSACTIONS_CONTEXT = JSON.parse('<%- JSON.stringify(context || {}) %>');
</script>

<div class="max-w-xl mx-auto">

  <h1 class="text-2xl font-semibold mb-6">
    <%= 
      mode === 'insert' ? 'Insertar Pago' :
      mode === 'update' ? 'Editar Pago' :
      mode === 'delete' ? 'Eliminar Pago' :
      ''
    %>
  </h1>

  <form method="post" action="/payments">
    <!-- Token CSRF -->
    <input type="hidden" name="_csrf" value="<%= csrfToken %>">

    <% if (errors?.general) { %>
      <div class="mb-4 p-3 bg-red-100 text-red-700 rounded">
        <%= errors.general %>
      </div>
    <% } %>

    <!-- IDs -->
    <input type="hidden" name="id" value="<%= payment?.id || '' %>">
    <input type="hidden" name="loan_id" value="<%= loan_id || '' %>">
    <input type="hidden" name="mode" value="<%= mode %>">
    <input type="hidden" name="return_from" value="<%= context?.from || '' %>">
    <input type="hidden" name="return_category_id" value="<%= context?.category_id || '' %>">

    <!-- Cuenta -->
    <% if (!isHidden('account_id')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Cuenta</label>

      <div
        class="autocomplete"
        data-items='<%- JSON.stringify(account_list) %>'
        data-default-id="<%= payment?.account?.id || '' %>"
        data-placeholder="-- Escoja una cuenta --"
      >
        <input
          type="text"
          class="autocomplete-input"
          autocomplete="off"
          value="<%= payment?.account?.name || '' %>"
          <%= isReadOnly('account_id') ? 'readonly' : '' %>
        >

        <input
          type="hidden"
          class="autocomplete-hidden"
          name="account_id"
          value="<%= payment?.account?.id || '' %>"
        >

        <% if (!isReadOnly('account_id')) { %>
        <div class="autocomplete-panel"></div>
        <% } %>
      </div>

      <% if (errors?.account) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.account %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Categoria -->
    <% if (!isHidden('category_id')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Categoría</label>

      <div
        class="autocomplete"
        data-items='<%- JSON.stringify(active_expense_category_list) %>'
        data-default-id="<%= payment?.category?.id || '' %>"
        data-placeholder="-- Escoja una categoría --"
      >
        <input
          type="text"
          class="autocomplete-input"
          autocomplete="off"
          value="<%= payment?.category?.name || '' %>"
          <%= isReadOnly('category_id') ? 'readonly' : '' %>
        >

        <input
          type="hidden"
          class="autocomplete-hidden"
          name="category_id"
          value="<%= payment?.category?.id || '' %>"
        >

        <% if (!isReadOnly('category_id')) { %>
        <div class="autocomplete-panel"></div>
        <% } %>
      </div>

      <% if (errors?.category) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.category %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Capital -->
    <% if (!isHidden('principal_paid')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Monto Capital</label>
      <input
        type="number"
        step="0.01"
        min="0"
        name="principal_paid"
        class="w-full border rounded px-3 py-2"
        value="<%= payment?.principal_paid || '0.00' %>"
        <%= isReadOnly('principal_paid') ? 'readonly' : '' %>
        required
      >

      <% if (errors?.principal_paid) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.principal_paid %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Interes -->
    <% if (!isHidden('interest_paid')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Interés</label>
      <input
        type="number"
        step="0.01"
        min="0"
        name="interest_paid"
        class="w-full border rounded px-3 py-2"
        value="<%= payment?.interest_paid || '0.00' %>"
        <%= isReadOnly('interest_paid') ? 'readonly' : '' %>
      >

      <% if (errors?.interest_paid) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.interest_paid %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Fecha -->
    <% if (!isHidden('payment_date')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Fecha de Pago</label>
      <input
        type="datetime-local"
        name="payment_date"
        class="w-full border rounded px-3 py-2"
        value="<%= payment?.payment_date || '' %>"
        <%= isReadOnly('payment_date') ? 'readonly' : '' %>
        required
      >

      <% if (errors?.payment_date) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.payment_date %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Nota -->
    <% if (!isHidden('note')) { %>
    <div class="mb-6">
      <label class="block font-medium mb-1">Nota</label>
      <textarea
        name="note"
        rows="3"
        class="w-full border rounded px-3 py-2"
        <%= isReadOnly('note') ? 'readonly' : '' %>
      ><%= payment?.note || '' %></textarea>
    </div>
    <% } %>

    <!-- Acciones -->
    <div class="flex justify-end gap-2">

      <a href="<%= cancel_url %>" class="px-4 py-2 bg-gray-200 rounded">
        Cancelar
      </a>

      <% if (mode === 'delete') { %>
        <button
          type="submit"
          class="px-4 py-2 bg-red-600 text-white rounded"
        >
          Eliminar
        </button>
      <% } else { %>
        <button
          type="submit"
          class="px-4 py-2 bg-blue-600 text-white rounded"
        >
          Guardar
        </button>
      <% } %>

    </div>
  </form>
</div>

<script src="/js/forms/autocomplete-form.js"></script>
<script src="/js/forms/loan-payment-form.js"></script> 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\pages\loan-payments\index.ejs
```
 
```ejs
<script>
  window.USER_ID = "<%= USER_ID %>"
  window.LOAN_ID = "<%= loan.id %>"
</script>

<div class="max-w-6xl mx-auto ui-page">

  <!-- Header -->
  <div class="ui-header">
    <h1 class="ui-title">
      Pagos – <%= loan.name %>
    </h1>

    <div class="ui-toolbar">

      <%- include('../../partials/btn-back', {
        href: '/loans',
        title: 'Volver a préstamos',
        text: 'Volver'
      }) %>

      <%- include('../../partials/btn-new', {
        href: `/payments/insert/${loan.id}`,
        title: 'Nuevo pago',
        text: 'Nuevo',
        data_btn: 'new'
      }) %>

      <%- include('../../partials/search-box', {
        placeholder: 'Buscar pagos...'
      }) %>

    </div>
  </div>

  <!-- =========================
       SCROLL INTERNO
       ========================= -->
  <div class="ui-scroll-area">

    <!-- Mobile cards -->
    <div id="payments-mobile" class="payments-mobile"></div>

    <!-- Desktop table -->
    <div class="ui-table-wrapper">
      <table class="ui-table">
        <thead>
          <tr>
            <th class="ui-th col-left">Fecha</th>
            <th class="ui-th col-left">Monto</th>
            <th class="ui-th col-left">Interés</th>
            <th class="ui-th col-left">Cuenta</th>
            <th class="ui-th col-left">Categoría</th>
            <th class="ui-th col-left">No. Pago</th>
            <th class="ui-th col-left">Acciones</th>
          </tr>
        </thead>
        <tbody id="payments-table"></tbody>
      </table>
    </div>

  </div>
</div>

<script src="/js/indexes/loan-payments-index.js"></script>
<script src="/js/helpers/icon-helper.js"></script>
<script src="/js/helpers/amount-helper.js"></script>
<script src="/js/helpers/type-tags-helper.js"></script>
<script src="/js/helpers/format-datetime-helper.js"></script>
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\pages\loans\form.ejs
```
 
```ejs
<%
  const rules = loan_form_policy
  const isHidden = field => rules[field] === 'hidden'
  const isReadOnly = field => rules[field] === 'readonly'
  const isEditable = field => rules[field] === 'editable'
%>

<%
const cancel_url =
  context?.from === 'categories' && context?.category_id
    ? `/transactions?from=categories&category_id=${context.category_id}`
    : `/loans`
%>

<script>
  window.TRANSACTIONS_CONTEXT = JSON.parse('<%- JSON.stringify(context || {}) %>');
</script>

<div class="max-w-xl mx-auto">
  <h1 class="text-2xl font-semibold mb-6">
    <%= 
      mode === 'insert' ? 'Insertar Préstamo' : 
      mode === 'update' ? 'Editar Préstamo' :
      mode === 'delete' ? 'Eliminar Préstamo' : 
      ''
    %>
  </h1>

  <form method="post" action="/loans/">
    <!-- Token CSRF -->
    <input type="hidden" name="_csrf" value="<%= csrfToken %>">

    <% if (errors?.general) { %>
      <div class="mb-4 p-3 bg-red-100 text-red-700 rounded">
        <%= errors.general %>
      </div>
    <% } %>

    <!-- ID y acción -->
    <input type="hidden" name="id" value="<%= loan?.id || '' %>">
    <input type="hidden" name="mode" value="<%= mode %>">
    <input type="hidden" name="is_active" value="<%= loan?.is_active || 'true' %>">
    <input type="hidden" name="return_from" value="<%= context?.from || '' %>">
    <input type="hidden" name="return_category_id" value="<%= context?.category_id || '' %>">

    <!-- Nombre -->
    <% if (!isHidden('name')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Nombre</label>
      <input
        type="text"
        name="name"
        class="w-full border rounded px-3 py-2"
        value="<%= loan?.name || '' %>"
        <%= isReadOnly('name') ? 'readonly' : '' %>
        required
      >

      <% if (errors?.name) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.name %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Notas -->
    <% if (!isHidden('note')) { %>
    <div class="mb-6">
      <label class="block font-medium mb-1">Nota</label>
      <textarea
        name="note"
        rows="3"
        class="w-full border rounded px-3 py-2"
        <%= isReadOnly('note') ? 'readonly' : '' %>
      ><%= loan?.note || '' %></textarea>

      <% if (errors?.note) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.note %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Monto total -->
    <% if (!isHidden('total_amount')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Monto total</label>
      <input
        type="number"
        step="0.01"
        name="total_amount"
        class="w-full border rounded px-3 py-2"
        value="<%= loan?.total_amount || '' %>"
        <%= isReadOnly('total_amount') ? 'readonly' : '' %>
        required
      >

      <% if (errors?.total_amount) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.total_amount %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Fecha inicio -->
    <% if (!isHidden('start_date')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Fecha inicio</label>
      <input
        type="datetime-local"
        name="start_date"
        class="w-full border rounded px-3 py-2"
        value="<%= loan?.start_date || '' %>"
        <%= isReadOnly('start_date') ? 'readonly' : '' %>
        required
      >

      <% if (errors?.start_date) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.start_date %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Cuenta de desembolso -->
    <% if (!isHidden('disbursement_account_id')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Cuenta de desembolso</label>
      <div
        class="autocomplete"
        data-items='<%- JSON.stringify(disbursement_account_list) %>'
        data-default-id="<%= loan?.disbursement_account?.id || '' %>"
        data-placeholder="-- Escoja una opción --"
      >
        <input 
          type="text" 
          class="autocomplete-input" 
          autocomplete="off" 
          value="<%= loan?.disbursement_account?.name || '' %>" 
          <%= isReadOnly('disbursement_account_id') ? 'readonly' : '' %>>
        
        <input 
          type="hidden" 
          class="autocomplete-hidden" 
          name="disbursement_account_id"
          value="<%= loan?.disbursement_account?.id || '' %>">
        <% if (!isReadOnly('disbursement_account_id')) { %>
        <div class="autocomplete-panel"></div>
        <% } %>
      </div>
      
      <% if (errors?.disbursement_account) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.disbursement_account %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Categoria -->
    <% if (!isHidden('category_id')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Categoría</label>
      <div
        class="autocomplete"
        data-items='<%- JSON.stringify(active_income_category_list) %>'
        data-default-id="<%= loan?.category?.id || '' %>"
        data-placeholder="-- Escoja una opción --"
      >
        <input 
          type="text" 
          class="autocomplete-input" 
          autocomplete="off" 
          value="<%= loan?.category?.name || '' %>" 
          <%= isReadOnly('category_id') ? 'readonly' : '' %>>
        
        <input 
          type="hidden" 
          class="autocomplete-hidden" 
          name="category_id"
          value="<%= loan?.category?.id || '' %>">

        <% if (!isReadOnly('category_id')) { %>
        <div class="autocomplete-panel"></div>
        <% } %>
      </div>
      
      <% if (errors?.category) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.category %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Grupo de Prestamos -->
     <% if (!isHidden('loan_group_id')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Grupo de Préstamos</label>
      <div
        class="autocomplete"
        data-items='<%- JSON.stringify(loan_group_list) %>'
        data-default-id="<%= loan?.loan_group || '' %>"
        data-placeholder="-- Escoja una opción --"
      >
        <input 
          type="text" 
          class="autocomplete-input" 
          autocomplete="off" 
          value="<%= loan?.loan_group?.name || '' %>" 
          <%= isReadOnly('loan_group_id') ? 'readonly' : '' %>>
        
        <input 
          type="hidden" 
          class="autocomplete-hidden" 
          name="loan_group_id"
          value="<%= loan?.loan_group?.id || '' %>">
          
        <% if (!isReadOnly('loan_group_id')) { %>
        <div class="autocomplete-panel"></div>
        <% } %>
      </div>
      <% if (errors?.loan_group) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.loan_group %></p>
      <% } %>
    </div>
    <% } %>    

    <!-- Acciones -->
    <div class="flex justify-end gap-2">
      <a href="<%= cancel_url %>" class="px-4 py-2 bg-gray-200 rounded">
        Cancelar
      </a>

      <% if (mode === 'delete') { %>
        <button
          class="px-4 py-2 bg-red-600 text-white rounded"
          onclick="this.form.action.value='delete'">
          Eliminar
        </button>
      <% } else { %>
        <button class="px-4 py-2 bg-blue-600 text-white rounded">
          Guardar
        </button>
      <% } %>
    </div>

  </form>
</div>

<script src="/js/forms/loan-form.js"></script>
<script src="/js/forms/autocomplete-form.js"></script>

 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\pages\loans\index.ejs
```
 
```ejs
<script>
  window.USER_ID = "<%= USER_ID %>"
</script>

<div class="max-w-6xl mx-auto ui-page">

  <!-- Header -->
  <div class="ui-header">
    <h1 class="ui-title">Préstamos</h1>

    <div class="ui-toolbar">
      <%- include('../../partials/btn-new', {
        href: '#',
        title: 'Nuevo Préstamo',
        text: 'Nuevo',
        data_btn: 'new'
      }) %>

      <%- include('../../partials/btn-toggle-status.ejs', {
        initialStatus: 'all'
      }) %>

      <%- include('../../partials/search-box', {
        placeholder: 'Buscar préstamos...'
      }) %>
    </div>

    <!-- Modal Insertar -->
    <%- include('../../partials/ui-modal',{
      modal_id:'insert-modal',
      title:'¿Qué desea insertar?',
      buttons:[
        {id:'insert-group', text:'Grupo de Préstamo', variant:'ui-modal-btn-primary'},
        {id:'insert-child', text:'Préstamo Hijo', variant:'ui-modal-btn-success'},
        {id:'close-modal', text:'Cancelar', variant:'ui-modal-btn-neutral'}
      ]
    }) %>    
  </div>

  <!-- =========================
       SCROLL INTERNO
       ========================= -->
  <div class="ui-scroll-area">

    <!-- Mobile cards -->
    <div id="loans-mobile" class="loans-mobile"></div>

    <!-- Desktop table -->
    <div class="ui-table-wrapper">
      <table class="ui-table">
        <thead>
          <tr>
            <th class="ui-th col-left">Nombre</th>
            <th class="ui-th col-left">Monto</th>
            <th class="ui-th col-left">Capital</th>
            <th class="ui-th col-left">Interés</th>
            <th class="ui-th col-left">Saldo</th>
            <th class="ui-th col-left">Estado</th>
            <th class="ui-th col-left">Cuenta</th>
            <th class="ui-th col-left">Categoría</th>
            <th class="ui-th col-left">Acciones</th>
          </tr>
        </thead>
        <tbody id="loans-table"></tbody>
      </table>
    </div>

  </div>
</div>

<script src="/js/indexes/loans-index.js"></script>
<script src="/js/helpers/icon-helper.js"></script>
<script src="/js/helpers/amount-helper.js"></script>
<script src="/js/helpers/type-tags-helper.js"></script>
<script src="/js/helpers/status-toggle-helper.js"></script>
<script src="/js/helpers/format-datetime-helper.js"></script>
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\pages\transactions\batch-categorize.ejs
```
 
```ejs
<script id="batch-data" type="application/json">
<%- JSON.stringify({
  active_income_categories: active_income_categories || [],
  active_expense_categories: active_expense_categories || [],
  transactions: transactions || [],
  has_income: has_income || false,
  has_expense: has_expense || false
}) %>
</script>

<script>
  window.USER_ID = "<%= USER_ID %>"
  const batch_data = JSON.parse(document.getElementById('batch-data').textContent)
  window.ACTIVE_INCOME_CATEGORIES = batch_data.active_income_categories
  window.ACTIVE_EXPENSE_CATEGORIES = batch_data.active_expense_categories
  window.BATCH_TRANSACTIONS = batch_data.transactions
  window.HAS_INCOME = batch_data.has_income
  window.HAS_EXPENSE = batch_data.has_expense
</script>

<form id="batch-categorize-form" method="POST" action="/transactions/batch-categorize">

  <input type="hidden" name="return_from" value="<%= context?.from || '' %>">
  <input type="hidden" name="return_category_id" value="<%= context?.category_id || '' %>">

  <% if (has_income) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Categoría de Ingresos</label>

      <div
        id="batch-income-category-autocomplete"
        class="autocomplete"
        data-items='<%- JSON.stringify(active_income_categories || []) %>'
        data-selected-id=""
        data-placeholder="-- Escoja una categoría --"
      >
        <input
          type="text"
          id="batch-income-category-input"
          class="autocomplete-input"
          autocomplete="off"
          placeholder="-- Escoja una categoría --"
        >

        <input
          type="hidden"
          id="batch-income-category-id"
          name="income_category_id"
          class="autocomplete-hidden"
          value=""
        >

        <div class="autocomplete-panel"></div>
      </div>
    </div>
  <% } %>
  <% if (has_expense) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Categoría de Gastos</label>
      <div
        id="batch-expense-category-autocomplete"
        class="autocomplete"
        data-items='<%- JSON.stringify(active_expense_categories || []) %>'
        data-selected-id=""
        data-placeholder="-- Escoja una categoría --"
      >
        <input
          type="text"
          id="batch-expense-category-input"
          class="autocomplete-input"
          autocomplete="off"
          placeholder="-- Escoja una categoría --"
        >

        <input
          type="hidden"
          id="batch-expense-category-id"
          name="expense_category_id"
          class="autocomplete-hidden"
          value=""
        >

        <div class="autocomplete-panel"></div>
      </div>
    </div>
  <% } %>

<div class="max-w-6xl mx-auto ui-page">
  <!-- =========================
       SCROLL INTERNO
       ========================= -->
  <div class="ui-scroll-area">

    <!-- Mobile cards -->
    <div id="batch-categorize-mobile" class="batch-categorize-mobile"></div>

    <!-- Desktop table -->
    <div class="ui-table-wrapper">
      <table class="ui-table">
        <thead>
          <tr>
            <th class="ui-th col-left">Fecha</th>
            <th class="ui-th col-left col-sm">Tipo</th>
            <th class="ui-th col-right">Monto</th>
            <th class="ui-th col-left">Descripción</th>
            <th class="ui-th col-left">Categoría</th>
            <th class="ui-th col-left">Nueva Categoria</th>
          </tr>
        </thead>
        <tbody id="transactions-table"></tbody>
      </table>
    </div>

  </div>
</div>

<!-- Hidden fields for transaction IDs -->
<input type="hidden" id="income-ids-input" name="income_ids" value="">
<input type="hidden" id="expense-ids-input" name="expense_ids" value="">

<div class="mt-6 flex justify-end gap-3">
  <button
    type="button"
    id="batch-cancel-btn"
    class="ui-btn ui-btn-secondary"
  >
    Cancelar
  </button>

  <button
    type="submit"
    class="ui-btn ui-btn-primary"
  >
    Guardar
  </button>
</div>

</form>


<script src="/js/indexes/batch-categorize-index.js"></script>
<script src="/js/helpers/amount-helper.js"></script>
<script src="/js/helpers/type-tags-helper.js"></script> 
<script src="/js/forms/autocomplete-form.js"></script>
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\pages\transactions\form.ejs
```
 
```ejs
<%
  const rules = transaction_form_policy
  const isHidden = field => rules[field] === 'hidden'
  const isReadOnly = field => rules[field] === 'read'
  const isEditable = field => rules[field] === 'edit'

%>

<div class="max-w-3xl mx-auto">
  <input
    type="hidden"
    id="original-transaction-type"
    value="<%= transaction?.type || '' %>"
  >

  <h1 class="text-2xl font-semibold mb-6">
    <%= 
      mode === 'insert' 
        ? 'Insertar Transacción' : mode === 'update'
        ? 'Editar Transacción' : mode === 'delete'
        ? 'Eliminar Transacción' : mode === 'clone'
        ? 'Clonar Transacción' : mode
    %>
  </h1>

  <form method="post" action="/transactions">
    <!-- Token CSRF -->
    <input type="hidden" name="_csrf" value="<%= csrfToken %>">

    <% if (errors?.general) { %>
      <div class="mb-4 p-3 bg-red-100 text-red-700 rounded">
        <%= errors.general %>
      </div>
    <% } %>

    <!-- ID -->
    <input type="hidden" name="id" value="<%= transaction?.id || '' %>">
    <input type="hidden" name="mode" value="<%= mode %>">
    <input type="hidden" name="return_from" value="<%= context?.from || '' %>">
    <input type="hidden" name="return_category_id" value="<%= context?.category_id || '' %>">

    <!-- BLINDAJE DEL TIPO -->
    <% if (isReadOnly('type')) { %>
      <input
        type="hidden"
        name="type"
        value="<%= transaction?.type || '' %>"
      >
    <% } %>

    <!-- Tipo -->
    <% if (!isHidden('type')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Tipo</label>
      <div class="flex gap-6">
        <label class="flex items-center gap-1">
          <input
            type="radio"
            name="type"
            value="income"
            <%= transaction?.type === 'income' ? 'checked' : '' %>
            <%= isReadOnly('type') ? 'disabled' : '' %>
          >
          Ingreso
        </label>

        <label class="flex items-center gap-1">
          <input
            type="radio"
            name="type"
            value="expense"
            <%= transaction?.type === 'expense' ? 'checked' : '' %>
            <%= isReadOnly('type') ? 'disabled' : '' %>
          >
          Egreso
        </label>

        <label class="flex items-center gap-1">
          <input
            type="radio"
            name="type"
            value="transfer"
            <%= transaction?.type === 'transfer' ? 'checked' : '' %>
            <%= isReadOnly('type') ? 'disabled' : '' %>
          >
          Transferencia
        </label>
      </div>

      <% if (errors?.type) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.type %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Cuenta origen -->
    <% if (!isHidden('account')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Cuenta</label>

      <div
        class="autocomplete"
        data-items='<%- JSON.stringify(active_accounts) %>'
        data-default-id="<%= transaction?.account?.id || '' %>"
        data-placeholder="-- Escoja una cuenta --"
      >
        <input
          type="text"
          class="autocomplete-input"
          autocomplete="off"
          value="<%= transaction?.account?.name || '' %>"
          <%= isReadOnly('account') ? 'readonly' : '' %>
        >
        <input
          type="hidden"
          class="autocomplete-hidden"
          name="account"
          value="<%= transaction?.account?.id || '' %>"
        >
        <% if (!isReadOnly('account')) { %>
        <div class="autocomplete-panel"></div>
        <% } %>
      </div>

      <% if (errors?.account) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.account %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Cuenta destino -->
    <% if (!isHidden('to_account')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Cuenta Destino</label>

      <div
        class="autocomplete"
        data-items='<%- JSON.stringify(active_accounts_for_transfer) %>'
        data-default-id="<%= transaction?.to_account?.id || '' %>"
        data-placeholder="-- Escoja una cuenta destino --"
      >
        <input
          type="text"
          class="autocomplete-input"
          autocomplete="off"
          value="<%= transaction?.to_account?.name || '' %>"
          <%= isReadOnly('to_account') ? 'readonly' : '' %>
        >
        <input
          type="hidden"
          class="autocomplete-hidden"
          name="to_account"
          value="<%= transaction?.to_account?.id || '' %>"
        >
        <% if (!isReadOnly('to_account')) { %>
        <div class="autocomplete-panel"></div>
        <% } %>
      </div>

      <% if (errors?.to_account) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.to_account %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Categoría -->
    <% if (!isHidden('category')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Categoría</label>

      <div 
        class="autocomplete"
        data-items-income='<%- JSON.stringify(active_income_categories) %>'
        data-items-expense='<%- JSON.stringify(active_expense_categories) %>'
        data-default-id="<%= transaction?.category?.id || '' %>"
        data-placeholder="-- Escoja una categoría --"
      >
        <input
          type="text"
          class="autocomplete-input"
          autocomplete="off"
          value="<%= transaction?.category?.name || '' %>"
          <%= isReadOnly('category') ? 'readonly' : '' %>
        >
        <input
          type="hidden"
          class="autocomplete-hidden"
          name="category"
          value="<%= transaction?.category?.id || '' %>"
        >
        
        <% if (!isReadOnly('category')) { %>
        <div class="autocomplete-panel"></div>
        <% } %>
      </div>

      <% if (errors?.category) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.category %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Monto -->
    <% if (!isHidden('amount')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Monto</label>
      <input
        type="number"
        step="0.01"
        min="0.01"
        name="amount"
        class="w-full border rounded px-3 py-2"
        value="<%= transaction?.amount || '' %>"
        <%= isReadOnly('amount') ? 'readonly' : '' %>
        required
      >

      <% if (errors?.amount) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.amount %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Fecha -->
    <% if (!isHidden('date')) { %>
    <div class="mb-4">
      <label class="block font-medium mb-1">Fecha</label>
      <input
        type="datetime-local"
        name="date"
        class="w-full border rounded px-3 py-2"
        value="<%= transaction?.date || '' %>"
        <%= isReadOnly('date') ? 'readonly' : '' %>
        required
      >

      <% if (errors?.date) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.date %></p>
      <% } %>
    </div>
    <% } %>

    <!-- Descripción -->
    <% if (!isHidden('description')) { %>
    <div class="mb-6">
      <label class="block font-medium mb-1">Descripción</label>
      <textarea
        name="description"
        rows="3"
        class="w-full border rounded px-3 py-2"
        <%= isReadOnly('description') ? 'readonly' : '' %>
      ><%= transaction?.description || '' %></textarea>

      <% if (errors?.description) { %>
        <p class="text-red-600 text-sm mt-1"><%= errors.description %></p>
      <% } %>
    </div>
    <% } %>

    <div class="flex justify-end gap-2">
      <%
        const cancelUrl =
          context?.from === 'categories' && context?.category_id
            ? `/transactions?from=categories&category_id=${context.category_id}`
            : '/transactions'
      %>
      <a href="<%= cancelUrl %>" class="px-4 py-2 bg-gray-200 rounded">
        Cancelar
      </a>

      <% if (mode === 'delete') { %>
        <button
          type="submit"
          class="px-4 py-2 bg-red-600 text-white rounded"
        >
          Eliminar
        </button>
      <% } else { %>
        <button type="submit" class="px-4 py-2 bg-blue-600 text-white rounded">
          Guardar
        </button>
      <% } %>
    </div>

  </form>
</div>

<script src="/js/forms/transactions-form.js"></script>
<script src="/js/forms/autocomplete-form.js"></script>
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\pages\transactions\index.ejs
```
 
```ejs
<script>
  window.USER_ID = "<%= USER_ID %>"
</script>

<script>
  window.TRANSACTIONS_CONTEXT = JSON.parse('<%- JSON.stringify(context || {}) %>');
</script>

<div class="max-w-6xl mx-auto ui-page">

  <!-- Header -->
  <div class="ui-header">
    <h1 class="ui-title">Transacciones</h1>

    <div class="ui-toolbar">

      <div id="toolbar-normal-actions" class="flex gap-2">
        <% if (context?.from === 'categories') { %>
          <%- include('../../partials/btn-back', {
            href: `/categories`,
            title: 'Volver a categorías',
            text: 'Volver'
          }) %>
        <% } %>

        <%- include('../../partials/btn-new', {
          href:
            context?.from === 'categories' && context?.category_id
              ? `/transactions/insert?from=categories&category_id=${context.category_id}`
              : '/transactions/insert',
          title: 'Nueva transacción',
          text: 'Nuevo',
          data_btn: 'new'
        }) %>

        <%- include('../../partials/btn-categorize-batch', {
          title: 'Categorizar Transacciones',
          text: 'Categorizar',
          data_btn: 'categorize'
        }) %>

        <%- include('../../partials/search-box', {
          placeholder: 'Buscar transacciones...'
        }) %>
      </div>

      <div id="toolbar-batch-actions" class="flex gap-2 hidden">
        <%- include('../../partials/btn-accept-batch', {
          title: 'Aceptar Lote',
          text: 'Aceptar'
        }) %>

        <%- include('../../partials/btn-cancel-batch', {
          title: 'Cancelar Lote',
          text: 'Cancelar'
        }) %>
      </div>

    </div>
  </div>

  <!-- =========================
       PAGINADO SUPERIOR
       ========================= -->
  <div class="mb-2 flex justify-between items-center text-sm">
    <div id="page-info-top"></div>
    <div class="flex gap-2">
      <button id="prev-page-top" class="ui-btn ui-btn-default">Anterior</button>
      <button id="next-page-top" class="ui-btn ui-btn-default">Siguiente</button>
    </div>
  </div>

  <!-- =========================
       SCROLL INTERNO
       ========================= -->
  <div class="ui-scroll-area">

    <!-- Mobile cards -->
    <div id="transactions-mobile" class="transactions-mobile"></div>

    <!-- Desktop table -->
    <div class="ui-table-wrapper">
      <table class="ui-table">
        <thead>
          <tr>
            <th class="ui-th col-left">Fecha</th>
            <th class="ui-th col-left">Tipo</th>
            <th class="ui-th col-left">Monto</th>
            <th class="ui-th col-left">Cuenta</th>
            <th class="ui-th col-left">Categoría</th>
            <th class="ui-th col-left">Acciones</th>
          </tr>
        </thead>
        <tbody id="transactions-table"></tbody>
      </table>
    </div>

  </div>
</div>

<script src="/js/indexes/transactions-index.js"></script>
<script src="/js/indexes/transactions-batch-categorize-index.js"></script>
<script src="/js/helpers/icon-helper.js"></script>
<script src="/js/helpers/amount-helper.js"></script>
<script src="/js/helpers/type-tags-helper.js"></script> 
<script src="/js/helpers/format-datetime-helper.js"></script>
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\partials\btn-accept-batch.ejs
```
 
```ejs
<button
  id="btn-batch-accept"
  type="button"
  class="ui-btn ui-btn-primary"
  title="<%= title || 'Aceptar' %>"
>
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor"
    >
    <path 
      stroke-linecap="round" 
      stroke-linejoin="round" 
      stroke-width="2" 
      d="M5 13l4 4L19 7" />
  </svg>
  <span class="ui-btn-text"><%= text || 'Aceptar' %></span>
</button>
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\partials\btn-back.ejs
```
 
```ejs
<button
  type="button"
  class="ui-btn ui-btn-default"
  title="<%= title || 'Volver' %>"
  onclick="location.href='<%= href %>'"
>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M15 19l-7-7 7-7"
    />
  </svg>
  <span class="ui-btn-text"><%= text || 'Volver' %></span>
</button>
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\partials\btn-cancel-batch.ejs
```
 
```ejs
<button
  id="btn-batch-cancel"
  type="button"
  class="ui-btn ui-btn-default"
  title="<%= title || 'Cancelar' %>"
>
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor">
    <path 
      stroke-linecap="round" 
      stroke-linejoin="round" 
      stroke-width="2" 
      d="M6 18L18 6M6 6l12 12" />
  </svg>
  <span class="ui-btn-text"><%= text || 'Cancelar' %></span>
</button>
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\partials\btn-categorize-batch.ejs
```
 
```ejs
<button
  id="btn-batch-start"
  type="button"
  class="ui-btn ui-btn-default"
  title="<%= title || 'Categorizar' %>"
  data-btn="<%= data_btn || 'categorize' %>"
  >
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M4 6h16M4 12h16M4 18h16"
    />
  </svg>

  <span class="ui-btn-text"><%= text || 'Categorizar' %></span>
</button>
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\partials\btn-filter.ejs
```
 
```ejs
<button
  class="ui-btn ui-btn-default"
  title="<%= title || 'Filtrar' %>"
  <% if (onclick) { %> onclick="<%= onclick %>" <% } %>
>

  <svg xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor">

    <path stroke-linecap="round" 
      stroke-linejoin="round" 
      stroke-width="2"
      d="M3 4h18l-7 8v6l-4-2v-4L3 4z" />
  </svg>

  <span class="ui-btn-text"><%= text || 'Filtrar' %></span>
</button>
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\partials\btn-new.ejs
```
 
```ejs
<button
  onclick="location.href='<%= href %>'"
  class="ui-btn ui-btn-default"
  title="<%= title || 'Nuevo' %>"
  data-btn="<%= data_btn || 'new' %>"
  >

  <svg xmlns="http://www.w3.org/2000/svg"
       viewBox="0 0 24 24"
       fill="none"
       stroke="currentColor"
       width="20"
       height="20">
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M12 4v16m8-8H4" />
  </svg>

  <span class="ui-btn-text"><%= text || 'Nuevo' %></span>
</button>
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\partials\btn-recalculate.ejs
```
 
```ejs
<button
  id="<%= 'btnRecalculate' %>"
  class="ui-btn ui-btn-primary"
  title="<%= 'Recalcular balances' %>">

  <svg xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor">
    
    <path stroke-linecap="round" 
      stroke-linejoin="round" 
      stroke-width="2"
      d="M4 4v6h6M20 20v-6h-6M5 19a9 9 0 0014-7M19 5a9 9 0 00-14 7" />
  </svg>

  <span class="ui-btn-text"><%= 'Recalcular' %></span>
</button>
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\partials\btn-toggle-status.ejs
```
 
```ejs
<button
  type="button"
  class="ui-btn ui-btn-default js-status-filter-toggle"
  data-status="<%= initialStatus || 'all' %>"
  title="Filtrar Estado">

  <span class="ui-btn-icon"></span>
  <span class="ui-btn-text"></span>

</button>
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\partials\navbar.ejs
```
 
```ejs
<nav class="bg-blue-600 text-white">
  <div class="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 h-14 flex items-center justify-between">

    <div class="font-semibold text-base sm:text-lg">
      App Contable V1
    </div>

    <% if (typeof net_balance !== 'undefined') { %>
      <span class="navbar-net-balance <%= net_balance > 0 ? 'positive' : 'negative' %>">
      <%= net_balance.toFixed(2) %>
      </span>
    <% } %>

    
    <% if (typeof loan_balance !== 'undefined') { %>
      <span class="navbar-loan_balance">
      <%= loan_balance.toFixed(2) %>
      </span>
    <% } %>

    <!-- Botón hamburguesa (solo móvil) -->
    <button
      id="mobile-menu-btn"
      class="sm:hidden p-1 focus:outline-none"
      aria-label="Abrir menú">

      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none"
        viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M4 6h16M4 12h16M4 18h16"/>
      </svg>
    </button>

    <!-- Menú desktop -->
    <ul class="hidden sm:flex items-center space-x-4 lg:space-x-6 text-sm lg:text-base">
      <li><a href="/home" class="hover:underline">Inicio</a></li>
      <li><a href="/accounts" class="hover:underline">Cuentas</a></li>
      <li><a href="/categories" class="hover:underline">Categorías</a></li>
      <li><a href="/transactions" class="hover:underline">Transacciones</a></li>
      <li><a href="/loans" class="hover:underline">Préstamos</a></li>
      <li><a href="/logout" class="hover:underline">Cerrar Sesión</a></li>
    </ul>
  </div>

  <!-- Menú móvil -->
  <ul
    id="mobile-menu"
    class="sm:hidden hidden bg-blue-700 px-3 py-2 space-y-1 text-sm">

    <li><a href="/home" class="block py-2">Inicio</a></li>
    <li><a href="/accounts" class="block py-2">Cuentas</a></li>
    <li><a href="/categories" class="block py-2">Categorías</a></li>
    <li><a href="/transactions" class="block py-2">Transacciones</a></li>
    <li><a href="/loans" class="block py-2">Préstamos</a></li>
    <li><a href="/logout" class="block py-2">Cerrar Sesión</a></li>
  </ul>
</nav>

<script>
  const btn = document.getElementById('mobile-menu-btn')
  const menu = document.getElementById('mobile-menu')

  btn.addEventListener('click', () => {
    menu.classList.toggle('hidden')
  })
</script>
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\partials\search-box.ejs
```
 
```ejs
<div class="ui-search">

  <!-- Limpiar -->
  <button
    id="<%= 'clear-search-btn' %>"
    class="icon-btn absolute left-0 top-0 h-full text-gray-400 hover:text-red-500 hidden"
    title="Limpiar">

    <svg xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor">

      <path stroke-linecap="round" 
        stroke-linejoin="round" 
        stroke-width="2"
       d="M6 18L18 6M6 6l12 12" />
    </svg>
  </button>

  <input
    id="<%= 'search-input' %>"
    type="text"
    placeholder="<%= placeholder || 'Buscar...' %>"
    class="w-full border rounded-lg pl-10 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600" />

  <!-- Buscar -->
  <button
    id="<%= 'search-btn' %>"
    class="icon-btn absolute right-0 top-0 h-full text-gray-600 hover:text-blue-600"
    title="Buscar">

    <svg xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor">

      <path stroke-linecap="round" 
        stroke-linejoin="round" 
        stroke-width="2"
        d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z" />
    </svg>
  </button>

</div>
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\views\partials\ui-modal.ejs
```
 
```ejs
<div id="<%= modal_id %>" class="ui-modal hidden">
  <div id="<%= modal_id %>-content" class="ui-modal-content">
    <h2 class="text-lg font-semibold mb-4 text-center"><%= title %></h2>
    <div class="flex flex-col gap-3">
      <% buttons.forEach(btn=>{ %>
        <button id="<%= btn.id %>" class="ui-modal-btn <%= btn.variant %>"><%= btn.text %></button>
      <% }) %>
    </div>
  </div>
</div> 
```
 
