/* ============================================================================
1. Constantes globales
2. Variables de estado
3. Selectores DOM
4. Utils generales
5. Render helpers (formatters)
6. Render Desktop / Mobile
7. Render principal
8. Data (loadPayments)
9. Filtros (texto)
10. Status Filter UI (N/A)
11. Acciones (redirects / selects)
12. Eventos
13. Scroll 
14. Init (DOMContentLoaded + loadPayments)
============================================================================ */

/* ============================
   1. Constantes globales
============================ */
const API_BASE = `/payments/list/${window.LOAN_ID}/loan`
const FILTER_KEY = `payments.filters.${window.USER_ID}.${window.LOAN_ID}`
const SELECTED_KEY = `payments.selected.${window.USER_ID}.${window.LOAN_ID}`
const SCROLL_KEY = `payments.scroll.${window.USER_ID}.${window.LOAN_ID}`

/* ============================
   2. Variables de estado
============================ */
let allPayments = []

/* ============================
   Layout detection (AGREGADO)
============================ */
function getLayoutMode() {
  const w = window.innerWidth

  if (w >= 1024) return 'desktop'
  if (w >= 769) return 'tablet'
  return 'mobile'
}

let currentLayout = getLayoutMode()

/* ============================
   3. Selectores DOM
============================ */
const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')
const searchBtn = document.getElementById('search-btn')
const tableBody = document.getElementById('payments-table')
const scrollContainer = document.querySelector('.ui-scroll-area')

/* ============================
   4. Utils generales
============================ */
function debounce(fn, delay) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), delay)
  }
}

const formatAmount = value =>
  Number(value).toLocaleString('es-EC', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

const formatDate = value =>
  new Date(value).toLocaleDateString('es-EC')

/* ============================
   5. Render helpers
============================ */
function renderRow(payment) {
  return `
    <tr id="payment-${payment.id}">
      <td class="ui-td col-left">${formatDate(payment.payment_date)}</td>
      <td class="ui-td col-right">${formatAmount(payment.principal_amount)}</td>
      <td class="ui-td col-right">${formatAmount(payment.interest_amount)}</td>
      <td class="ui-td col-left col-sm">${payment.account?.name || '-'}</td>
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button
            class="icon-btn edit"
            title="Editar"
            onclick="goToPaymentUpdate(${payment.id})">
            ${iconEdit()}
            <span class="ui-btn-text">Editar</span>
          </button>
          <button 
            class="icon-btn clone" 
            title="Clonar"
            onclick="goToPaymentClone(${payment.id})">
            ${iconClone()}
            <span class="ui-btn-text">Clonar</span>
          </button>
          <button
            class="icon-btn delete"
            title="Eliminar"
            onclick="goToPaymentDelete(${payment.id})">
            ${iconDelete()}
            <span class="ui-btn-text">Eliminar</span>
          </button>
        </div>
      </td>
    </tr>
  `
}

function renderCard(payment) {
  return `
    <div class="payment-card"
         data-id="${payment.id}"
         onclick="selectPaymentCard(event, ${payment.id})">

      <div class="card-header">
        <div class="card-title">
          ${formatDate(payment.payment_date)}
        </div>

        <div class="card-actions">
          <button
            class="icon-btn edit"
            onclick="event.stopPropagation(); goToPaymentUpdate(${payment.id})">
            ${iconEdit()}
          </button>
          <button 
            class="icon-btn clone"
            onclick="event.stopPropagation(); goToPaymentClone(${payment.id})">
            ${iconClone()}
          </button>
          <button
            class="icon-btn delete"
            onclick="event.stopPropagation(); goToPaymentDelete(${payment.id})">
            ${iconDelete()}
          </button>
        </div>
      </div>

      <div class="card-body">
        <div class="amount-main">
          ${formatAmount(payment.principal_amount)}
        </div>
        <div class="amount-sub">
          Interés: ${formatAmount(payment.interest_amount)}
        </div>
      </div>

      <div class="card-footer">
        <span>${payment.account?.name || '-'}</span>
      </div>
    </div>
  `
}

/* ============================
   6. Render Desktop / Mobile
============================ */
function renderTable(data) {
  if (!data.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="ui-td col-center text-gray-500">
          No se encontraron pagos
        </td>
      </tr>
    `
    restoreScroll()
    return
  }

  tableBody.innerHTML = data.map(renderRow).join('')

  const selected = loadFilters(SELECTED_KEY)
  if (selected?.id) {
    const row = document.getElementById(`payment-${selected.id}`)
    if (row) row.classList.add('tr-selected')
  }

  restoreScroll()
}

function renderCards(data) {
  const container = document.getElementById('payments-mobile')
  if (!container) return

  container.innerHTML = data.length
    ? data.map(renderCard).join('')
    : `<div class="ui-empty">No se encontraron pagos</div>`

  const selected = loadFilters(SELECTED_KEY)
  if (selected?.id) {
    const card = container.querySelector(`[data-id="${selected.id}"]`)
    if (card) card.classList.add('card-selected')
  }

  restoreScroll()
}

/* ============================
   7. Render principal
============================ */
function render(data) {
  if (window.innerWidth <= 768) {
    renderCards(data)
  } else {
    renderTable(data)
  }
}

/* ============================
   8. Data (loadPayments)
============================ */
async function loadPayments() {
  const res = await fetch(API_BASE)
  allPayments = await res.json()

  const cached = loadFilters(FILTER_KEY)
  if (cached?.term) {
    searchInput.value = cached.term
    clearBtn.classList.remove('hidden')
    filterPayments()
  } else {
    render(allPayments)
  }
}

/* ============================
   9. Filtros (texto)
============================ */
function filterPayments() {
  const term = searchInput.value.trim().toLowerCase()
  saveFilters(FILTER_KEY, { term })
  saveFilters(SCROLL_KEY, { y: 0 })

  render(
    !term
      ? allPayments
      : allPayments.filter(p =>
          p.account?.name?.toLowerCase().includes(term)
        )
  )
}

const debouncedFilter = debounce(filterPayments, 300)

/* ============================
   10. Status Filter UI
============================ */
// No aplica para Payments

/* ============================
   11. Acciones (redirects / selects)
============================ */
function goToPaymentUpdate(id) {
  window.location.href = `/payments/update/${id}`
}

function goToPaymentClone(id) {
  location.href = `/payments/clone/${id}`
}

function goToPaymentDelete(id) {
  window.location.href = `/payments/delete/${id}`
}

function selectPaymentCard(event, id) {
  if (event.target.closest('button')) return

  document
    .querySelectorAll('.payment-card')
    .forEach(card => card.classList.remove('card-selected'))

  event.currentTarget.classList.add('card-selected')
  saveFilters(SELECTED_KEY, { id })
}

/* ============================
   12. Eventos
============================ */
searchBtn.addEventListener('click', filterPayments)

searchInput.addEventListener('input', () => {
  clearBtn.classList.toggle('hidden', !searchInput.value)
  debouncedFilter()
})

clearBtn.addEventListener('click', () => {
  searchInput.value = ''
  clearBtn.classList.add('hidden')
  clearFilters(FILTER_KEY)
  clearFilters(SELECTED_KEY)
  render(allPayments)
})

document
  .querySelector('.ui-table')
  ?.addEventListener('click', event => {

    if (event.target.closest('button') || event.target.closest('a')) return

    const row = event.target.closest('tr[id^="payment-"]')
    if (!row) return

    document
      .querySelectorAll('#payments-table tr')
      .forEach(tr => tr.classList.remove('tr-selected'))

    row.classList.add('tr-selected')

    const id = row.id.replace('payment-', '')
    saveFilters(SELECTED_KEY, { id })
  })

/* ============================
   13. Scroll
============================ */
function restoreScroll() {
  if (!scrollContainer) return

  const saved = loadFilters(SCROLL_KEY)
  if (!saved?.y) return

  requestAnimationFrame(() => {
    scrollContainer.scrollTop = saved.y
  })
}

scrollContainer?.addEventListener('scroll', () => {
  saveFilters(SCROLL_KEY, { y: scrollContainer.scrollTop })
})

/* ============================
   14. Init
============================ */
document.addEventListener('DOMContentLoaded', () => {
  loadPayments()

  window.addEventListener('resize', () => {
    const nextLayout = getLayoutMode()

    if (nextLayout !== currentLayout) {
      currentLayout = nextLayout
      filterPayments()
    }
  })
})
