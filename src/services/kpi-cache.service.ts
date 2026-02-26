// services/kpi-cache.service.ts
import { AppDataSource } from '../config/typeorm.datasource'
import { CacheKpiBalance } from '../entities/CacheKpiBalance.entity'
import { Transaction } from '../entities/Transaction.entity'
import { logger } from '../utils/logger.util'

export class KpiCacheService {

    /**
     * Recalcula los KPIs mensuales basados en la fecha de la transacción recibida
     */
    static async recalcMonthlyKPIs(transaction: Transaction) {
        try {

            const user_id = transaction.user.id
            const tx_date = transaction.date

            if (!tx_date) return

            const year = tx_date.getUTCFullYear()
            const month = tx_date.getUTCMonth() + 1

            // =========================
            // Consulta consolidada del mes
            // =========================
            const kpiData = await AppDataSource.manager.query(
                `
        SELECT
          COALESCE((SELECT SUM(t.amount)
                    FROM transactions t
                    LEFT JOIN loans l ON l.transaction_id = t.id
                    WHERE t.user_id = ?
                      AND t.type = 'income'
                      AND l.id IS NULL
                      AND YEAR(t.date) = ?
                      AND MONTH(t.date) = ?), 0) AS incomes,

          COALESCE((SELECT SUM(t.amount)
                    FROM transactions t
                    LEFT JOIN loan_payments lp ON lp.transaction_id = t.id
                    WHERE t.user_id = ?
                      AND t.type = 'expense'
                      AND lp.id IS NULL
                      AND YEAR(t.date) = ?
                      AND MONTH(t.date) = ?), 0) AS expenses,

          COALESCE((SELECT SUM(t.amount)
                    FROM transactions t
                    JOIN accounts a_to ON a_to.id = t.to_account_id
                    WHERE t.user_id = ?
                      AND t.type = 'transfer'
                      AND a_to.type = 'saving'
                      AND YEAR(t.date) = ?
                      AND MONTH(t.date) = ?), 0) AS savings,

          COALESCE((SELECT SUM(t.amount)
                    FROM transactions t
                    JOIN accounts a_from ON a_from.id = t.account_id
                    JOIN accounts a_to ON a_to.id = t.to_account_id
                    WHERE t.user_id = ?
                      AND t.type = 'transfer'
                      AND a_from.type = 'saving'
                      AND a_to.type <> 'saving'
                      AND YEAR(t.date) = ?
                      AND MONTH(t.date) = ?), 0) AS withdrawals,

          COALESCE((SELECT SUM(l.total_amount)
                    FROM loans l
                    WHERE l.user_id = ?
                      AND YEAR(l.start_date) = ?
                      AND MONTH(l.start_date) = ?), 0) AS loans,

          COALESCE((SELECT SUM(lp.principal_paid + lp.interest_paid)
                    FROM loan_payments lp
                    JOIN loans l ON l.id = lp.loan_id
                    WHERE l.user_id = ?
                      AND YEAR(lp.payment_date) = ?
                      AND MONTH(lp.payment_date) = ?), 0) AS payments,

          COALESCE((SELECT SUM(lp.principal_paid)
                    FROM loan_payments lp
                    JOIN loans l ON l.id = lp.loan_id
                    WHERE l.user_id = ?
                      AND YEAR(lp.payment_date) = ?
                      AND MONTH(lp.payment_date) = ?), 0) AS principal_breakdown,

          COALESCE((SELECT SUM(lp.interest_paid)
                    FROM loan_payments lp
                    JOIN loans l ON l.id = lp.loan_id
                    WHERE l.user_id = ?
                      AND YEAR(lp.payment_date) = ?
                      AND MONTH(lp.payment_date) = ?), 0) AS interest_breakdown
        `,
                [
                    user_id, year, month,
                    user_id, year, month,
                    user_id, year, month,
                    user_id, year, month,
                    user_id, year, month,
                    user_id, year, month,
                    user_id, year, month,
                    user_id, year, month
                ]
            )

            if (!kpiData?.length) return

            const record = kpiData[0]

            // =========================
            // Cálculos derivados
            // =========================
            const total_inflows = Number(record.incomes) + Number(record.loans)
            const total_outflows = Number(record.expenses) + Number(record.payments)
            const net_cash_flow = total_inflows - total_outflows
            const net_savings = Number(record.savings) - Number(record.withdrawals)
            const available_balance = net_cash_flow - net_savings

            // =========================
            // Persistencia en cache
            // =========================
            const repo = AppDataSource.getRepository(CacheKpiBalance)

            await repo.upsert({
                user: { id: user_id } as any,
                period_year: year,
                period_month: month,
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
            }, ['user', 'period_year', 'period_month'])

            logger.info(`KPIs recalculados user=${user_id} periodo=${month}/${year}`)

        } catch (err: any) {
            logger.error('Error recalculando KPIs', { error: err })
        }
    }
}