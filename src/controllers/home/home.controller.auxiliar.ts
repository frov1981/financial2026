import { AppDataSource } from "../../config/datasource"
import { Transaction } from "../../entities/Transaction.entity"

/* ============================================================================
   Servicio: Resumen últimos 6 meses (ingresos / egresos / balance)
============================================================================ */
export const getLastSixMonthsChartData = async (userId: number) => {

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
   KPIs últimos 6 meses
============================================================================ */
export const getLastSixMonthsKPIs = async (userId: number) => {

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

