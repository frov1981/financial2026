import { AppDataSource } from '../config/typeorm.datasource'
import { CacheKpiBalance } from '../entities/CacheKpiBalance.entity'
import { AuthRequest } from '../types/auth-request'
import { logger } from '../utils/logger.util'
import { parseError } from '../utils/error.util'
import { formatDateForInputLocal } from '../utils/date.util'

function money(n: number) {
  return Number(n.toFixed(2))
}

/* ============================
   QUERY BASE (ÚNICA FUENTE)
============================ */
const query_base = `
SELECT
  COALESCE(SUM(CASE 
    WHEN COALESCE(NULLIF(t.detailed_type, ''), t.type) = 'income' THEN t.amount ELSE 0 END), 0) AS incomes,
  COALESCE(SUM(CASE 
    WHEN COALESCE(NULLIF(t.detailed_type, ''), t.type) = 'expense' THEN t.amount ELSE 0 END), 0) AS expenses,
  COALESCE(SUM(CASE 
    WHEN COALESCE(NULLIF(t.detailed_type, ''), t.type) = 'income_for_loan' THEN t.amount ELSE 0 END), 0) AS loans,
  COALESCE(SUM(CASE 
    WHEN COALESCE(NULLIF(t.detailed_type, ''), t.type) = 'payment_for_loan' THEN t.amount ELSE 0 END), 0) AS payments,
  COALESCE(SUM(CASE 
    WHEN COALESCE(NULLIF(t.detailed_type, ''), t.type) = 'saving' THEN t.amount ELSE 0 END), 0) AS savings,
  COALESCE(SUM(CASE 
    WHEN COALESCE(NULLIF(t.detailed_type, ''), t.type) = 'withdrawal' THEN t.amount ELSE 0 END), 0) AS withdrawals
FROM transactions t
WHERE t.user_id = ?
AND (? IS NULL OR t.date >= ?)
AND (? IS NULL OR t.date < ?)
`
export class KpiCacheService {

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

}

