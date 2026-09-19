import { DateTime } from 'luxon'
import sharp from 'sharp'
import { AppDataSource } from '../config/typeorm.datasource'
import { getHomeCashFlowSummaryCache } from '../cache/cache-home.service'
import { Account } from '../entities/Account.entity'
import { AuthRequest } from '../types/auth-request'
import { User } from '../entities/User.entity'
import { AccountBalanceService } from './account-balance.service'
import { PayableBalanceService } from './payable-balance.service'
import { ReceivableBalanceService } from './receivable-balance.service'

export interface WeeklyBalanceMail {
  subject: string
  text: string
  html: string
  chart: Buffer
}

const weekly_balance_subject = 'App Contable - Resumen Semanal de Balances'
const subject_weekdays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const subject_months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

interface WeeklyBalanceSummary {
  user_name: string
  generated_at: string
  available_balance: number
  receivable_balance: number
  payable_balance: number
  net_balance: number
  accounts: Array<{
    name: string
    type: string
    balance: number
  }>
}

const escapeHtml = (value: string): string => {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return value.replace(/[&<>"']/g, character => entities[character])
}

const formatAmount = (amount: number): string => amount.toLocaleString('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const formatAccountType = (type: string): string => ({
  cash: 'Efectivo',
  bank: 'Banco',
  card: 'Tarjeta',
  saving: 'Ahorro',
}[type] || type)

const formatSubjectDate = (timezone: string): string => {
  const date = DateTime.now().setZone(timezone || 'UTC')
  return `${subject_weekdays[date.weekday - 1]} ${date.day}/${subject_months[date.month - 1]}/${date.year}`
}

const escapeXml = (value: string): string => escapeHtml(value)

const buildChartSvg = (labels: string[], datasets: Array<{ label: string, values: number[], color: string }>): string => {
  const width = 900
  const height = 420
  const padding = { top: 54, right: 32, bottom: 62, left: 72 }
  const chart_width = width - padding.left - padding.right
  const chart_height = height - padding.top - padding.bottom
  const values = datasets.reduce((all, dataset) => all.concat(dataset.values), [] as number[])
  const maximum = Math.max(...values, 0)
  const minimum = Math.min(...values, 0)
  const range = maximum - minimum || 1
  const x = (index: number) => padding.left + (labels.length <= 1 ? chart_width / 2 : index * chart_width / (labels.length - 1))
  const y = (value: number) => padding.top + (maximum - value) * chart_height / range
  const points = (values_for_dataset: number[]) => values_for_dataset.map((value, index) => `${x(index)},${y(value)}`).join(' ')
  const label_step = Math.max(1, Math.ceil(labels.length / 12))
  const grid_lines = [0, 0.25, 0.5, 0.75, 1].map(ratio => {
    const value = maximum - range * ratio
    const line_y = padding.top + chart_height * ratio
    return `<line x1="${padding.left}" y1="${line_y}" x2="${width - padding.right}" y2="${line_y}" stroke="#e5e7eb"/><text x="${padding.left - 10}" y="${line_y + 4}" text-anchor="end" font-size="12" fill="#6b7280">${escapeXml(formatAmount(value))}</text>`
  }).join('')
  const x_labels = labels.map((label, index) => index % label_step === 0
    ? `<text x="${x(index)}" y="${height - 28}" text-anchor="middle" font-size="12" fill="#6b7280">${escapeXml(label)}</text>`
    : '').join('')
  const legend = datasets.map((dataset, index) => {
    const legend_x = padding.left + index * 160
    return `<line x1="${legend_x}" y1="24" x2="${legend_x + 22}" y2="24" stroke="${dataset.color}" stroke-width="3"/><text x="${legend_x + 30}" y="28" font-size="13" fill="#374151">${escapeXml(dataset.label)}</text>`
  }).join('')
  const lines = datasets.map(dataset => `<polyline points="${points(dataset.values)}" fill="none" stroke="${dataset.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`).join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#ffffff"/>
    <text x="${padding.left}" y="20" font-family="Arial,sans-serif" font-size="16" font-weight="bold" fill="#1f2937">Flujo de balances - Todos</text>
    ${legend}
    ${grid_lines}
    ${lines}
    ${x_labels}
  </svg>`
}

const buildCashFlowChart = async (user: User): Promise<Buffer> => {
  const auth_req = {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      created_at: user.created_at,
    },
    query: { year_period_for_cash_summ: 0 },
  } as unknown as AuthRequest
  const summary = await getHomeCashFlowSummaryCache(auth_req)
  const svg = buildChartSvg(summary.labels, [
    { label: 'Ingresos', values: summary.total_inflows, color: '#16a34a' },
    { label: 'Egresos', values: summary.total_outflows, color: '#dc2626' },
    { label: 'Neto', values: summary.net_cash_flow, color: '#2563eb' },
  ])
  return sharp(Buffer.from(svg)).png().toBuffer()
}

const getSummary = async (user: User, timezone: string): Promise<WeeklyBalanceSummary> => {
  const account_repo = AppDataSource.getRepository(Account)
  const accounts = await account_repo.find({
    where: { user: { id: user.id }, is_active: true },
    order: { name: 'ASC' },
  })

  const available_balance = await AccountBalanceService.getNetAvailableBalance(user.id)
  const receivable_balance = await ReceivableBalanceService.getPendingReceivableBalance(user.id)
  const payable_balance = await PayableBalanceService.getPendingPayableBalance(user.id)
  const generated_at = DateTime.now().setZone(timezone || 'UTC').toFormat('dd/LL/yyyy HH:mm')

  return {
    user_name: user.name,
    generated_at,
    available_balance,
    receivable_balance,
    payable_balance,
    net_balance: available_balance + receivable_balance - payable_balance,
    accounts: accounts.map(account => ({
      name: account.name,
      type: formatAccountType(account.type),
      balance: Number(account.balance),
    })),
  }
}

const renderText = (summary: WeeklyBalanceSummary): string => {
  const account_lines = summary.accounts.length
    ? summary.accounts.map(account => `- ${account.name} (${account.type}): ${formatAmount(account.balance)}`).join('\n')
    : '- No hay cuentas activas.'

  return `Resumen semanal de balances

Hola ${summary.user_name},

Este es tu resumen de balances generado el ${summary.generated_at}.

BALANCE GENERAL
Disponible: ${formatAmount(summary.available_balance)}
Por cobrar: ${formatAmount(summary.receivable_balance)}
Por pagar: ${formatAmount(summary.payable_balance)}
Balance neto: ${formatAmount(summary.net_balance)}

CUENTAS ACTIVAS
${account_lines}

Este correo fue generado automáticamente por SSR Finan.`
}

const renderHtml = (summary: WeeklyBalanceSummary): string => {
  const account_rows = summary.accounts.length
    ? summary.accounts.map(account => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(account.name)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;">${escapeHtml(account.type)}</td>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatAmount(account.balance)}</td>
      </tr>`).join('')
    : '<tr><td colspan="3" style="padding:10px 12px;color:#6b7280;">No hay cuentas activas.</td></tr>'

  return `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f3f4f6;color:#1f2937;font-family:Arial,sans-serif;">
    <div style="max-width:620px;margin:0 auto;padding:28px 16px;">
      <div style="background:#2563eb;color:#ffffff;padding:20px 24px;">
        <h1 style="margin:0;font-size:22px;">${weekly_balance_subject}</h1>
      </div>
      <div style="background:#ffffff;padding:24px;">
        <p>Hola <strong>${escapeHtml(summary.user_name)}</strong>,</p>
        <p style="color:#6b7280;">Resumen generado el ${escapeHtml(summary.generated_at)}.</p>
        <h2 style="font-size:16px;margin:28px 0 12px;">Balances históricos</h2>
        <img src="cid:weekly-balances-chart" alt="Gráfico histórico de balances" style="display:block;width:100%;height:auto;">
        <h2 style="font-size:16px;margin:28px 0 12px;">Balance general</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;">Disponible</td><td style="padding:8px 0;text-align:right;font-weight:bold;">${formatAmount(summary.available_balance)}</td></tr>
          <tr><td style="padding:8px 0;">Por cobrar</td><td style="padding:8px 0;text-align:right;font-weight:bold;">${formatAmount(summary.receivable_balance)}</td></tr>
          <tr><td style="padding:8px 0;">Por pagar</td><td style="padding:8px 0;text-align:right;font-weight:bold;">${formatAmount(summary.payable_balance)}</td></tr>
          <tr><td style="padding:12px 0;border-top:2px solid #2563eb;font-weight:bold;">Balance neto</td><td style="padding:12px 0;border-top:2px solid #2563eb;text-align:right;font-weight:bold;color:#2563eb;">${formatAmount(summary.net_balance)}</td></tr>
        </table>
        <h2 style="font-size:16px;margin:28px 0 12px;">Cuentas activas</h2>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <thead><tr style="background:#f9fafb;text-align:left;"><th style="padding:10px 12px;">Cuenta</th><th style="padding:10px 12px;">Tipo</th><th style="padding:10px 12px;text-align:right;">Balance</th></tr></thead>
          <tbody>${account_rows}
          </tbody>
        </table>
        <p style="margin:28px 0 0;color:#6b7280;font-size:12px;">Este correo fue generado automáticamente por SSR Finan.</p>
      </div>
    </div>
  </body>
</html>`
}

export async function buildWeeklyBalanceMail(user: User, timezone = 'UTC'): Promise<WeeklyBalanceMail> {
  const summary = await getSummary(user, timezone)
  const chart = await buildCashFlowChart(user)

  return {
    subject: `${weekly_balance_subject} - ${formatSubjectDate(timezone)}`,
    text: renderText(summary),
    html: renderHtml(summary),
    chart,
  }
}