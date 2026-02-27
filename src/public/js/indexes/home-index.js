/* ============================
   Constantes globales
============================ */
const CARD_IDS = [
    'kpis-cache-balance',
    'chart-data-last-6months-balance',
    'chart-data-last-6years-balance',
    'chart-data-last-6years-loan'
]

const CARD_STATE_KEY = `home.cards.state.${window.USER_ID}`
const CAROUSEL_POSITION_KEY = `home.carousel.position.${window.USER_ID}`
const KPI_YEAR_STATE_KEY = `home.kpi.year.${window.USER_ID}`

let varChartDataLast6MonthsBalance = null
let varChartDataLast6YearsBalance = null
let varChartDataLast6YearsLoan = null

let kpi_years = []
let kpi_year_index = 0

/* ============================
   DOM Ready
============================ */
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

    const carousel_prev = document.getElementById('carousel-prev')
    const carousel_next = document.getElementById('carousel-next')
    if (carousel_prev) carousel_prev.innerHTML = iconCarouselPrev()
    if (carousel_next) carousel_next.innerHTML = iconCarouselNext()

    const kpi_prev = document.getElementById('kpis-cache-balance-prev')
    const kpi_next = document.getElementById('kpis-cache-balance-next')
    if (kpi_prev) kpi_prev.innerHTML = iconCarouselPrev()
    if (kpi_next) kpi_next.innerHTML = iconCarouselNext()

    try {

        const res = await fetch('/kpis', { credentials: 'same-origin' })
        if (!res.ok) throw new Error('No autorizado')

        const {
            kpisCacheBalance,
            chartDataLast6MonthsBalance,
            chartDataLast6YearsBalance,
            chartDataLast6YearsLoan,
            availableYears
        } = await res.json()

        /* ============================
           Inicializar navegación año
        ============================ */

        kpi_years = availableYears || [0]

        const savedYear = loadFilters(KPI_YEAR_STATE_KEY)
        kpi_year_index = kpi_years.indexOf(savedYear)
        if (kpi_year_index < 0) kpi_year_index = 0

        updateKpiYearLabel(kpi_years[kpi_year_index])
        renderKpis(kpisCacheBalance)

        initYearNavigation()

        /* ============================
           Charts
        ============================ */

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

/* ============================
   Render KPIs
============================ */
function renderKpis(data) {
    document.getElementById('kpis-cache-balance-incomes').textContent = data.incomes.toFixed(2)
    document.getElementById('kpis-cache-balance-expenses').textContent = data.expenses.toFixed(2)
    document.getElementById('kpis-cache-balance-loans').textContent = data.loans.toFixed(2)
    document.getElementById('kpis-cache-balance-payments').textContent = data.payments.toFixed(2)
    document.getElementById('kpis-cache-balance-savings').textContent = data.savings.toFixed(2)
    document.getElementById('kpis-cache-balance-withdrawals').textContent = data.withdrawals.toFixed(2)
    document.getElementById('kpis-cache-balance-total-inflows').textContent = data.total_inflows.toFixed(2)
    document.getElementById('kpis-cache-balance-total-outflows').textContent = data.total_outflows.toFixed(2)
    document.getElementById('kpis-cache-balance-net-cash-flow').textContent = data.net_cash_flow.toFixed(2)
    document.getElementById('kpis-cache-balance-net-savings').textContent = data.net_savings.toFixed(2)
    document.getElementById('kpis-cache-balance-available-balance').textContent = data.available_balance.toFixed(2)
    document.getElementById('kpis-cache-balance-principal-breakdown').textContent = data.principal_breakdown.toFixed(2)
    document.getElementById('kpis-cache-balance-interest-breakdown').textContent = data.interest_breakdown.toFixed(2)
}

/* ============================
   Year Navigation
============================ */
function initYearNavigation() {

    const prevBtn = document.getElementById('kpis-cache-balance-prev')
    const nextBtn = document.getElementById('kpis-cache-balance-next')

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

    const { kpisCacheBalance } = await res.json()
    renderKpis(kpisCacheBalance)
}

function updateKpiYearLabel(year) {
    const label = document.getElementById('kpis-cache-balance-year-label')
    if (!label) return
    label.textContent = year === 0 ? 'KPIs Balances - Todos' : `KPIs Balances - ${year}`
}

function updateYearButtons() {
    const prevBtn = document.getElementById('kpis-cache-balance-prev')
    const nextBtn = document.getElementById('kpis-cache-balance-next')
    if (!prevBtn || !nextBtn) return

    prevBtn.disabled = kpi_year_index >= kpi_years.length - 1
    nextBtn.disabled = kpi_year_index <= 0
}

/* ============================
   Toggle Cards
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

    if (!isOpen) {
        if (id === 'chart-data-last-6months-balance' && varChartDataLast6MonthsBalance) varChartDataLast6MonthsBalance.resize()
        if (id === 'chart-data-last-6years-balance' && varChartDataLast6YearsBalance) varChartDataLast6YearsBalance.resize()
        if (id === 'chart-data-last-6years-loan' && varChartDataLast6YearsLoan) varChartDataLast6YearsLoan.resize()
    }
}

/* ============================
   Carousel
============================ */
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