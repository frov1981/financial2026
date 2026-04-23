/* ============================
   Constantes globales
============================ */
const CARD_IDS = [
    'html-balance-kpi',
    'html-cash-flow-summary',
]

const KPI_CONFIG = [
    { key: 'available_balance', label: 'Disponible', color: 'green', trend: true },
    { key: 'net_savings', label: 'Ahorrado', color: 'blue', trend: true },
    { key: 'incomes', label: 'Ingresos', color: 'green', trend: true },
    { key: 'expenses', label: 'Egresos', color: 'red', trend: true },
    { key: 'loans', label: 'Prestamos', color: 'green', trend: true },
    { key: 'payments', label: 'Pagos', color: 'red', trend: true },
    { key: 'savings', label: 'Ahorros', color: 'green', trend: true },
    { key: 'withdrawals', label: 'Retiros', color: 'red', trend: true },
    { key: 'total_inflows', label: 'Total Ingresos', color: 'green', trend: true },
    { key: 'total_outflows', label: 'Total Egresos', color: 'red', trend: true },
    //{ key: 'principal_breakdown', label: 'Desglose Capital', color: 'green', trend: true },
    //{ key: 'interest_breakdown', label: 'Desglose Interes', color: 'red', trend: true },
    { key: 'net_cash_flow', label: 'Neto', color: 'blue', trend: true },
]

const CARD_STATE_KEY = `home.cards.state.${window.USER_ID}`
const CAROUSEL_POSITION_KEY = `home.carousel.position.${window.USER_ID}`
const KPI_YEAR_STATE_KEY = `home.kpi.year.${window.USER_ID}`
const CASH_FLOW_YEAR_STATE_KEY = `home.cash.flow.year.${window.USER_ID}`
const LOAN_FLOW_YEAR_STATE_KEY = `home.loan.flow.year.${window.USER_ID}`

let kpi_years = []
let kpi_year_index = 0
let cash_flow_year_index = 0
let cashFlowChart = null
let loan_flow_year_index = 0
let loanFlowChart = null

/* ============================
   DOM Ready
============================ */
document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar los Cards
    const savedState = loadFilters(CARD_STATE_KEY) || {}
    CARD_IDS.forEach(id => {
        const body = document.getElementById(id)
        const icon = document.getElementById(`icon-${id}`)
        if (!body || !icon) return
        const isOpen = savedState[id] ?? true
        body.classList.toggle('collapsed', !isOpen)
        icon.innerHTML = isOpen ? iconChevronClose() : iconChevronOpen()
    })
    const carousel_prev = document.getElementById('carousel-prev')
    const carousel_next = document.getElementById('carousel-next')
    if (carousel_prev) carousel_prev.innerHTML = iconCarouselPrev()
    if (carousel_next) carousel_next.innerHTML = iconCarouselNext()
    const kpi_prev = document.getElementById('html-balance-kpi-prev')
    const kpi_next = document.getElementById('html-balance-kpi-next')
    if (kpi_prev) kpi_prev.innerHTML = iconCarouselPrev()
    if (kpi_next) kpi_next.innerHTML = iconCarouselNext()
    const cash_prev = document.getElementById('html-cash-flow-summary-prev')
    const cash_next = document.getElementById('html-cash-flow-summary-next')
    if (cash_prev) cash_prev.innerHTML = iconCarouselPrev()
    if (cash_next) cash_next.innerHTML = iconCarouselNext()
    const loan_prev = document.getElementById('html-loan-flow-summary-prev')
    const loan_next = document.getElementById('html-loan-flow-summary-next')
    if (loan_prev) loan_prev.innerHTML = iconCarouselPrev()
    if (loan_next) loan_next.innerHTML = iconCarouselNext()

    // Inicializar el Html para KPIs
    renderBalanceKpiHtml()
    // Invocar desde el backend
    try {
        const res_kpi = await fetch('/kpis', { credentials: 'same-origin' })
        if (!res_kpi.ok) throw new Error('No autorizado')
        const { availableYearsKpi, } = await res_kpi.json()

        // Inicializar navegación año
        kpi_years = availableYearsKpi || [0]
        const savedYearRawKpi = loadFilters(KPI_YEAR_STATE_KEY)
        const savedYearRawCashFlow = loadFilters(CASH_FLOW_YEAR_STATE_KEY)
        const savedYearKpi = savedYearRawKpi !== null ? Number(savedYearRawKpi) : null
        const savedYearCashFlow = savedYearRawCashFlow !== null ? Number(savedYearRawCashFlow) : null
        kpi_year_index = kpi_years.includes(savedYearKpi) ? kpi_years.indexOf(savedYearKpi) : 0
        cash_flow_year_index = kpi_years.includes(savedYearCashFlow) ? kpi_years.indexOf(savedYearCashFlow) : 0
        const current_year_kpi = kpi_years[kpi_year_index]
        const current_year_cash_flow = kpi_years[cash_flow_year_index]

        const savedYearRawLoanFlow = loadFilters(LOAN_FLOW_YEAR_STATE_KEY)
        const savedYearLoanFlow = savedYearRawLoanFlow !== null ? Number(savedYearRawLoanFlow) : null
        loan_flow_year_index = kpi_years.includes(savedYearLoanFlow) ? kpi_years.indexOf(savedYearLoanFlow) : 0
        const current_year_loan_flow = kpi_years[loan_flow_year_index]

        updateLabelForBalanceKpi(current_year_kpi)
        initYearNavForBalanceKpi()
        await changeYearForBalanceKpi()

        updateLabelForCashFlowSumm(current_year_cash_flow)
        await changeYearForCashFlowSumm()
        initYearNavForCashFlowSumm()

        updateLabelForLoanFlowSumm(current_year_loan_flow)
        await changeYearForLoanFlowSumm()
        initYearNavForLoanFlowSumm()

        initHomeCarousel()
    } catch (err) {
        console.error('Error cargando dashboard', err)
    }
})

/* ============================
   KPI Balance Section
============================ */
function renderBalanceKpiHtml() {
    const container = document.getElementById('html-balance-kpi')
    let html = ''
    let chunk = []
    KPI_CONFIG.forEach((kpi, index) => {
        chunk.push(kpi)
        if (chunk.length === 6 || index === KPI_CONFIG.length - 1) {
            html += `<div class="ui-kpi-grid cols-6">`
            chunk.forEach(item => {
                const id = item.key.replace(/_/g, '-')
                html += `
                    <div class="ui-kpi-item">
                        <p class="ui-kpi-label">${item.label}</p>
                        ${item.trend
                        ? `
                        <div class="ui-kpi-row">
                            <div class="ui-kpi-values">
                                <p class="ui-kpi-value ui-kpi-${item.color}" id="html-balance-kpi-${id}">–</p>
                                <p class="ui-kpi-value ui-kpi-trend-${item.color}" id="html-trend-kpi-${item.key}">–</p>
                            </div>
                            <div class="ui-kpi-arrow" id="html-trend-kpi-arrow-${item.key}"></div>
                        </div>
                        `
                        : `
                        <p class="ui-kpi-value ui-kpi-${item.color}" id="html-balance-kpi-${id}">–</p>
                        `
                    }
                    </div>
                `
            })
            html += `</div>`
            chunk = []
        }
    })
    container.innerHTML = html
}

function renderKpis(year, balanceKpi, trendKpi) {
    const fields = ['incomes', 'expenses', 'loans', 'payments', 'savings', 'withdrawals', 'total_inflows', 'total_outflows', 'net_cash_flow', 'net_savings', 'available_balance', 'principal_breakdown', 'interest_breakdown']
    fields.forEach(field => {
        const el = document.getElementById(`html-balance-kpi-${field.replace(/_/g, '-')}`)
        if (el) el.textContent = (balanceKpi[field] ?? 0).toFixed(2)
    })
    KPI_CONFIG.forEach(({ key, trend }) => {
        if (!trend) return
        const el_trend = document.getElementById(`html-trend-kpi-${key}`)
        const el_arrow = document.getElementById(`html-trend-kpi-arrow-${key}`)
        if (!el_trend || !el_arrow) return
        if (year !== 0 && trendKpi?.trend?.[key]) {
            el_trend.style.display = 'block'
            el_arrow.style.display = 'block'
            el_trend.textContent = (trendKpi.previous?.[key] ?? 0).toFixed(2)
            el_arrow.innerHTML = trendKpi.trend[key].direction === 'up' ? iconTrendUp() : iconTrendDown()
        } else {
            el_trend.style.display = 'none'
            el_arrow.style.display = 'none'
        }
    })
}

function initYearNavForBalanceKpi() {
    const prevBtn = document.getElementById('html-balance-kpi-prev')
    const nextBtn = document.getElementById('html-balance-kpi-next')
    if (!prevBtn || !nextBtn) return
    prevBtn.addEventListener('click', async () => {
        if (kpi_year_index < kpi_years.length - 1) {
            kpi_year_index++
            await changeYearForBalanceKpi()
        }
    })
    nextBtn.addEventListener('click', async () => {
        if (kpi_year_index > 0) {
            kpi_year_index--
            await changeYearForBalanceKpi()
        }
    })
    updateYearNavForBalanceKpi()
}

async function changeYearForBalanceKpi() {
    const year = kpi_years[kpi_year_index]
    saveFilters(KPI_YEAR_STATE_KEY, year)
    updateLabelForBalanceKpi(year)
    updateYearNavForBalanceKpi()
    const res = await fetch(`/kpis?year_period_for_kpi=${year}&month_period_for_kpi=0`, { credentials: 'same-origin' })
    if (!res.ok) return
    const { balanceKpi, trendKpi } = await res.json()
    renderKpis(year, balanceKpi, trendKpi)
}

function updateLabelForBalanceKpi(year) {
    const label = document.getElementById('html-balance-kpi-year-label')
    if (!label) return
    label.textContent = year === 0 ? 'KPIs Balances - Todos' : `KPIs Balances - ${year}`
}

function updateYearNavForBalanceKpi() {
    const prevBtn = document.getElementById('html-balance-kpi-prev')
    const nextBtn = document.getElementById('html-balance-kpi-next')
    if (!prevBtn || !nextBtn) return
    prevBtn.disabled = kpi_year_index >= kpi_years.length - 1
    nextBtn.disabled = kpi_year_index <= 0
}

/* ============================
   Cash Flow Summary Section
============================ */
function renderCashFlowSummChart(data) {
    const ctx = document.getElementById('cashFlowChart').getContext('2d')

    if (cashFlowChart) cashFlowChart.destroy()

    cashFlowChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                { label: 'Ingresos', data: data.total_inflows, tension: 0.35 },
                { label: 'Egresos', data: data.total_outflows, tension: 0.35 },
                { label: 'Neto', data: data.net_cash_flow, borderDash: [6, 4], tension: 0.35 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    })
}

function renderLoanFlowSummChart(data) {
    const ctx = document.getElementById('loanFlowChart').getContext('2d')

    if (loanFlowChart) loanFlowChart.destroy()

    loanFlowChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                { label: 'Préstamos', data: data.total_loans, tension: 0.35 },
                { label: 'Pagos', data: data.total_payments, tension: 0.35 },
                { label: 'Balance', data: data.net_balance, borderDash: [6, 4], tension: 0.35 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    })
}

async function changeYearForCashFlowSumm() {
    const year = kpi_years[cash_flow_year_index]

    saveFilters(CASH_FLOW_YEAR_STATE_KEY, year)
    updateLabelForCashFlowSumm(year)
    updateYearNavForCashFlowSumm()

    const res = await fetch(`/cash-summary?year_period_for_cash_summ=${year}`, { credentials: 'same-origin' })
    if (!res.ok) return

    const { cashSummary } = await res.json()

    renderCashFlowSummChart(cashSummary)
}

async function changeYearForLoanFlowSumm() {
    const year = kpi_years[loan_flow_year_index]

    saveFilters(LOAN_FLOW_YEAR_STATE_KEY, year)
    updateLabelForLoanFlowSumm(year)
    updateYearNavForLoanFlowSumm()

    const res = await fetch(`/loan-summary?year_period_for_loan_summ=${year}`, { credentials: 'same-origin' })
    if (!res.ok) return

    const { loanSummary } = await res.json()

    renderLoanFlowSummChart(loanSummary)
}

function initYearNavForCashFlowSumm() {
    const prevBtn = document.getElementById('html-cash-flow-summary-prev')
    const nextBtn = document.getElementById('html-cash-flow-summary-next')

    if (!prevBtn || !nextBtn) return

    prevBtn.addEventListener('click', async () => {
        if (cash_flow_year_index < kpi_years.length - 1) {
            cash_flow_year_index++
            await changeYearForCashFlowSumm()
        }
    })

    nextBtn.addEventListener('click', async () => {
        if (cash_flow_year_index > 0) {
            cash_flow_year_index--
            await changeYearForCashFlowSumm()
        }
    })

    updateYearNavForCashFlowSumm()
}

function initYearNavForLoanFlowSumm() {
    const prevBtn = document.getElementById('html-loan-flow-summary-prev')
    const nextBtn = document.getElementById('html-loan-flow-summary-next')

    if (!prevBtn || !nextBtn) return

    prevBtn.addEventListener('click', async () => {
        if (loan_flow_year_index < kpi_years.length - 1) {
            loan_flow_year_index++
            await changeYearForLoanFlowSumm()
        }
    })

    nextBtn.addEventListener('click', async () => {
        if (loan_flow_year_index > 0) {
            loan_flow_year_index--
            await changeYearForLoanFlowSumm()
        }
    })

    updateYearNavForLoanFlowSumm()
}

function updateLabelForCashFlowSumm(year) {
    const label = document.getElementById('html-cash-flow-summary-year-label')
    if (!label) return

    label.textContent = year === 0 ? 'Trend Balances - Todos' : `Trend Balances - ${year}`
}

function updateLabelForLoanFlowSumm(year) {
    const label = document.getElementById('html-loan-flow-summary-year-label')
    if (!label) return

    label.textContent =
        year === 0
            ? 'Trend Préstamos - Todos'
            : `Trend Préstamos - ${year}`
}

function updateYearNavForCashFlowSumm() {
    const prevBtn = document.getElementById('html-cash-flow-summary-prev')
    const nextBtn = document.getElementById('html-cash-flow-summary-next')

    if (!prevBtn || !nextBtn) return

    prevBtn.disabled = cash_flow_year_index >= kpi_years.length - 1
    nextBtn.disabled = cash_flow_year_index <= 0
}

function updateYearNavForLoanFlowSumm() {
    const prevBtn = document.getElementById('html-loan-flow-summary-prev')
    const nextBtn = document.getElementById('html-loan-flow-summary-next')

    if (!prevBtn || !nextBtn) return

    prevBtn.disabled = loan_flow_year_index >= kpi_years.length - 1
    nextBtn.disabled = loan_flow_year_index <= 0
}

/* ============================
   Carousel Event Section
============================ */
function toggleCard(id) {
    const body = document.getElementById(id)
    const icon = document.getElementById(`icon-${id}`)
    const isOpen = !body.classList.contains('collapsed')
    body.classList.toggle('collapsed', isOpen)
    icon.innerHTML = isOpen ? iconChevronOpen() : iconChevronClose()
    const state = loadFilters(CARD_STATE_KEY) || {}
    state[id] = !isOpen
    saveFilters(CARD_STATE_KEY, state)
}

function initHomeCarousel() {
    const carousel = document.querySelector('.home-carousel')
    if (!carousel) return
    const prevBtn = document.getElementById('carousel-prev')
    const nextBtn = document.getElementById('carousel-next')
    const savedPosition = loadFilters(CAROUSEL_POSITION_KEY)
    if (savedPosition && typeof savedPosition.scrollLeft === 'number') {
        requestAnimationFrame(() => {
            carousel.scrollLeft = savedPosition.scrollLeft
        })
    }
    carousel.addEventListener('scroll', () => {
        saveFilters(CAROUSEL_POSITION_KEY, {
            scrollLeft: carousel.scrollLeft
        })
        updateCarouselButtons()
    })

    function updateCarouselButtons() {
        if (!prevBtn || !nextBtn) return
        const maxScrollLeft = carousel.scrollWidth - carousel.clientWidth
        prevBtn.disabled = carousel.scrollLeft <= 0
        nextBtn.disabled = carousel.scrollLeft >= maxScrollLeft - 1
    }

    updateCarouselButtons()
    window.addEventListener('resize', updateCarouselButtons)
}

function scrollCarouselNext() {
    const carousel = document.querySelector('.home-carousel')
    if (!carousel) return
    carousel.scrollBy({ left: carousel.clientWidth * 0.8, behavior: 'smooth' })
}

function scrollCarouselPrev() {
    const carousel = document.querySelector('.home-carousel')
    if (!carousel) return
    carousel.scrollBy({ left: -carousel.clientWidth * 0.8, behavior: 'smooth' })
}
