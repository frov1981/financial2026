document.addEventListener('DOMContentLoaded', () => {
  loadLoans()
  window.addEventListener('resize', () => render(allLoans))
})

/* ============================
   Variables globales
============================ */
const API_BASE = '/api/loans'
const FILTER_KEY = `loans.filters.${window.USER_ID}`
const SELECTED_KEY = `loans.selected.${window.USER_ID}`

let allLoans = []

/* ============================
   DOM
============================ */
const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')
const searchBtn = document.getElementById('search-btn')
const tableBody = document.getElementById('loans-table')

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

const formatDate = value =>
  value ? new Date(value).toLocaleDateString('es-EC') : '-'

/* ============================
   Render - Desktop
============================ */
function renderRow(loan) {
  const rowClass = loan.is_active ? '' : 'bg-red-50'

  return `
    <tr id="loan-${loan.id}" class="${rowClass}">
      <td class="ui-td col-left">${loan.name}</td>
      <td class="ui-td col-right">${amountBox(loan.total_amount)}</td>
      <td class="ui-td col-right col-sm">${amountBox(loan.interest_amount)}</td>
      <td class="ui-td col-right">${amountBox(loan.balance)}</td>
      <td class="ui-td col-left col-sm">${formatDate(loan.start_date)}</td>
      <td class="ui-td col-left col-sm">${statusTag(loan.is_active)}</td>
      <td class="ui-td col-left col-sm">${loan.disbursement_account.name}</td>
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button class="icon-btn edit" onclick="goToLoanUpdate(${loan.id})">
            ${iconEdit()}
            <span class="ui-btn-text">Editar</span>
          </button>
          <button class="icon-btn delete" onclick="goToLoanDelete(${loan.id})">
            ${iconDelete()}
            <span class="ui-btn-text">Eliminar</span>
          </button>
          <button class="icon-btn" onclick="goToLoanView(${loan.id})">
            ${iconList()}
            <span class="ui-btn-text">Detalles</span>
          </button>
        </div>
      </td>
    </tr>
  `
}

/* ============================
   Render - Mobile
============================ */
function renderCard(loan) {
  return `
    <div class="loan-card ${loan.is_active ? '' : 'inactive'}"
         onclick="goToLoanUpdate(${loan.id})">

      <div class="card-header">
        <div class="card-title">${loan.name}</div>

        <div class="card-actions">
          <button class="icon-btn edit"
            onclick="event.stopPropagation(); goToLoanUpdate(${loan.id})">
            ${iconEdit()}
          </button>
          <button class="icon-btn delete"
            onclick="event.stopPropagation(); goToLoanDelete(${loan.id})">
            ${iconDelete()}
          </button>
          <button class="icon-btn"
            onclick="event.stopPropagation(); goToLoanView(${loan.id})">
            ${iconList()}
          </button>
        </div>
      </div>

      <div class="card-balance">
        ${amountBox(loan.balance)}
      </div>

      <div class="card-sub">
        Monto: ${amountBox(loan.total_amount)} · Interés: ${amountBox(loan.interest_amount)}
      </div>

      <div class="card-footer">
        <span>${formatDate(loan.start_date)}</span>
        <div class="card-tags">
          ${statusTag(loan.is_active)}
          <span>${loan.disbursement_account.name}</span>
        </div>
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
    : `<tr><td colspan="8" class="ui-td col-center">No se encontraron préstamos</td></tr>`
}

function renderCards(data) {
  const container = document.getElementById('loans-mobile')
  if (!container) return

  container.innerHTML = data.length
    ? data.map(renderCard).join('')
    : `<div class="ui-empty">No se encontraron préstamos</div>`
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
async function loadLoans() {
  const res = await fetch(API_BASE)
  allLoans = await res.json()
  render(allLoans)
}

/* ============================
   Filtro
============================ */
function filterLoans() {
  const term = searchInput.value.trim().toLowerCase()
  render(
    !term
      ? allLoans
      : allLoans.filter(l =>
          l.name.toLowerCase().includes(term)
        )
  )
}

const debouncedFilter = debounce(filterLoans, 300)

searchBtn.addEventListener('click', filterLoans)
searchInput.addEventListener('input', debouncedFilter)

clearBtn.addEventListener('click', () => {
  searchInput.value = ''
  render(allLoans)
})

/* ============================
   Acciones
============================ */
function goToLoanUpdate(id) {
  location.href = `/loans/update/${id}`
}

function goToLoanDelete(id) {
  location.href = `/loans/delete/${id}`
}

function goToLoanView(id) {
  location.href = `/loans/${id}`
}
