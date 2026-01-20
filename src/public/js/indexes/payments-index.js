document.addEventListener('DOMContentLoaded', () => {
  loadPayments()
  window.addEventListener('resize', () => render(allPayments))
})

/* ============================
   Variables globales
============================ */
const API_BASE = `/api/payments/${window.LOAN_ID}`
const FILTER_KEY = `payments.filters.${window.USER_ID}.${window.LOAN_ID}`

let allPayments = []

/* ============================
   DOM
============================ */
const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')
const searchBtn = document.getElementById('search-btn')
const tableBody = document.getElementById('payments-table')

/* ============================
   Utils
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
   Render - Desktop
============================ */
function renderRow(p) {
  return `
    <tr id="payment-${p.id}">
      <td class="ui-td col-left">${formatDate(p.payment_date)}</td>
      <td class="ui-td col-right">${formatAmount(p.principal_amount)}</td>
      <td class="ui-td col-right">${formatAmount(p.interest_amount)}</td>
      <td class="ui-td col-left col-sm">${p.account?.name || '-'}</td>
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button class="icon-btn edit" onclick="goToPaymentUpdate(${p.id})">
            ${iconEdit()}
            <span class="ui-btn-text">Editar</span>
          </button>
          <button class="icon-btn delete" onclick="goToPaymentDelete(${p.id})">
            ${iconDelete()}
            <span class="ui-btn-text">Eliminar</span>
          </button>
        </div>
      </td>
    </tr>
  `
}

/* ============================
   Render - Mobile
============================ */
function renderCard(p) {
  return `
    <div class="payment-card"
         onclick="goToPaymentUpdate(${p.id})">

      <div class="card-header">
        <div class="card-title">
          ${formatDate(p.payment_date)}
        </div>

        <div class="card-actions">
          <button class="icon-btn edit"
            onclick="event.stopPropagation(); goToPaymentUpdate(${p.id})">
            ${iconEdit()}
          </button>
          <button class="icon-btn delete"
            onclick="event.stopPropagation(); goToPaymentDelete(${p.id})">
            ${iconDelete()}
          </button>
        </div>
      </div>

      <div class="card-body">
        <div class="amount-main">
          ${formatAmount(p.principal_amount)}
        </div>
        <div class="amount-sub">
          Interés: ${formatAmount(p.interest_amount)}
        </div>
      </div>

      <div class="card-footer">
        <span>${p.account?.name || '-'}</span>
      </div>
    </div>
  `
}

/* ============================
   Render helpers
============================ */
function renderTable(data) {
  tableBody.innerHTML = data.length
    ? data.map(renderRow).join('')
    : `
      <tr>
        <td colspan="5" class="ui-td col-center">
          No se encontraron pagos
        </td>
      </tr>
    `
}

function renderCards(data) {
  const container = document.getElementById('payments-mobile')
  if (!container) return

  container.innerHTML = data.length
    ? data.map(renderCard).join('')
    : `<div class="ui-empty">No se encontraron pagos</div>`
}

function render(data) {
  if (window.innerWidth <= 768) {
    renderCards(data)
  } else {
    renderTable(data)
  }
}

/* ============================
   Data
============================ */
async function loadPayments() {
  const res = await fetch(API_BASE)
  allPayments = await res.json()
  render(allPayments)
}

/* ============================
   Filtro
============================ */
function filterPayments() {
  const term = searchInput.value.trim().toLowerCase()

  render(
    !term
      ? allPayments
      : allPayments.filter(p =>
          p.account?.name.toLowerCase().includes(term)
        )
  )
}

const debouncedFilter = debounce(filterPayments, 300)

searchBtn.addEventListener('click', filterPayments)
searchInput.addEventListener('input', debouncedFilter)

clearBtn.addEventListener('click', () => {
  searchInput.value = ''
  render(allPayments)
})

/* ============================
   Acciones
============================ */
function goToPaymentUpdate(id) {
  location.href = `/payments/update/${id}`
}

function goToPaymentDelete(id) {
  location.href = `/payments/delete/${id}`
}
