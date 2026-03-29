/* ============================
   Constantes globales
============================ */
const CARD_IDS = [
    'html-balance-kpi',
    'chart-data-last-6months-balance',
    'chart-data-last-6years-balance',
    'chart-data-last-6years-loan'
]

const CARD_STATE_KEY = `home.cards.state.${window.USER_ID}`
const CAROUSEL_POSITION_KEY = `home.carousel.position.${window.USER_ID}`
const KPI_YEAR_STATE_KEY = `home.kpi.year.${window.USER_ID}`

const KPI_CONFIG = [
    { key: 'incomes', label: 'Ingresos', color: 'green', trend: true },
    { key: 'expenses', label: 'Egresos', color: 'red', trend: true },
    { key: 'loans', label: 'Prestamos', color: 'green', trend: true },
    { key: 'payments', label: 'Pagos', color: 'red', trend: true },
    { key: 'savings', label: 'Ahorros', color: 'green', trend: true },
    { key: 'withdrawals', label: 'Retiros', color: 'red', trend: true },
    { key: 'total_inflows', label: 'Total Ingresos', color: 'green', trend: true },
    { key: 'total_outflows', label: 'Total Egresos', color: 'red', trend: true },
    { key: 'net_cash_flow', label: 'Neto', color: 'blue', trend: true },
    { key: 'net_savings', label: 'Ahorrado', color: 'blue', trend: true },
    { key: 'available_balance', label: 'Disponible', color: 'green', trend: true },
    { key: 'principal_breakdown', label: 'Desglose Capital', color: 'green', trend: true },
    { key: 'interest_breakdown', label: 'Desglose Interes', color: 'red', trend: true }
]

let varChartDataLast6MonthsBalance = null
let varChartDataLast6YearsBalance = null
let varChartDataLast6YearsLoan = null
let kpi_years = []
let kpi_year_index = 0

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
    // Inicializar el Html para KPIs
    renderKpiHtml()
    // Invocar desde el backend
    try {
        const res = await fetch('/kpis', { credentials: 'same-origin' })
        if (!res.ok) throw new Error('No autorizado')
        const { availableYearsKpi, balanceKpi, trendKpi, chartDataLast6MonthsBalance, chartDataLast6YearsBalance, chartDataLast6YearsLoan, } = await res.json()
        // Inicializar navegación año
        kpi_years = availableYearsKpi || [0]
        const savedYearRaw = loadFilters(KPI_YEAR_STATE_KEY)
        const savedYear = savedYearRaw !== null ? Number(savedYearRaw) : null
        kpi_year_index = kpi_years.includes(savedYear) ? kpi_years.indexOf(savedYear) : 0
        const current_year = kpi_years[kpi_year_index]

        updateKpiYearLabel(current_year)
        initYearNavigation()
        await changeYear()
        // Charts
        if (typeof Chart !== 'undefined') {
            const ctxMonths = document.getElementById('varChartDataLast6MonthsBalance').getContext('2d')
            varChartDataLast6MonthsBalance = new Chart(ctxMonths, {
                type: 'line',
                data: {
                    labels: chartDataLast6MonthsBalance.labels,
                    datasets: [
                        { label: 'Ingresos', data: chartDataLast6MonthsBalance.income, tension: 0.35 },
                        { label: 'Egresos', data: chartDataLast6MonthsBalance.expense, tension: 0.35 },
                        { label: 'Balance', data: chartDataLast6MonthsBalance.balance, borderDash: [6, 4], tension: 0.35 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false }
            })

            const ctxYears = document.getElementById('varChartDataLast6YearsBalance').getContext('2d')
            varChartDataLast6YearsBalance = new Chart(ctxYears, {
                type: 'line',
                data: {
                    labels: chartDataLast6YearsBalance.labels,
                    datasets: [
                        { label: 'Ingresos', data: chartDataLast6YearsBalance.income, tension: 0.35 },
                        { label: 'Egresos', data: chartDataLast6YearsBalance.expense, tension: 0.35 },
                        { label: 'Balance', data: chartDataLast6YearsBalance.balance, borderDash: [6, 4], tension: 0.35 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false }
            })

            const ctxLoans = document.getElementById('loansAnnualChart').getContext('2d')
            varChartDataLast6YearsLoan = new Chart(ctxLoans, {
                type: 'line',
                data: {
                    labels: chartDataLast6YearsLoan.labels,
                    datasets: [
                        { label: 'Total Prestado', data: chartDataLast6YearsLoan.total_loan, tension: 0.35 },
                        { label: 'Total Pagado', data: chartDataLast6YearsLoan.total_paid, tension: 0.35 },
                        { label: 'Intereses', data: chartDataLast6YearsLoan.total_interest, tension: 0.35 },
                        { label: 'Saldo', data: chartDataLast6YearsLoan.balance, borderDash: [6, 4], tension: 0.35 }
                    ]
                },
                options: { responsive: true, maintainAspectRatio: false }
            })
        }
        initHomeCarousel()
    } catch (err) {
        console.error('Error cargando dashboard', err)
    }
})

// Render KPIs HTML
function renderKpiHtml() {
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

// Render KPIs
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

// Year Navigation
function initYearNavigation() {
    const prevBtn = document.getElementById('html-balance-kpi-prev')
    const nextBtn = document.getElementById('html-balance-kpi-next')
    if (!prevBtn || !nextBtn) return
    prevBtn.addEventListener('click', async () => {
        if (kpi_year_index < kpi_years.length - 1) {
            kpi_year_index++
            await changeYear()
        }
    })
    nextBtn.addEventListener('click', async () => {
        if (kpi_year_index > 0) {
            kpi_year_index--
            await changeYear()
        }
    })
    updateYearButtons()
}

async function changeYear() {
    const year = kpi_years[kpi_year_index]
    saveFilters(KPI_YEAR_STATE_KEY, year)
    updateKpiYearLabel(year)
    updateYearButtons()
    const res = await fetch(`/kpis?year_period=${year}&month_period=0`, { credentials: 'same-origin' })
    if (!res.ok) return
    const { balanceKpi, trendKpi } = await res.json()
    renderKpis(year, balanceKpi, trendKpi)
}

function updateKpiYearLabel(year) {
    const label = document.getElementById('html-balance-kpi-year-label')
    if (!label) return
    label.textContent = year === 0 ? 'KPIs Balances - Todos' : `KPIs Balances - ${year}`
}

function updateYearButtons() {
    const prevBtn = document.getElementById('html-balance-kpi-prev')
    const nextBtn = document.getElementById('html-balance-kpi-next')
    if (!prevBtn || !nextBtn) return
    prevBtn.disabled = kpi_year_index >= kpi_years.length - 1
    nextBtn.disabled = kpi_year_index <= 0
}

// Toggle Cards
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
        if (id === 'chart-data-last-6months-balance' && varChartDataLast6MonthsBalance) varChartDataLast6MonthsBalance.resize()
        if (id === 'chart-data-last-6years-balance' && varChartDataLast6YearsBalance) varChartDataLast6YearsBalance.resize()
        if (id === 'chart-data-last-6years-loan' && varChartDataLast6YearsLoan) varChartDataLast6YearsLoan.resize()
    }
}

// Carousel
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