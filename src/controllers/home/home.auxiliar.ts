import { AppDataSource } from "../../config/typeorm.datasource"
import { Account } from "../../entities/Account.entity"
import { Loan } from "../../entities/Loan.entity"
import { LoanPayment } from "../../entities/LoanPayment.entity"
import { Transaction } from "../../entities/Transaction.entity"
import { AuthRequest } from "../../types/auth-request"

/* ============================================================================
   Servicio: Resumen últimos 6 meses (ingresos / egresos / balance)
============================================================================ */
export const getChartDataLast6MonthsBalance = async (authReq: AuthRequest) => {
  const userId = authReq.user.id
  const txRepo = AppDataSource.getRepository(Transaction)

  /* ============================
     Rango de fechas
  ============================ */
  const endDate = new Date()
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - 5)
  startDate.setDate(1)

  /* ============================
     Query agregada por mes (MySQL)
  ============================ */
  const rows = await txRepo
    .createQueryBuilder('t')
    .select([
      "DATE_FORMAT(t.date, '%Y-%m') AS month",
      "SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) AS income",
      "SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) AS expense"
    ])
    .where('t.user_id = :userId', { userId })
    .andWhere('t.type IN (:...types)', { types: ['income', 'expense'] })
    .andWhere('t.date BETWEEN :start AND :end', {
      start: startDate,
      end: endDate
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

  const cursor = new Date(startDate)

  while (cursor <= endDate) {

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
export const getChartDataLast6YearsBalance = async (authReq: AuthRequest) => {
  const userId = authReq.user.id
  const txRepo = AppDataSource.getRepository(Transaction)

  /* ============================
     Rango de fechas
  ============================ */
  const endDate = new Date()
  const startDate = new Date()
  startDate.setFullYear(startDate.getFullYear() - 5)
  startDate.setMonth(0)
  startDate.setDate(1)

  /* ============================
     Query agregada por año (MySQL)
  ============================ */
  const rows = await txRepo
    .createQueryBuilder('t')
    .select([
      "YEAR(t.date) AS year",
      "SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) AS income",
      "SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) AS expense"
    ])
    .where('t.user_id = :userId', { userId })
    .andWhere('t.type IN (:...types)', { types: ['income', 'expense'] })
    .andWhere('t.date BETWEEN :start AND :end', {
      start: startDate,
      end: endDate
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

  const cursor = new Date(startDate)

  while (cursor <= endDate) {

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
export const getKpisLast6MonthsBalance = async (authReq: AuthRequest) => {
  const userId = authReq.user.id
  const txRepo = AppDataSource.getRepository(Transaction)

  /* ============================
     Rango fechas
  ============================ */
  const endDate = new Date()
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - 5)
  startDate.setDate(1)

  /* ============================
     Query agregada mensual
  ============================ */
  const rows = await txRepo
    .createQueryBuilder('t')
    .select([
      "DATE_FORMAT(t.date, '%Y-%m') AS month",
      "SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) AS income",
      "SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) AS expense"
    ])
    .where('t.user_id = :userId', { userId })
    .andWhere('t.type IN (:...types)', { types: ['income', 'expense'] })
    .andWhere('t.date BETWEEN :start AND :end', {
      start: startDate,
      end: endDate
    })
    .groupBy("DATE_FORMAT(t.date, '%Y-%m')")
    .orderBy("DATE_FORMAT(t.date, '%Y-%m')", 'ASC')
    .getRawMany()

  /* ============================
     Normalización
  ============================ */
  const income: number[] = []
  const expense: number[] = []

  const cursor = new Date(startDate)

  while (cursor <= endDate) {

    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    const row = rows.find(r => r.month === key)

    income.push(row ? Number(row.income) : 0)
    expense.push(row ? Number(row.expense) : 0)

    cursor.setMonth(cursor.getMonth() + 1)
  }

  /* ============================
     KPIs
  ============================ */
  const totalIncome = income.reduce((a, b) => a + b, 0)
  const totalExpense = expense.reduce((a, b) => a + b, 0)
  const balance = totalIncome - totalExpense
  const avgExpense = totalExpense / income.length

  const lastBalance = income[income.length - 1] - expense[expense.length - 1]
  const prevBalance = income[income.length - 2] - expense[expense.length - 2]
  const trend = lastBalance - prevBalance

  return {
    totalIncome,
    totalExpense,
    balance,
    avgExpense,
    trend
  }
}

/* ============================================================================
   Servicio: Resumen anual de préstamos (total prestado, pagado, intereses, saldo)
============================================================================ */
export const getChartDataLast6YearsLoan = async (authReq: AuthRequest) => {
  const userId = authReq.user.id
  const loanRepo = AppDataSource.getRepository(Loan)
  const paymentRepo = AppDataSource.getRepository(LoanPayment)
  const lastYears = 5

  /* ============================
     Determinar años a consultar
  ============================ */
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: lastYears }, (_, i) => currentYear - (lastYears - 1 - i))

  /* ============================
     Total prestado y saldo por año
  ============================ */
  const loanRows = await loanRepo
    .createQueryBuilder('l')
    .select([
      "YEAR(l.start_date) AS year",
      "SUM(l.total_amount) AS totalLoan",
      "SUM(l.balance) AS balance"
    ])
    .where("l.user_id = :userId", { userId })
    .andWhere("l.is_active = 1")
    .groupBy("YEAR(l.start_date)")
    .orderBy("YEAR(l.start_date)", "ASC")
    .getRawMany<{ year: string, totalLoan: string, balance: string }>()

  /* ============================
     Total pagado e intereses por año
  ============================ */
  const paymentRows = await paymentRepo
    .createQueryBuilder('p')
    .innerJoin('p.loan', 'l')
    .select([
      "YEAR(l.start_date) AS year",
      "SUM(p.principal_paid) AS totalPaid",
      "SUM(p.interest_paid) AS totalInterest"
    ])
    .where("l.user_id = :userId", { userId })
    .andWhere("l.is_active = 1")
    .groupBy("YEAR(l.start_date)")
    .orderBy("YEAR(l.start_date)", "ASC")
    .getRawMany<{ year: string, totalPaid: string, totalInterest: string }>()

  /* ============================
     Normalización: asegurar todos los años
  ============================ */
  const labels: string[] = []
  const totalLoan: number[] = []
  const totalPaid: number[] = []
  const totalInterest: number[] = []
  const balance: number[] = []

  years.forEach(y => {
    const loanRow = loanRows.find(r => Number(r.year) === y)
    const payRow = paymentRows.find(r => Number(r.year) === y)

    labels.push(String(y))
    totalLoan.push(loanRow ? Number(loanRow.totalLoan) : 0)
    balance.push(loanRow ? Number(loanRow.balance) : 0)
    totalPaid.push(payRow ? Number(payRow.totalPaid) : 0)
    totalInterest.push(payRow ? Number(payRow.totalInterest) : 0)
  })

  return {
    labels,
    totalLoan,
    totalPaid,
    totalInterest,
    balance
  }
}

/* ============================================================================
   KPIs globales (solo Transactions + Accounts)
============================================================================ */
export const getKpisGlobalBalance = async (authReq: AuthRequest) => {
  const userId = authReq.user.id
  const txRepo = AppDataSource.getRepository(Transaction)
  const accountRepo = AppDataSource.getRepository(Account)

  /* ============================
     Ingresos y egresos
  ============================ */
  const incomeExpense = await txRepo
    .createQueryBuilder('t')
    .select([
      "SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) AS income",
      "SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END) AS expense"
    ])
    .where('t.user_id = :userId', { userId })
    .getRawOne()

  const totalIncome = Number(incomeExpense?.income || 0)
  const totalExpense = Number(incomeExpense?.expense || 0)

  /* ============================
     Ahorros y retiros (TRANSFER)
     ahorro  = entra a saving
     retiro  = sale de saving
  ============================ */
  const savingsData = await txRepo
    .createQueryBuilder('t')
    .innerJoin('t.account', 'fromAcc')
    .leftJoin('t.to_account', 'toAcc')
    .select([
      "SUM(CASE WHEN t.type = 'transfer' AND toAcc.type = 'saving' THEN t.amount ELSE 0 END) AS savings",
      "SUM(CASE WHEN t.type = 'transfer' AND fromAcc.type = 'saving' THEN t.amount ELSE 0 END) AS withdrawals"
    ])
    .where('t.user_id = :userId', { userId })
    .getRawOne()

  const totalSavings = Number(savingsData?.savings || 0)
  const totalWithdrawals = Number(savingsData?.withdrawals || 0)

  /* ============================
     Cuentas activas
  ============================ */
  const accounts = await accountRepo.find({
    where: { user: { id: userId }, is_active: true }
  })

  const netWorth = accounts.reduce(
    (sum, acc) => sum + Number(acc.balance),
    0
  )

  const availableSavings = accounts
    .filter(a => a.type === 'saving')
    .reduce((sum, a) => sum + Number(a.balance), 0)

  /* ============================
     KPIs finales (7)
  ============================ */
  const netBalance = netWorth - availableSavings

  const loanRepo = AppDataSource.getRepository(Loan)

  /* ============================
     KPIs Préstamos
  ============================ */
  const loanData = await loanRepo
    .createQueryBuilder('l')
    .select([
      "SUM(l.total_amount) AS totalLoan",
      "SUM(l.principal_paid) AS totalPrincipalPaid",
      "SUM(l.interest_paid) AS totalInterestPaid",
      "SUM(l.balance) AS totalLoanBalance"
    ])
    .where('l.user_id = :userId', { userId })
    .getRawOne()

  const totalLoan = Number(loanData?.totalLoan || 0)
  const totalPrincipalPaid = Number(loanData?.totalPrincipalPaid || 0)
  const totalInterestPaid = Number(loanData?.totalInterestPaid || 0)
  const totalLoanBalance = Number(loanData?.totalLoanBalance || 0)
  
  console.log(totalLoan, totalPrincipalPaid, totalInterestPaid, totalLoanBalance)
  return {
    totalIncome,
    totalExpense,
    totalSavings,
    totalWithdrawals,
    netWorth,
    availableSavings,
    netBalance,
    totalLoan,
    totalPrincipalPaid,
    totalInterestPaid,
    totalLoanBalance
  }
}


