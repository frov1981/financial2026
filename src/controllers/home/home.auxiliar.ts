import { DateTime } from 'luxon'
import { AppDataSource } from "../../config/typeorm.datasource"
import { Account } from "../../entities/Account.entity"
import { Loan } from "../../entities/Loan.entity"
import { LoanPayment } from "../../entities/LoanPayment.entity"
import { Transaction } from "../../entities/Transaction.entity"
import { AuthRequest } from "../../types/auth-request"
import { CacheKpiBalance } from '../../entities/CacheKpiBalance.entity'

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

/* ============================================================================
   KPIs globales desde la Cache
============================================================================ */
export const getKpisCachelBalance = async (auth_req: AuthRequest) => {

  const user_id = auth_req.user.id
  const year_period = Number(auth_req.query.year_period || 0)
  const month_period = Number(auth_req.query.month_period || 0)

  const repo = AppDataSource.getRepository(CacheKpiBalance)

  const qb = repo.createQueryBuilder('k').where('k.user_id = :user_id', { user_id })

  if (year_period > 0) qb.andWhere('k.period_year = :year', { year: year_period })
  if (year_period > 0 && month_period > 0) qb.andWhere('k.period_month = :month', { month: month_period })

  const rows = await qb.getMany()

  if (!rows.length) {
    return {
      incomes: 0, expenses: 0, savings: 0, withdrawals: 0, loans: 0, payments: 0, total_inflows: 0, total_outflows: 0, net_cash_flow: 0, net_savings: 0, available_balance: 0, principal_breakdown: 0, interest_breakdown: 0
    }
  }

  const result = rows.reduce((acc, row) => {
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
    return acc
  }, {
    incomes: 0, expenses: 0, savings: 0, withdrawals: 0, loans: 0, payments: 0, total_inflows: 0, total_outflows: 0, net_cash_flow: 0, net_savings: 0, available_balance: 0, principal_breakdown: 0, interest_breakdown: 0
  })

  return result
}

