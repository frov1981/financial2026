import { DateTime } from 'luxon'
import { AppDataSource } from '../config/typeorm.datasource'
import { CacheKpiBalance } from '../entities/CacheKpiBalance.entity'
import { AuthRequest } from '../types/auth-request'
import { logger } from '../utils/logger.util'
import { parseError } from '../utils/error.util'

function money(n: number) {
  return Number(n.toFixed(2))
}

const query_curr_period = `
SELECT
COALESCE(SUM(CASE WHEN t.type='income' AND l.id IS NULL THEN t.amount END),0) incomes,

/* SOLO expenses reales */
COALESCE(SUM(CASE WHEN t.type='expense' AND lp.id IS NULL THEN t.amount END),0) expenses,

COALESCE(SUM(CASE WHEN t.type='transfer' AND a_to.type='saving' THEN t.amount END),0) savings,
COALESCE(SUM(CASE WHEN t.type='transfer' AND a_from.type='saving' AND a_to.type<>'saving' THEN t.amount END),0) withdrawals,

COALESCE(SUM(CASE WHEN l.id IS NOT NULL THEN t.amount END),0) loans,

/* payments separado */
COALESCE(SUM(CASE WHEN lp.id IS NOT NULL THEN t.amount END),0) payments,

COALESCE((
SELECT SUM(lp2.principal_paid)
FROM loan_payments lp2
JOIN loans l2 ON l2.id=lp2.loan_id
WHERE l2.user_id=? AND lp2.payment_date>=? AND lp2.payment_date<?
),0) principal_breakdown,

COALESCE((
SELECT SUM(lp2.interest_paid)
FROM loan_payments lp2
JOIN loans l2 ON l2.id=lp2.loan_id
WHERE l2.user_id=? AND lp2.payment_date>=? AND lp2.payment_date<?
),0) interest_breakdown

FROM transactions t
LEFT JOIN loans l ON l.transaction_id=t.id
LEFT JOIN loan_payments lp ON lp.transaction_id=t.id
LEFT JOIN accounts a_from ON a_from.id=t.account_id
LEFT JOIN accounts a_to ON a_to.id=t.to_account_id

WHERE t.user_id=? AND t.date>=? AND t.date<?
`

const query_all_periods = `
INSERT INTO cache_kpi_balances (
  user_id,period_year,period_month,
  incomes,expenses,savings,withdrawals,loans,payments,
  total_inflows,total_outflows,net_cash_flow,net_savings,available_balance,
  principal_breakdown,interest_breakdown
)
SELECT
  t.user_id,
  YEAR(t.date),
  MONTH(t.date),

  SUM(CASE WHEN t.type='income' AND l.id IS NULL THEN t.amount ELSE 0 END),

  /* SOLO expenses reales */
  SUM(CASE WHEN t.type='expense' AND lp.id IS NULL THEN t.amount ELSE 0 END),

  SUM(CASE WHEN t.type='transfer' AND a_to.type='saving' THEN t.amount ELSE 0 END),
  SUM(CASE WHEN t.type='transfer' AND a_from.type='saving' AND a_to.type<>'saving' THEN t.amount ELSE 0 END),

  SUM(CASE WHEN l.id IS NOT NULL THEN t.amount ELSE 0 END),
  SUM(CASE WHEN lp.id IS NOT NULL THEN t.amount ELSE 0 END),

  /* inflows */
  SUM(CASE WHEN t.type='income' AND l.id IS NULL THEN t.amount ELSE 0 END)
  + SUM(CASE WHEN l.id IS NOT NULL THEN t.amount ELSE 0 END),

  /* outflows CORRECTO */
  SUM(CASE WHEN t.type='expense' AND lp.id IS NULL THEN t.amount ELSE 0 END)
  + SUM(CASE WHEN lp.id IS NOT NULL THEN t.amount ELSE 0 END),

  /* net cash */
  (
    SUM(CASE WHEN t.type='income' AND l.id IS NULL THEN t.amount ELSE 0 END)
    + SUM(CASE WHEN l.id IS NOT NULL THEN t.amount ELSE 0 END)
  ) -
  (
    SUM(CASE WHEN t.type='expense' AND lp.id IS NULL THEN t.amount ELSE 0 END)
    + SUM(CASE WHEN lp.id IS NOT NULL THEN t.amount ELSE 0 END)
  ),

  /* net savings */
  SUM(CASE WHEN t.type='transfer' AND a_to.type='saving' THEN t.amount ELSE 0 END)
  - SUM(CASE WHEN t.type='transfer' AND a_from.type='saving' AND a_to.type<>'saving' THEN t.amount ELSE 0 END),

  /* available */
  (
    (
      SUM(CASE WHEN t.type='income' AND l.id IS NULL THEN t.amount ELSE 0 END)
      + SUM(CASE WHEN l.id IS NOT NULL THEN t.amount ELSE 0 END)
    ) -
    (
      SUM(CASE WHEN t.type='expense' AND lp.id IS NULL THEN t.amount ELSE 0 END)
      + SUM(CASE WHEN lp.id IS NOT NULL THEN t.amount ELSE 0 END)
    )
  ) -
  (
    SUM(CASE WHEN t.type='transfer' AND a_to.type='saving' THEN t.amount ELSE 0 END)
    - SUM(CASE WHEN t.type='transfer' AND a_from.type='saving' AND a_to.type<>'saving' THEN t.amount ELSE 0 END)
  ),

  /* FIX GROUP BY */
  COALESCE((
    SELECT SUM(lp2.principal_paid)
    FROM loan_payments lp2
    JOIN loans l2 ON l2.id = lp2.loan_id
    WHERE l2.user_id = t.user_id
      AND YEAR(lp2.payment_date) = YEAR(MIN(t.date))
      AND MONTH(lp2.payment_date) = MONTH(MIN(t.date))
  ),0),

  COALESCE((
    SELECT SUM(lp2.interest_paid)
    FROM loan_payments lp2
    JOIN loans l2 ON l2.id = lp2.loan_id
    WHERE l2.user_id = t.user_id
      AND YEAR(lp2.payment_date) = YEAR(MIN(t.date))
      AND MONTH(lp2.payment_date) = MONTH(MIN(t.date))
  ),0)

FROM transactions t
LEFT JOIN loans l ON l.transaction_id=t.id
LEFT JOIN loan_payments lp ON lp.transaction_id=t.id
LEFT JOIN accounts a_from ON a_from.id=t.account_id
LEFT JOIN accounts a_to ON a_to.id=t.to_account_id

WHERE t.user_id=?
GROUP BY t.user_id, YEAR(t.date), MONTH(t.date)
`

export class KpiCacheService {

  static async recalcMonthlyKPIs(auth_req: AuthRequest, period_year: number, period_month: number) {
    const user_id = auth_req.user.id
    const timezone = auth_req.timezone || 'UTC'

    try {
      const now = DateTime.now().setZone(timezone)
      const is_current_period = now.year === period_year && now.month === period_month

      if (!is_current_period) {
        await this.rebuildAllUserKPIs(user_id, timezone)
        return
      }

      const local_start = DateTime.fromObject({ year: period_year, month: period_month, day: 1 }, { zone: timezone })
      const start_date = local_start.toUTC().toJSDate()
      const end_date = local_start.plus({ months: 1 }).toUTC().toJSDate()

      const kpi_data = await AppDataSource.manager.query(query_curr_period, [
        user_id, start_date, end_date,
        user_id, start_date, end_date,
        user_id, start_date, end_date
      ])

      if (!kpi_data?.length) return

      const record = kpi_data[0]

      logger.debug('KPI_RAW_RECORD', record)

      const total_inflows = money(Number(record.incomes) + Number(record.loans))
      const total_outflows = money(Number(record.expenses) + Number(record.payments))

      const net_cash_flow = money(total_inflows - total_outflows)
      const net_savings = money(Number(record.savings) - Number(record.withdrawals))
      const available_balance = money(net_cash_flow - net_savings)

      logger.debug('KPI_FINAL', {
        total_inflows,
        total_outflows,
        net_cash_flow,
        net_savings,
        available_balance
      })

      const repo = AppDataSource.getRepository(CacheKpiBalance)

      const existing = await repo.findOne({
        where: { user: { id: user_id }, period_year, period_month },
        relations: ['user']
      })

      if (existing) {
        await repo.update(
          { id: existing.id },
          {
            incomes: record.incomes,
            expenses: record.expenses,
            savings: record.savings,
            withdrawals: record.withdrawals,
            loans: record.loans,
            payments: record.payments,
            total_inflows,
            total_outflows,
            net_cash_flow,
            net_savings,
            available_balance,
            principal_breakdown: record.principal_breakdown,
            interest_breakdown: record.interest_breakdown
          }
        )
      } else {
        await repo.insert({
          user: { id: user_id } as any,
          period_year,
          period_month,
          incomes: record.incomes,
          expenses: record.expenses,
          savings: record.savings,
          withdrawals: record.withdrawals,
          loans: record.loans,
          payments: record.payments,
          total_inflows,
          total_outflows,
          net_cash_flow,
          net_savings,
          available_balance,
          principal_breakdown: record.principal_breakdown,
          interest_breakdown: record.interest_breakdown
        })
      }

      logger.info(`KPIs recalculados user=${user_id} periodo=${period_month}/${period_year}`)

    } catch (error: any) {
      logger.error('Error recalculando KPIs', parseError(error))
    }
  }

  static async rebuildAllUserKPIs(user_id: number, timezone: string) {
    try {
      const repo = AppDataSource.getRepository(CacheKpiBalance)

      await repo.delete({ user: { id: user_id } })

      await AppDataSource.manager.query(query_all_periods, [user_id])

      logger.info(`KPI FULL REBUILD user=${user_id}`)

    } catch (error) {
      logger.error('Error en rebuildAllUserKPIs', parseError(error))
    }
  }

}