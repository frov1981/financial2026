/* ============================
   Constantes globales
============================ */
const CARD_IDS = [
    'html-category-kpi',
    'html-balance-kpi',
    'html-cash-flow-summary',
    'html-payable-flow-summary',
    'html-receivable-flow-summary',
]

const KPI_CONFIG = [
    { key: 'available_balance', label: 'Disponible', color: 'green', trend: true },
    { key: 'net_savings', label: 'Ahorrado', color: 'blue', trend: true },
    { key: 'incomes', label: 'Ingresos', color: 'green', trend: true },
    { key: 'expenses', label: 'Egresos', color: 'red', trend: true },
    { key: 'payables', label: 'Cuentas por Pagar', color: 'green', trend: true },
    { key: 'payable_payments', label: 'Pagos', color: 'red', trend: true },
    { key: 'receivables', label: 'Cuentas por Cobrar', color: 'red', trend: true },
    { key: 'receivable_collections', label: 'Cobros', color: 'green', trend: true },
    { key: 'savings', label: 'Ahorros', color: 'green', trend: true },
    { key: 'withdrawals', label: 'Retiros', color: 'red', trend: true },
    { key: 'total_inflows', label: 'Total Ingresos', color: 'green', trend: true },
    { key: 'total_outflows', label: 'Total Egresos', color: 'red', trend: true },
    { key: 'net_cash_flow', label: 'Neto', color: 'blue', trend: true },
]

const CARD_STATE_KEY = `home.cards.state.${window.USER_ID}`
const CAROUSEL_POSITION_KEY = `home.carousel.position.${window.USER_ID}`
const KPI_YEAR_STATE_KEY = `home.kpi.year.${window.USER_ID}`
const CASH_FLOW_YEAR_STATE_KEY = `home.cash.flow.year.${window.USER_ID}`
const PAYABLE_FLOW_YEAR_STATE_KEY = `home.payable.flow.year.${window.USER_ID}`
const RECEIVABLE_FLOW_YEAR_STATE_KEY = `home.receivable.flow.year.${window.USER_ID}`
const CATEGORY_KPI_YEAR_STATE_KEY = `home.category.year.${window.USER_ID}`
const CATEGORY_TABLE_SCROLL_KEY = `home.category.table.scroll.${window.USER_ID}`
const CATEGORY_SORT_KEY = `home.category.sort.${window.USER_ID}`
const CATEGORY_GROUP_KPI_YEAR_STATE_KEY = `home.category.group.year.${window.USER_ID}`
const CATEGORY_GROUP_TABLE_SCROLL_KEY = `home.category.group.table.scroll.${window.USER_ID}`
const CATEGORY_GROUP_SORT_KEY = `home.category.group.sort.${window.USER_ID}`

const labelForKpi = 'KPIs'
const labelForTrendBalance = 'Balances'
const labelForTrendPayable = 'Por Pagar'
const labelForTrendReceivable = 'Por Cobrar'

let kpi_years = []
let kpi_year_index = 0
let cash_flow_year_index = 0
let cashFlowChart = null
let payable_flow_year_index = 0
let payableFlowChart = null
let receivable_flow_year_index = 0
let receivableFlowChart = null
let category_year_index = 0
let lastCategoryRows = []
let categoryKpiDetailChart = null
let category_group_year_index = 0
let lastCategoryGroupRows = []
let categoryGroupKpiDetailChart = null

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

    const kpi_prev = document.getElementById('html-balance-kpi-prev')
    const kpi_next = document.getElementById('html-balance-kpi-next')
    if (kpi_prev) kpi_prev.innerHTML = iconCarouselPrev()
    if (kpi_next) kpi_next.innerHTML = iconCarouselNext()

    const category_prev = document.getElementById('html-category-kpi-prev')
    const category_next = document.getElementById('html-category-kpi-next')
    if (category_prev) category_prev.innerHTML = iconCarouselPrev()
    if (category_next) category_next.innerHTML = iconCarouselNext()

    const category_group_prev = document.getElementById('html-category-group-kpi-prev')
    const category_group_next = document.getElementById('html-category-group-kpi-next')
    if (category_group_prev) category_group_prev.innerHTML = iconCarouselPrev()
    if (category_group_next) category_group_next.innerHTML = iconCarouselNext()

    const cash_prev = document.getElementById('html-cash-flow-summary-prev')
    const cash_next = document.getElementById('html-cash-flow-summary-next')
    if (cash_prev) cash_prev.innerHTML = iconCarouselPrev()
    if (cash_next) cash_next.innerHTML = iconCarouselNext()

    const payable_prev = document.getElementById('html-payable-flow-summary-prev')
    const payable_next = document.getElementById('html-payable-flow-summary-next')
    if (payable_prev) payable_prev.innerHTML = iconCarouselPrev()
    if (payable_next) payable_next.innerHTML = iconCarouselNext()

    const receivable_prev = document.getElementById('html-receivable-flow-summary-prev')
    const receivable_next = document.getElementById('html-receivable-flow-summary-next')
    if (receivable_prev) receivable_prev.innerHTML = iconCarouselPrev()
    if (receivable_next) receivable_next.innerHTML = iconCarouselNext()

    // Inicializar el Html para KPIs
    renderBalanceKpiHtml()
    updateLabelForBalanceKpi(0)
    updateLabelForCashFlowSumm(0)
    updateLabelForPayableFlowSumm(0)
    updateLabelForReceivableFlowSumm(0)

    try {
        const res_kpi = await fetch('/kpis', { credentials: 'same-origin' })
        if (!res_kpi.ok) throw new Error('No autorizado')
        const { availableYearsKpi, } = await res_kpi.json()

        kpi_years = availableYearsKpi || [0]
        const savedYearRawKpi = loadFilters(KPI_YEAR_STATE_KEY)
        const savedYearRawCashFlow = loadFilters(CASH_FLOW_YEAR_STATE_KEY)
        const savedYearKpi = savedYearRawKpi !== null ? Number(savedYearRawKpi) : null
        const savedYearCashFlow = savedYearRawCashFlow !== null ? Number(savedYearRawCashFlow) : null
        const savedYearRawCategory = loadFilters(CATEGORY_KPI_YEAR_STATE_KEY)
        const savedYearCategory = savedYearRawCategory !== null ? Number(savedYearRawCategory) : null
        const savedYearRawCategoryGroup = loadFilters(CATEGORY_GROUP_KPI_YEAR_STATE_KEY)
        const savedYearCategoryGroup = savedYearRawCategoryGroup !== null ? Number(savedYearRawCategoryGroup) : null

        kpi_year_index = kpi_years.includes(savedYearKpi) ? kpi_years.indexOf(savedYearKpi) : 0
        cash_flow_year_index = kpi_years.includes(savedYearCashFlow) ? kpi_years.indexOf(savedYearCashFlow) : 0
        category_year_index = kpi_years.includes(savedYearCategory) ? kpi_years.indexOf(savedYearCategory) : 0
        category_group_year_index = kpi_years.includes(savedYearCategoryGroup) ? kpi_years.indexOf(savedYearCategoryGroup) : 0
        const current_year_kpi = kpi_years[kpi_year_index]
        const current_year_cash_flow = kpi_years[cash_flow_year_index]
        const current_year_category = kpi_years[category_year_index]
        const current_year_category_group = kpi_years[category_group_year_index]

        const savedYearRawPayableFlow = loadFilters(PAYABLE_FLOW_YEAR_STATE_KEY)
        const savedYearPayableFlow = savedYearRawPayableFlow !== null ? Number(savedYearRawPayableFlow) : null
        payable_flow_year_index = kpi_years.includes(savedYearPayableFlow) ? kpi_years.indexOf(savedYearPayableFlow) : 0
        const current_year_payable_flow = kpi_years[payable_flow_year_index]

        const savedYearRawReceivableFlow = loadFilters(RECEIVABLE_FLOW_YEAR_STATE_KEY)
        const savedYearReceivableFlow = savedYearRawReceivableFlow !== null ? Number(savedYearRawReceivableFlow) : null
        receivable_flow_year_index = kpi_years.includes(savedYearReceivableFlow) ? kpi_years.indexOf(savedYearReceivableFlow) : 0
        const current_year_receivable_flow = kpi_years[receivable_flow_year_index]

        updateLabelForBalanceKpi(current_year_kpi)
        initYearNavForBalanceKpi()
        await changeYearForBalanceKpi()

        updateLabelForCategory(current_year_category)
        initYearNavForCategory()
        await changeYearForCategory()

        updateLabelForCategoryGroup(current_year_category_group)
        initYearNavForCategoryGroup()
        await changeYearForCategoryGroup()

        updateLabelForCashFlowSumm(current_year_cash_flow)
        await changeYearForCashFlowSumm()
        initYearNavForCashFlowSumm()

        updateLabelForPayableFlowSumm(current_year_payable_flow)
        await changeYearForPayableFlowSumm()
        initYearNavForPayableFlowSumm()

        updateLabelForReceivableFlowSumm(current_year_receivable_flow)
        await changeYearForReceivableFlowSumm()
        initYearNavForReceivableFlowSumm()

        initHomeCarousel()
        adjustCategoryTableHeight()
        adjustCategoryGroupTableHeight()

        window.addEventListener('resize', adjustCategoryTableHeight)
        window.addEventListener('resize', adjustCategoryGroupTableHeight)
    } catch (err) {
        console.error('Error cargando dashboard', err)
    }
})

function adjustCategoryTableHeight() {
    const carousel = document.querySelector('.home-carousel')
    const wrapper = document.getElementById('html-category-kpi-body')
    const slide = wrapper ? wrapper.closest('.home-slide') : null
    if (!wrapper) return

    const carouselH = carousel ? carousel.clientHeight : (slide ? slide.clientHeight : window.APP_VIEWPORT_HEIGHT)

    let headerH = 0
    if (slide) {
        const hdr = slide.querySelector('.ui-card-header')
        headerH = hdr ? hdr.offsetHeight : 0
    }

    const portion = 0.6 // 60% of carousel height
    let desired = Math.floor(carouselH * portion) - headerH
    const MIN = 140
    const MAX = Math.floor(window.APP_VIEWPORT_HEIGHT * 0.8)
    if (desired < MIN) desired = MIN
    if (desired > MAX) desired = MAX

    wrapper.style.height = desired + 'px'
}

function adjustCategoryGroupTableHeight() {
    const carousel = document.querySelector('.home-carousel')
    const wrapper = document.getElementById('html-category-group-kpi-body')
    const slide = wrapper ? wrapper.closest('.home-slide') : null
    if (!wrapper) return

    const carouselH = carousel ? carousel.clientHeight : (slide ? slide.clientHeight : window.APP_VIEWPORT_HEIGHT)
    const header = slide?.querySelector('.ui-card-header')
    let desired = Math.floor(carouselH * 0.6) - (header ? header.offsetHeight : 0)
    const min = 140
    const max = Math.floor(window.APP_VIEWPORT_HEIGHT * 0.8)
    if (desired < min) desired = min
    if (desired > max) desired = max
    wrapper.style.height = desired + 'px'
}

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
    const fields = [
        'incomes',
        'expenses',
        'payables',
        'payable_payments',
        'receivables',
        'receivable_collections',
        'savings', 'withdrawals',
        'total_inflows',
        'total_outflows',
        'net_cash_flow',
        'net_savings',
        'available_balance',
        'principal_breakdown',
        'interest_breakdown'
    ]
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

function renderReceivableFlowSummChart(data) {
    const ctx = document.getElementById('receivableFlowChart').getContext('2d')
    if (receivableFlowChart) receivableFlowChart.destroy()
    receivableFlowChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                { label: 'Por Cobrar', data: data.total_receivables, tension: 0.35 },
                { label: 'Cobros', data: data.total_receivable_collections, tension: 0.35 },
                { label: 'Balances', data: data.net_balance, borderDash: [6, 4], tension: 0.35 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
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
    label.textContent = year === 0 ? `${labelForKpi} - Todos` : `${labelForKpi} - ${year}`
}

function updateYearNavForBalanceKpi() {
    const prevBtn = document.getElementById('html-balance-kpi-prev')
    const nextBtn = document.getElementById('html-balance-kpi-next')
    if (!prevBtn || !nextBtn) return
    prevBtn.disabled = kpi_year_index >= kpi_years.length - 1
    nextBtn.disabled = kpi_year_index <= 0
}

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

function renderPayableFlowSummChart(data) {
    const ctx = document.getElementById('payableFlowChart').getContext('2d')

    if (payableFlowChart) payableFlowChart.destroy()
    payableFlowChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [
                { label: 'Por Pagar', data: data.total_payables, tension: 0.35 },
                { label: 'Pagos', data: data.total_payable_payments, tension: 0.35 },
                { label: 'Balances', data: data.net_payable_balance, borderDash: [6, 4], tension: 0.35 }
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

async function changeYearForPayableFlowSumm() {
    const year = kpi_years[payable_flow_year_index]

    saveFilters(PAYABLE_FLOW_YEAR_STATE_KEY, year)
    updateLabelForPayableFlowSumm(year)
    updateYearNavForPayableFlowSumm()

    const res = await fetch(`/payable-summary?year_period_for_payable_summ=${year}`, { credentials: 'same-origin' })
    if (!res.ok) return

    const { payableSummary } = await res.json()
    renderPayableFlowSummChart(payableSummary)
}

async function changeYearForReceivableFlowSumm() {
    const year = kpi_years[receivable_flow_year_index]

    saveFilters(RECEIVABLE_FLOW_YEAR_STATE_KEY, year)
    updateLabelForReceivableFlowSumm(year)
    updateYearNavForReceivableFlowSumm()

    const res = await fetch(`/receivable-summary?year_period_for_payable_summ=${year}`, { credentials: 'same-origin' })
    if (!res.ok) return

    const { receivableSummary } = await res.json()
    renderReceivableFlowSummChart(receivableSummary)
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

function initYearNavForPayableFlowSumm() {
    const prevBtn = document.getElementById('html-payable-flow-summary-prev')
    const nextBtn = document.getElementById('html-payable-flow-summary-next')

    if (!prevBtn || !nextBtn) return

    prevBtn.addEventListener('click', async () => {
        if (payable_flow_year_index < kpi_years.length - 1) {
            payable_flow_year_index++
            await changeYearForPayableFlowSumm()
        }
    })

    nextBtn.addEventListener('click', async () => {
        if (payable_flow_year_index > 0) {
            payable_flow_year_index--
            await changeYearForPayableFlowSumm()
        }
    })

    updateYearNavForPayableFlowSumm()
}

function initYearNavForReceivableFlowSumm() {
    const prevBtn = document.getElementById('html-receivable-flow-summary-prev')
    const nextBtn = document.getElementById('html-receivable-flow-summary-next')

    if (!prevBtn || !nextBtn) return

    prevBtn.addEventListener('click', async () => {
        if (receivable_flow_year_index < kpi_years.length - 1) {
            receivable_flow_year_index++
            await changeYearForReceivableFlowSumm()
        }
    })

    nextBtn.addEventListener('click', async () => {
        if (receivable_flow_year_index > 0) {
            receivable_flow_year_index--
            await changeYearForReceivableFlowSumm()
        }
    })

    updateYearNavForReceivableFlowSumm()
}

function updateLabelForCashFlowSumm(year) {
    const label = document.getElementById('html-cash-flow-summary-year-label')
    if (!label) return
    label.textContent = year === 0 ? `${labelForTrendBalance} - Todos` : `${labelForTrendBalance} - ${year}`
}

function updateLabelForPayableFlowSumm(year) {
    const label = document.getElementById('html-payable-flow-summary-year-label')
    if (!label) return
    label.textContent = year === 0 ? `${labelForTrendPayable} - Todos` : `${labelForTrendPayable} - ${year}`
}

function updateLabelForReceivableFlowSumm(year) {
    const label = document.getElementById('html-receivable-flow-summary-year-label')
    if (!label) return
    label.textContent = year === 0 ? `${labelForTrendReceivable} - Todos` : `${labelForTrendReceivable} - ${year}`
}

function updateYearNavForReceivableFlowSumm() {
    const prevBtn = document.getElementById('html-receivable-flow-summary-prev')
    const nextBtn = document.getElementById('html-receivable-flow-summary-next')
    if (!prevBtn || !nextBtn) return
    prevBtn.disabled = receivable_flow_year_index >= kpi_years.length - 1
    nextBtn.disabled = receivable_flow_year_index <= 0
}

function updateYearNavForCashFlowSumm() {
    const prevBtn = document.getElementById('html-cash-flow-summary-prev')
    const nextBtn = document.getElementById('html-cash-flow-summary-next')
    if (!prevBtn || !nextBtn) return
    prevBtn.disabled = cash_flow_year_index >= kpi_years.length - 1
    nextBtn.disabled = cash_flow_year_index <= 0
}

function updateYearNavForPayableFlowSumm() {
    const prevBtn = document.getElementById('html-payable-flow-summary-prev')
    const nextBtn = document.getElementById('html-payable-flow-summary-next')
    if (!prevBtn || !nextBtn) return
    prevBtn.disabled = payable_flow_year_index >= kpi_years.length - 1
    nextBtn.disabled = payable_flow_year_index <= 0
}

function initYearNavForCategory() {
    const prevBtn = document.getElementById('html-category-kpi-prev')
    const nextBtn = document.getElementById('html-category-kpi-next')
    if (!prevBtn || !nextBtn) return
    prevBtn.addEventListener('click', async () => {
        if (category_year_index < kpi_years.length - 1) {
            category_year_index++
            await changeYearForCategory()
        }
    })
    nextBtn.addEventListener('click', async () => {
        if (category_year_index > 0) {
            category_year_index--
            await changeYearForCategory()
        }
    })
    updateYearNavForCategory()
}

async function changeYearForCategory() {
    const year = kpi_years[category_year_index]
    saveFilters(CATEGORY_KPI_YEAR_STATE_KEY, year)
    updateLabelForCategory(year)
    updateYearNavForCategory()

    const res = await fetch(`/category-kpi?year_period_for_kpi=${year}`, { credentials: 'same-origin' })
    if (!res.ok) return
    const { categoryKpi } = await res.json()
    lastCategoryRows = categoryKpi || []
    renderCategoryKpiTable(lastCategoryRows)

    const wrapper = document.getElementById('html-category-kpi-body')
    if (wrapper) {
        const saved = loadFilters(CATEGORY_TABLE_SCROLL_KEY)
        if (saved && typeof saved.scrollTop === 'number') {
            wrapper.scrollTop = saved.scrollTop
        }
        wrapper.addEventListener('scroll', () => {
            saveFilters(CATEGORY_TABLE_SCROLL_KEY, { scrollTop: wrapper.scrollTop })
        })
    }
}

function updateLabelForCategory(year) {
    const label = document.getElementById('html-category-kpi-year-label')
    if (!label) return
    label.textContent = year === 0 ? `Categorías - Todos` : `Categorías - ${year}`
}

function updateYearNavForCategory() {
    const prevBtn = document.getElementById('html-category-kpi-prev')
    const nextBtn = document.getElementById('html-category-kpi-next')
    if (!prevBtn || !nextBtn) return
    prevBtn.disabled = category_year_index >= kpi_years.length - 1
    nextBtn.disabled = category_year_index <= 0
}

function renderCategoryKpiTable(rows) {
    const tbody = document.getElementById('html-category-kpi-tbody')
    if (!tbody) return
    tbody.innerHTML = ''
    const sort = loadCategorySort()
    const sorted = applyCategorySort(rows || [], sort)
    setupCategoryHeaderHandlers()

    sorted.forEach(r => {
        const tr = document.createElement('tr')
        const ccell = document.createElement('td')
        ccell.textContent = r.cat_name || ''
        const amount = document.createElement('td')
        amount.textContent = Number(r.amount || 0).toFixed(2)
        const tcount = document.createElement('td')
        tcount.textContent = String(r.transaction_count || 0)
        const action = document.createElement('td')
        const detailButton = document.createElement('button')
        detailButton.type = 'button'
        detailButton.className = 'category-kpi-action'
        detailButton.title = 'Ver estadística'
        detailButton.setAttribute('aria-label', `Ver estadística de ${r.cat_name || 'categoría'}`)
        detailButton.innerHTML = iconMoreHorizontal()
        detailButton.addEventListener('click', () => {
            detailButton.blur()
            openCategoryKpiDetail(r)
        })
        action.appendChild(detailButton)
        tr.appendChild(ccell)
        tr.appendChild(amount)
        tr.appendChild(tcount)
        tr.appendChild(action)
        tbody.appendChild(tr)
    })

    updateCategoryHeaderIndicators(sort)
}

async function openCategoryKpiDetail(category) {
    const modal = document.getElementById('category-kpi-detail-modal')
    const title = document.getElementById('category-kpi-detail-title')
    if (!modal || !title || !category?.category_id) return

    const year = kpi_years[category_year_index]
    title.textContent = `${category.cat_name || 'Categoría'} - ${year === 0 ? 'Todos' : year}`
    const query = new URLSearchParams({
        category_id: String(category.category_id),
        year_period_for_kpi: String(year)
    })
    const res = await fetch(`/category-kpi-detail?${query}`, { credentials: 'same-origin' })
    if (!res.ok) return
    const { categoryKpiDetail } = await res.json()
    const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const labels = categoryKpiDetail.map(row => year === 0
        ? String(row.year_period)
        : monthLabels[row.month_period - 1])
    const ctx = document.getElementById('category-kpi-detail-chart')?.getContext('2d')
    if (!ctx) return
    if (categoryKpiDetailChart) categoryKpiDetailChart.destroy()
    categoryKpiDetailChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Monto',
                data: categoryKpiDetail.map(row => row.amount),
                tension: 0.35,
                fill: false,
                borderColor: '#16a34a',
                backgroundColor: '#16a34a',
                pointBackgroundColor: '#16a34a',
                pointBorderColor: '#16a34a'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            scales: { y: { beginAtZero: true } }
        }
    })
    modal.classList.remove('hidden')
}

function closeCategoryKpiDetail() {
    document.getElementById('category-kpi-detail-modal')?.classList.add('hidden')
}

document.getElementById('category-kpi-detail-close')?.addEventListener('click', closeCategoryKpiDetail)
document.getElementById('category-kpi-detail-modal')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeCategoryKpiDetail()
})

function initYearNavForCategoryGroup() {
    const prevBtn = document.getElementById('html-category-group-kpi-prev')
    const nextBtn = document.getElementById('html-category-group-kpi-next')
    if (!prevBtn || !nextBtn) return
    prevBtn.addEventListener('click', async () => {
        if (category_group_year_index < kpi_years.length - 1) {
            category_group_year_index++
            await changeYearForCategoryGroup()
        }
    })
    nextBtn.addEventListener('click', async () => {
        if (category_group_year_index > 0) {
            category_group_year_index--
            await changeYearForCategoryGroup()
        }
    })
    updateYearNavForCategoryGroup()
}

async function changeYearForCategoryGroup() {
    const year = kpi_years[category_group_year_index]
    saveFilters(CATEGORY_GROUP_KPI_YEAR_STATE_KEY, year)
    updateLabelForCategoryGroup(year)
    updateYearNavForCategoryGroup()

    const res = await fetch(`/category-group-kpi?year_period_for_kpi=${year}`, { credentials: 'same-origin' })
    if (!res.ok) return
    const { categoryGroupKpi } = await res.json()
    lastCategoryGroupRows = categoryGroupKpi || []
    renderCategoryGroupKpiTable(lastCategoryGroupRows)

    const wrapper = document.getElementById('html-category-group-kpi-body')
    if (wrapper) {
        const saved = loadFilters(CATEGORY_GROUP_TABLE_SCROLL_KEY)
        if (saved && typeof saved.scrollTop === 'number') wrapper.scrollTop = saved.scrollTop
        wrapper.onscroll = () => saveFilters(CATEGORY_GROUP_TABLE_SCROLL_KEY, { scrollTop: wrapper.scrollTop })
    }
}

function updateLabelForCategoryGroup(year) {
    const label = document.getElementById('html-category-group-kpi-year-label')
    if (label) label.textContent = year === 0 ? 'Grupo Categorías - Todos' : `Grupo Categorías - ${year}`
}

function updateYearNavForCategoryGroup() {
    const prevBtn = document.getElementById('html-category-group-kpi-prev')
    const nextBtn = document.getElementById('html-category-group-kpi-next')
    if (!prevBtn || !nextBtn) return
    prevBtn.disabled = category_group_year_index >= kpi_years.length - 1
    nextBtn.disabled = category_group_year_index <= 0
}

function renderCategoryGroupKpiTable(rows) {
    const tbody = document.getElementById('html-category-group-kpi-tbody')
    if (!tbody) return
    tbody.innerHTML = ''
    const sort = loadCategoryGroupSort()
    setupCategoryGroupHeaderHandlers()
    applyCategoryGroupSort(rows || [], sort).forEach(row => {
        const tr = document.createElement('tr')
        const name = document.createElement('td')
        name.textContent = row.cat_group_name || ''
        const amount = document.createElement('td')
        amount.textContent = Number(row.amount || 0).toFixed(2)
        const count = document.createElement('td')
        count.textContent = String(row.transaction_count || 0)
        const action = document.createElement('td')
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'category-kpi-action'
        button.title = 'Ver estadística'
        button.setAttribute('aria-label', `Ver estadística de ${row.cat_group_name || 'grupo'}`)
        button.innerHTML = iconMoreHorizontal()
        button.addEventListener('click', () => {
            button.blur()
            openCategoryGroupKpiDetail(row)
        })
        action.appendChild(button)
        tr.append(name, amount, count, action)
        tbody.appendChild(tr)
    })
    updateCategoryGroupHeaderIndicators(sort)
}

async function openCategoryGroupKpiDetail(group) {
    const modal = document.getElementById('category-group-kpi-detail-modal')
    const title = document.getElementById('category-group-kpi-detail-title')
    if (!modal || !title || !group?.category_group_id) return
    const year = kpi_years[category_group_year_index]
    title.textContent = `${group.cat_group_name || 'Grupo Categoría'} - ${year === 0 ? 'Todos' : year}`
    const query = new URLSearchParams({
        category_group_id: String(group.category_group_id),
        year_period_for_kpi: String(year)
    })
    const res = await fetch(`/category-group-kpi-detail?${query}`, { credentials: 'same-origin' })
    if (!res.ok) return
    const { categoryGroupKpiDetail } = await res.json()
    const monthLabels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
    const labels = categoryGroupKpiDetail.map(row => year === 0 ? String(row.year_period) : monthLabels[row.month_period - 1])
    const ctx = document.getElementById('category-group-kpi-detail-chart')?.getContext('2d')
    if (!ctx) return
    if (categoryGroupKpiDetailChart) categoryGroupKpiDetailChart.destroy()
    categoryGroupKpiDetailChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Monto',
                data: categoryGroupKpiDetail.map(row => row.amount),
                tension: 0.35,
                fill: false,
                borderColor: '#16a34a',
                backgroundColor: '#16a34a',
                pointBackgroundColor: '#16a34a',
                pointBorderColor: '#16a34a'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' }, scales: { y: { beginAtZero: true } } }
    })
    modal.classList.remove('hidden')
}

function closeCategoryGroupKpiDetail() {
    document.getElementById('category-group-kpi-detail-modal')?.classList.add('hidden')
}

document.getElementById('category-group-kpi-detail-close')?.addEventListener('click', closeCategoryGroupKpiDetail)
document.getElementById('category-group-kpi-detail-modal')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeCategoryGroupKpiDetail()
})

function loadCategoryGroupSort() {
    const raw = loadFilters(CATEGORY_GROUP_SORT_KEY)
    return raw?.key ? raw : { key: 'amount', dir: 'desc' }
}

function saveCategoryGroupSort(sort) {
    saveFilters(CATEGORY_GROUP_SORT_KEY, sort)
}

function applyCategoryGroupSort(rows, sort) {
    const key = sort?.key || 'amount'
    const dir = sort?.dir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
        if (key === 'cat_group_name') return dir * String(a[key] || '').localeCompare(String(b[key] || ''), undefined, { sensitivity: 'base' })
        const va = Number(a[key] || 0)
        const vb = Number(b[key] || 0)
        return va === vb ? 0 : dir * (va > vb ? 1 : -1)
    })
}

function toggleCategoryGroupSort(key) {
    const current = loadCategoryGroupSort()
    const next = { key, dir: current.key === key && current.dir === 'desc' ? 'asc' : (key === 'cat_group_name' ? 'asc' : 'desc') }
    saveCategoryGroupSort(next)
    renderCategoryGroupKpiTable(lastCategoryGroupRows)
}

function setupCategoryGroupHeaderHandlers() {
    const ths = document.getElementById('html-category-group-kpi-table')?.querySelectorAll('thead th')
    if (!ths || ths.length < 4) return
    const mapping = ['cat_group_name', 'amount', 'transaction_count']
    ths.forEach((th, index) => {
        th.style.cursor = index < mapping.length ? 'pointer' : 'default'
        th.onclick = index < mapping.length ? () => toggleCategoryGroupSort(mapping[index]) : null
    })
}

function updateCategoryGroupHeaderIndicators(sort) {
    const ths = document.getElementById('html-category-group-kpi-table')?.querySelectorAll('thead th')
    if (!ths) return
    const labels = ['Grupo Categoría', 'Monto', 'Cant.', 'Acción']
    const mapping = ['cat_group_name', 'amount', 'transaction_count']
    ths.forEach((th, index) => {
        let label = labels[index]
        if (sort?.key === mapping[index]) label += sort.dir === 'asc' ? ' ▲' : ' ▼'
        th.textContent = label
    })
}

function loadCategorySort() {
    const raw = loadFilters(CATEGORY_SORT_KEY)
    if (!raw || !raw.key) return { key: 'amount', dir: 'desc' }
    return raw
}

function saveCategorySort(sort) {
    saveFilters(CATEGORY_SORT_KEY, sort)
}

function applyCategorySort(rows, sort) {
    if (!Array.isArray(rows)) return []
    const key = sort?.key || 'amount'
    const dir = sort?.dir === 'asc' ? 1 : -1
    const copy = [...rows]
    copy.sort((a, b) => {
        const va = a[key]
        const vb = b[key]
        if (key === 'cat_name') {
            return dir * String(va || '').localeCompare(String(vb || ''), undefined, { sensitivity: 'base' })
        }
        const na = Number(va || 0)
        const nb = Number(vb || 0)
        if (na === nb) return 0
        return dir * (na > nb ? 1 : -1)
    })
    return copy
}

function toggleCategorySort(key) {
    const current = loadCategorySort()
    let next = { key, dir: 'desc' }
    if (current.key === key) {
        next.dir = current.dir === 'asc' ? 'desc' : 'asc'
    } else {
        next.dir = key === 'cat_name' ? 'asc' : 'desc'
    }
    saveCategorySort(next)
    renderCategoryKpiTable(lastCategoryRows)
}

function setupCategoryHeaderHandlers() {
    const table = document.getElementById('html-category-kpi-table')
    if (!table) return
    const ths = table.querySelectorAll('thead th')
    if (!ths || ths.length < 4) return

    const mapping = ['cat_name', 'amount', 'transaction_count']
    ths.forEach((th, idx) => {
        if (idx >= mapping.length) {
            th.style.cursor = 'default'
            th.onclick = null
            return
        }
        th.style.cursor = 'pointer'
        th.onclick = () => toggleCategorySort(mapping[idx])
    })
}

function updateCategoryHeaderIndicators(sort) {
    const table = document.getElementById('html-category-kpi-table')
    if (!table) return
    const ths = table.querySelectorAll('thead th')
    const labels = ['Categoría', 'Monto', 'Cant.', 'Acción']
    ths.forEach((th, idx) => {
        const mapping = ['cat_name', 'amount', 'transaction_count']
        const key = mapping[idx]
        let label = labels[idx]
        if (sort && sort.key === key) {
            label += sort.dir === 'asc' ? ' ▲' : ' ▼'
        }
        th.textContent = label
    })
}

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
