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
  COALESCE(SUM(CASE WHEN t.flow_type = 'incomes' THEN t.amount END), 0) AS incomes,
  COALESCE(SUM(CASE WHEN t.flow_type = 'expenses' THEN t.amount END), 0) AS expenses,
  COALESCE(SUM(CASE WHEN t.flow_type = 'savings' THEN t.amount END), 0) AS savings,
  COALESCE(SUM(CASE WHEN t.flow_type = 'withdrawals' THEN t.amount END), 0) AS withdrawals,
  COALESCE(SUM(CASE WHEN t.flow_type = 'loans' THEN t.amount END), 0) AS loans,
  COALESCE(SUM(CASE WHEN t.flow_type = 'payments' THEN t.amount END), 0) AS payments,

  COALESCE((
    SELECT SUM(lp.principal_paid)
    FROM loan_payments lp
    JOIN loans l ON l.id = lp.loan_id
    WHERE l.user_id = ?
    AND lp.payment_date >= ?
    AND lp.payment_date < ?
  ), 0) AS principal_breakdown,

  COALESCE((
    SELECT SUM(lp.interest_paid)
    FROM loan_payments lp
    JOIN loans l ON l.id = lp.loan_id
    WHERE l.user_id = ?
    AND lp.payment_date >= ?
    AND lp.payment_date < ?
  ), 0) AS interest_breakdown

FROM transactions t
WHERE t.user_id = ?
AND t.date >= ?
AND t.date < ?
`

const query_all_periods = `
INSERT INTO cache_kpi_balances (
    user_id, period_year, period_month, incomes, expenses, savings, withdrawals, loans, payments, total_inflows, total_outflows, net_cash_flow, net_savings, available_balance, principal_breakdown, interest_breakdown
)
SELECT
t.user_id,
YEAR(t.date),
MONTH(t.date),
COALESCE(SUM(CASE WHEN t.flow_type = 'incomes' THEN t.amount END), 0),
COALESCE(SUM(CASE WHEN t.flow_type = 'expenses' THEN t.amount END), 0),
COALESCE(SUM(CASE WHEN t.flow_type = 'savings' THEN t.amount END), 0),
COALESCE(SUM(CASE WHEN t.flow_type = 'withdrawals' THEN t.amount END), 0),
COALESCE(SUM(CASE WHEN t.flow_type = 'loans' THEN t.amount END), 0),
COALESCE(SUM(CASE WHEN t.flow_type = 'payments' THEN t.amount END), 0),
COALESCE(SUM(CASE WHEN t.flow_type IN ('incomes','loans') THEN t.amount END), 0),
COALESCE(SUM(CASE WHEN t.flow_type IN ('expenses','payments') THEN t.amount END), 0),
COALESCE(SUM(CASE WHEN t.flow_type IN ('incomes','loans') THEN t.amount END), 0)-COALESCE(SUM(CASE WHEN t.flow_type IN ('expenses','payments') THEN t.amount END), 0),
COALESCE(SUM(CASE WHEN t.flow_type = 'savings' THEN t.amount END), 0)-COALESCE(SUM(CASE WHEN t.flow_type = 'withdrawals' THEN t.amount END), 0),
(COALESCE(SUM(CASE WHEN t.flow_type IN ('incomes','loans') THEN t.amount END), 0)-COALESCE(SUM(CASE WHEN t.flow_type IN ('expenses','payments') THEN t.amount END), 0))
-
(COALESCE(SUM(CASE WHEN t.flow_type = 'savings' THEN t.amount END), 0)-COALESCE(SUM(CASE WHEN t.flow_type = 'withdrawals' THEN t.amount END), 0)),
0,
0

FROM transactions t
WHERE t.user_id = ?
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
            const start_of_month_utc = local_start.toUTC()
            const start_of_next_month_utc = local_start.plus({ months: 1 }).toUTC()
            const start_date = start_of_month_utc.toJSDate()
            const end_date = start_of_next_month_utc.toJSDate()
            logger.debug(`recalcMonthlyKPIs.KPI_RANGE_DEBUG`, { timezone, period_year, period_month, start: start_of_month_utc.toISO(), end: start_of_next_month_utc.toISO() })

            const kpi_data = await AppDataSource.manager.query(query_curr_period, [user_id, start_date, end_date, user_id, start_date, end_date, user_id, start_date, end_date])
            if (!kpi_data?.length) return

            const record = kpi_data[0]
            const total_inflows = money(Number(record.incomes) + Number(record.loans))
            const total_outflows = money(Number(record.expenses) + Number(record.payments))
            const net_cash_flow = money(total_inflows - total_outflows)
            const net_savings = money(Number(record.savings) - Number(record.withdrawals))
            const available_balance = money(net_cash_flow - net_savings)

            const repo = AppDataSource.getRepository(CacheKpiBalance)
            const existing = await repo.findOne({ where: { user: { id: user_id }, period_year, period_month }, relations: ['user'] })

            logger.debug(`recalcMonthlyKPIs.record`, { ...record, total_inflows, total_outflows, net_cash_flow, net_savings, available_balance })
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
        } catch (err: any) {
            logger.error('Error recalculando KPIs', parseError(err))
        }
    }

    static async rebuildAllUserKPIs(user_id: number, timezone: string) {
        try {
            const repo = AppDataSource.getRepository(CacheKpiBalance)
            await repo.delete({ user: { id: user_id } })
            await AppDataSource.manager.query(query_all_periods, [user_id])
            logger.info(`KPI FULL REBUILD user=${user_id}`)
        } catch (err) {
            logger.error('Error en rebuildAllUserKPIs', parseError(err))
        }
    }

}