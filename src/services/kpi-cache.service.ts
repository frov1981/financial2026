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
  SUM(CASE WHEN t.type = 'income' AND l.id IS NULL THEN t.amount ELSE 0 END) AS incomes,
  SUM(CASE WHEN t.type = 'expense' AND lp.id IS NULL THEN t.amount ELSE 0 END) AS expenses,
  SUM(CASE WHEN t.type = 'income' AND l.id IS NOT NULL THEN t.amount ELSE 0 END) AS loans,
  SUM(CASE WHEN t.type = 'expense' AND lp.id IS NOT NULL THEN t.amount ELSE 0 END) AS payments,

  SUM(CASE 
    WHEN t.type = 'transfer' 
    AND ta.type = 'saving' 
    AND (fa.type <> 'saving' OR ta.id <> fa.id)
  THEN t.amount ELSE 0 END) AS savings,

  SUM(CASE 
    WHEN t.type = 'transfer' 
    AND fa.type = 'saving' 
    AND (ta.type <> 'saving' OR ta.id <> fa.id)
  THEN t.amount ELSE 0 END) AS withdrawals

FROM transactions t
LEFT JOIN loans l ON l.transaction_id = t.id
LEFT JOIN loan_payments lp ON lp.transaction_id = t.id
LEFT JOIN accounts fa ON fa.id = t.account_id
LEFT JOIN accounts ta ON ta.id = t.to_account_id

WHERE t.user_id = ?
AND (? IS NULL OR t.date >= ?)
AND (? IS NULL OR t.date < ?)
`

export class KpiCacheService {

  /* ============================
     KPI MES ACTUAL (SOLO UNO)
  ============================ */
  static async recalcCurrentMonthKPI(auth_req: AuthRequest, period_year: number, period_month: number) {

    const user_id = auth_req.user.id
    const timezone = auth_req.timezone || 'UTC'

    try {

      const start_local = new Date(period_year, period_month - 1, 1)
      const end_local = new Date(period_year, period_month, 1)

      const start_date = new Date(formatDateForInputLocal(start_local, timezone))
      const end_date = new Date(formatDateForInputLocal(end_local, timezone))

      const result = await AppDataSource.manager.query(query_base, [
        user_id,
        start_date, start_date,
        end_date, end_date
      ])

      if (!result?.length) return

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

      const repo = AppDataSource.getRepository(CacheKpiBalance)

      const existing = await repo.findOne({
        where: { user: { id: user_id }, period_year, period_month },
        relations: ['user']
      })

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

      logger.info(`KPI MES recalculado user=${user_id} periodo=${period_month}/${period_year}`)

    } catch (error: any) {
      logger.error('Error recalculando KPI mes', parseError(error))
    }
  }

  /* ============================
     REBUILD COMPLETO
  ============================ */
  static async rebuildAllUserKPIs(user_id: number, timezone: string) {

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
      logger.error('Error en rebuildAllUserKPIs', parseError(error))
    }
  }

  /* ============================
   ENTRY POINT (REEMPLAZA recalcMonthlyKPIs)
  ============================ */
  static async recalcKPIs(auth_req: AuthRequest, period_year: number, period_month: number) {

    const user_id = auth_req.user.id
    const timezone = auth_req.timezone || 'UTC'

    try {
      /* 
        Se obtiene la fecha actual usando el mismo flujo que usa la app
        para garantizar consistencia con BD (UTC basado en timezone)
      */
      const now_local = new Date()
      const now_utc = new Date(formatDateForInputLocal(now_local, timezone))

      const current_year = now_utc.getUTCFullYear()
      const current_month = now_utc.getUTCMonth() + 1

      const is_current_period = current_year === period_year && current_month === period_month

      if (is_current_period) {
        await this.recalcCurrentMonthKPI(auth_req, period_year, period_month)
      } else {
        await this.rebuildAllUserKPIs(user_id, timezone)
      }

    } catch (error: any) {
      logger.error('Error en recalcKPIs', parseError(error))
    }
  }

  /* ============================
   RECALCULAR KPI POR TRANSACCIÓN
  ============================ */
  static async recalcKPIsByTransaction(auth_req: AuthRequest, transaction: any) {

    const user_id = auth_req.user.id
    const timezone = auth_req.timezone || 'UTC'

    try {

      if (!transaction?.date) {
        logger.warn('recalcKPIsByTransaction sin transaction.date')
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
        await this.recalcCurrentMonthKPI(auth_req, trx_year, trx_month)
      } else {
        await this.rebuildAllUserKPIs(user_id, timezone)
      }

      logger.debug('KPI recalculado por transacción', { trx_year, trx_month, current_year, current_month, is_current_period })

    } catch (error: any) {
      logger.error('Error en recalcKPIsByTransaction', parseError(error))
    }
  }

}

