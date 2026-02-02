/* ============================
   Constantes globales
============================ */
const CARD_IDS = [
    'global-kpis',
    'six-kpis',
    'chart-six',
    'chart-years',
    'chart-loans'
]

const CARD_STATE_KEY = `home.cards.state.${window.USER_ID}`
let lastSixMonthsChart = null
let lastSixYearsChart = null
let lastLoansChart = null

document.addEventListener('DOMContentLoaded', async () => {
    const savedState = loadFilters(CARD_STATE_KEY) || {}

    CARD_IDS.forEach(id => {
        const body = document.getElementById(id)
        const icon = document.getElementById(`icon-${id}`)
        if (!body || !icon) return

        const isOpen = savedState[id] ?? true

        body.classList.toggle('collapsed', !isOpen)
        icon.innerHTML = isOpen ? iconChevronClose() : iconChevronOpen()
    })

    try {
        const res = await fetch('/kpis', { credentials: 'same-origin' })
        if (!res.ok) throw new Error('No autorizado')

        const { kpis, lastSixMonthsChartData, lastSixYearsChartData, lastSixYearLoanChartData, globalKpis } = await res.json()

        // ============================
        // KPIs Globales
        // ============================
        document.getElementById('kpi-total-income').textContent = `$${globalKpis.totalIncome.toFixed(2)}`
        document.getElementById('kpi-total-expense').textContent = `$${globalKpis.totalExpense.toFixed(2)}`
        document.getElementById('kpi-total-savings').textContent = `$${globalKpis.totalSavings.toFixed(2)}`
        document.getElementById('kpi-total-withdrawals').textContent = `$${globalKpis.totalWithdrawals.toFixed(2)}`
        document.getElementById('kpi-net-worth').textContent = `$${globalKpis.netWorth.toFixed(2)}`
        document.getElementById('kpi-available-savings').textContent = `$${globalKpis.availableSavings.toFixed(2)}`

        const netBalanceEl = document.getElementById('kpi-net-balance')
        netBalanceEl.textContent = `$${globalKpis.netBalance.toFixed(2)}`
        netBalanceEl.classList.add(globalKpis.netBalance >= 0 ? 'text-green-700' : 'text-red-700')

        // ============================
        // KPIs 6 Meses
        // ============================
        document.getElementById('kpi-income').textContent = `$${kpis.totalIncome.toFixed(2)}`
        document.getElementById('kpi-expense').textContent = `$${kpis.totalExpense.toFixed(2)}`
        const balanceEl = document.getElementById('kpi-balance')
        balanceEl.textContent = `$${kpis.balance.toFixed(2)}`
        balanceEl.classList.add(kpis.balance >= 0 ? 'text-green-700' : 'text-red-700')
        document.getElementById('kpi-avg-expense').textContent = `$${kpis.avgExpense.toFixed(2)}`

        const trendEl = document.getElementById('kpi-trend')
        trendEl.textContent = kpis.trend >= 0 ? '▲' : '▼'
        trendEl.classList.add(kpis.trend >= 0 ? 'text-green-600' : 'text-red-600')

        // ============================
        // Chart 6 Meses
        // ============================
        if (typeof Chart !== 'undefined') {
            const ctxMonths = document.getElementById('lastSixMonthsChart').getContext('2d')
            lastSixMonthsChart = new Chart(ctxMonths, {
                type: 'line',
                data: {
                    labels: lastSixMonthsChartData.labels,
                    datasets: [
                        { label: 'Ingresos', data: lastSixMonthsChartData.income, tension: 0.35 },
                        { label: 'Egresos', data: lastSixMonthsChartData.expense, tension: 0.35 },
                        { label: 'Balance', data: lastSixMonthsChartData.balance, borderDash: [6, 4], tension: 0.35 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: { y: { beginAtZero: true } }
                }
            })
        }

        // ============================
        // Chart 6 Años
        // ============================
        if (typeof Chart !== 'undefined') {
            const ctxYears = document.getElementById('lastSixYearsChart').getContext('2d')
            lastSixYearsChart = new Chart(ctxYears, {
                type: 'line',
                data: {
                    labels: lastSixYearsChartData.labels,
                    datasets: [
                        { label: 'Ingresos', data: lastSixYearsChartData.income, tension: 0.35 },
                        { label: 'Egresos', data: lastSixYearsChartData.expense, tension: 0.35 },
                        { label: 'Balance', data: lastSixYearsChartData.balance, borderDash: [6, 4], tension: 0.35 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: { y: { beginAtZero: true } }
                }
            })
        }

        // ============================
        // Chart Préstamos 6 Años
        // ============================
        if (typeof Chart !== 'undefined') {
            const ctxLoans = document.getElementById('loansAnnualChart').getContext('2d')
            lastLoansChart = new Chart(ctxLoans, {
                type: 'line',
                data: {
                    labels: lastSixYearLoanChartData.labels,
                    datasets: [
                        { label: 'Total Prestado', data: lastSixYearLoanChartData.totalLoan, tension: 0.35 },
                        { label: 'Total Pagado', data: lastSixYearLoanChartData.totalPaid, tension: 0.35 },
                        { label: 'Intereses', data: lastSixYearLoanChartData.totalInterest, tension: 0.35 },
                        { label: 'Saldo', data: lastSixYearLoanChartData.balance, borderDash: [6, 4], tension: 0.35 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: { y: { beginAtZero: true } }
                }
            })
        }

    } catch (err) {
        console.error('Error cargando dashboard', err)
    }
})

// ============================
// Toggle Cards
// ============================
function toggleCard(id) {
    const body = document.getElementById(id)
    const icon = document.getElementById(`icon-${id}`)
    const isOpen = !body.classList.contains('collapsed')
    body.classList.toggle('collapsed', isOpen)
    icon.innerHTML = isOpen ? iconChevronOpen() : iconChevronClose()
    const state = loadFilters(CARD_STATE_KEY) || {}
    state[id] = !isOpen
    saveFilters(CARD_STATE_KEY, state)

    if (!isOpen) {
        if (id === 'chart-six' && lastSixMonthsChart) lastSixMonthsChart.resize()
        if (id === 'chart-years' && lastSixYearsChart) lastSixYearsChart.resize()
        if (id === 'chart-loans' && lastLoansChart) lastLoansChart.resize()
    }
}

