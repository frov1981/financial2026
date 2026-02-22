/* ============================
   Constantes globales
============================ */
const CARD_IDS = [
    'kpis-global-balance',
    'kpis-last-6months-balance',
    'chart-data-last-6months-balance',
    'chart-data-last-6years-balance',
    'chart-data-last-6years-loan'
]

const CARD_STATE_KEY = `home.cards.state.${window.USER_ID}`
const CAROUSEL_POSITION_KEY = `home.carousel.position.${window.USER_ID}`

let varChartDataLast6MonthsBalance = null
let varChartDataLast6YearsBalance = null
let varChartDataLast6YearsLoan = null

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

        const {
            kpisGlobalBalance,
            kpisLast6MonthsBalance,
            chartDataLast6MonthsBalance,
            chartDataLast6YearsBalance,
            chartDataLast6YearsLoan,
        } = await res.json()

        // ============================
        // KPIs Globales
        // ============================
        document.getElementById('kpis-global-balance-total-income').textContent = `${kpisGlobalBalance.totalIncome.toFixed(2)}`
        document.getElementById('kpis-global-balance-total-expense').textContent = `${kpisGlobalBalance.totalExpense.toFixed(2)}`
        document.getElementById('kpis-global-balance-total-savings').textContent = `${kpisGlobalBalance.totalSavings.toFixed(2)}`
        document.getElementById('kpis-global-balance-total-withdrawals').textContent = `${kpisGlobalBalance.totalWithdrawals.toFixed(2)}`
        document.getElementById('kpis-global-balance-net-worth').textContent = `${kpisGlobalBalance.netWorth.toFixed(2)}`
        document.getElementById('kpis-global-balance-available-savings').textContent = `${kpisGlobalBalance.availableSavings.toFixed(2)}`
        const netBalanceEl = document.getElementById('kpis-global-balance-net-balance')
        netBalanceEl.textContent = `${kpisGlobalBalance.netBalance.toFixed(2)}`
        netBalanceEl.classList.add(kpisGlobalBalance.netBalance >= 0 ? 'text-green-700' : 'text-red-700')
        // ============================
        // KPIs 6 Meses
        // ============================
        document.getElementById('kpi-last-6months-total-income').textContent = `${kpisLast6MonthsBalance.totalIncome.toFixed(2)}`
        document.getElementById('kpi-last-6months-total-expense').textContent = `${kpisLast6MonthsBalance.totalExpense.toFixed(2)}`
        const balanceEl = document.getElementById('kpi-last-6months-balance')
        balanceEl.textContent = `${kpisLast6MonthsBalance.balance.toFixed(2)}`
        balanceEl.classList.add(kpisLast6MonthsBalance.balance >= 0 ? 'text-green-700' : 'text-red-700')
        document.getElementById('kpi-last-6months-avg-expense').textContent = `${kpisLast6MonthsBalance.avgExpense.toFixed(2)}`
        const trendEl = document.getElementById('kpi-last-6months-trend')
        trendEl.textContent = kpisLast6MonthsBalance.trend >= 0 ? '▲' : '▼'
        trendEl.classList.add(kpisLast6MonthsBalance.trend >= 0 ? 'text-green-600' : 'text-red-600')

        // ============================
        // Chart 6 Meses
        // ============================
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
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', align: 'center', fullSize: true, labels: { boxWidth: 14, padding: 18 }, maxWidth: 1 } },
                    scales: { y: { beginAtZero: true } }
                }
            })
        }

        // ============================
        // Chart 6 Años
        // ============================
        if (typeof Chart !== 'undefined') {
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
            varChartDataLast6YearsLoan = new Chart(ctxLoans, {
                type: 'line',
                data: {
                    labels: chartDataLast6YearsLoan.labels,
                    datasets: [
                        { label: 'Total Prestado', data: chartDataLast6YearsLoan.totalLoan, tension: 0.35 },
                        { label: 'Total Pagado', data: chartDataLast6YearsLoan.totalPaid, tension: 0.35 },
                        { label: 'Intereses', data: chartDataLast6YearsLoan.totalInterest, tension: 0.35 },
                        { label: 'Saldo', data: chartDataLast6YearsLoan.balance, borderDash: [6, 4], tension: 0.35 }
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

        initHomeCarousel()

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
        if (id === 'chart-data-last-6months-balance' && varChartDataLast6MonthsBalance) varChartDataLast6MonthsBalance.resize()
        if (id === 'chart-data-last-6years-balance' && varChartDataLast6YearsBalance) varChartDataLast6YearsBalance.resize()
        if (id === 'chart-data-last-6years-loan' && varChartDataLast6YearsLoan) varChartDataLast6YearsLoan.resize()
    }
}

/* ============================
   Home Carousel Desktop Control
============================ */
function scrollCarouselNext() {
    const carousel = document.querySelector('.home-carousel')
    if (!carousel) return

    const slide = carousel.querySelector('.home-slide')
    if (!slide) return

    carousel.scrollBy({
        left: slide.offsetWidth,
        behavior: 'smooth'
    })
}

function scrollCarouselPrev() {
    const carousel = document.querySelector('.home-carousel')
    if (!carousel) return

    const slide = carousel.querySelector('.home-slide')
    if (!slide) return

    carousel.scrollBy({
        left: -slide.offsetWidth,
        behavior: 'smooth'
    })
}

function initHomeCarousel() {
    const carousel = document.querySelector('.home-carousel')
    if (!carousel) return

    const prevBtn = document.getElementById('carousel-prev')
    const nextBtn = document.getElementById('carousel-next')

    // ============================
    // Restaurar posición guardada
    // ============================
    const savedPosition = loadFilters(CAROUSEL_POSITION_KEY)

    if (savedPosition && typeof savedPosition.scrollLeft === 'number') {
        requestAnimationFrame(() => {
            carousel.scrollLeft = savedPosition.scrollLeft
        })
    }

    // ============================
    // Guardar posición al hacer scroll
    // ============================
    carousel.addEventListener('scroll', () => {
        saveFilters(CAROUSEL_POSITION_KEY, {
            scrollLeft: carousel.scrollLeft
        })
        updateCarouselButtons()
    })

    // ============================
    // Actualizar botones
    // ============================
    function updateCarouselButtons() {
        if (!prevBtn || !nextBtn) return

        const maxScrollLeft = carousel.scrollWidth - carousel.clientWidth

        prevBtn.disabled = carousel.scrollLeft <= 0
        nextBtn.disabled = carousel.scrollLeft >= maxScrollLeft - 1
    }

    // Inicializar estado
    updateCarouselButtons()

    window.addEventListener('resize', updateCarouselButtons)
}





