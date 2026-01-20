/* ============================
   Variables globales
============================ */
const API_BASE = '/api/transactions'
const FILTER_KEY = `transactions.filters.${window.USER_ID}`
const SELECTED_KEY = `transactions.selected.${window.USER_ID}`

const PAGE_SIZE = 10
let currentPage = 1
let currentSearch = ''
let totalPages = 1
let allItems = []

/* ============================
   DOM
============================ */
const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')
const tableBody = document.getElementById('transactions-table')

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

function rowClassByType(type) {
  if (type === 'income') return 'income'
  if (type === 'expense') return 'expense'
  if (type === 'transfer') return 'transfer'
  return ''
}

function formatDateTime(date) {
  const d = new Date(date)
  return {
    date: d.toLocaleDateString('es-EC'),
    time: d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })
  }
}

/* ============================
   Render - Desktop
============================ */
function renderRow(tx) {
  const { date, time } = formatDateTime(tx.date)

  return `
    <tr id="transaction-${tx.id}" class="${rowClassByType(tx.type)}">
      <td class="px-4 py-2 text-center">
        <div>${date}</div>
        <div class="text-xs text-gray-600">${time}</div>
      </td>
      <td class="ui-td col-left col-sm">${transactionTypeTag(tx.type)}</td>
      <td class="ui-td col-right">${amountBox(tx.amount)}</td>
      <td class="ui-td col-left">${tx.account?.name || '-'}</td>
      <td class="ui-td col-left">${tx.category?.name || '-'}</td>
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button class="icon-btn edit" onclick="goToTransactionUpdate(${tx.id})">
            ${iconEdit()}
          </button>
          <button class="icon-btn delete" onclick="goToTransactionDelete(${tx.id})">
            ${iconDelete()}
          </button>
        </div>
      </td>
    </tr>
  `
}

/* ============================
   Render - Mobile
============================ */
function renderCard(tx) {
  const { date, time } = formatDateTime(tx.date)

  return `
    <div class="transaction-card ${rowClassByType(tx.type)}"
         onclick="goToTransactionUpdate(${tx.id})">

      <div class="card-header">
        <div>
          <div class="card-date">${date}</div>
          <div class="card-time">${time}</div>
        </div>

        <div class="card-amount">
          ${amountBox(tx.amount)}
        </div>
      </div>

      <div class="card-body">
        <div class="card-account">
          ${tx.account?.name || '-'}
        </div>
        <div class="card-category">
          ${tx.category?.name || '-'}
        </div>

        ${tx.description
          ? `<div class="card-description">${tx.description}</div>`
          : ''
        }
      </div>

      <div class="card-actions">
        <button class="icon-btn edit"
          onclick="event.stopPropagation(); goToTransactionUpdate(${tx.id})">
          ${iconEdit()}
        </button>
        <button class="icon-btn delete"
          onclick="event.stopPropagation(); goToTransactionDelete(${tx.id})">
          ${iconDelete()}
        </button>
      </div>
    </div>
  `
}

/* ============================
   Render helpers
============================ */
function renderDesktop(data) {
  tableBody.innerHTML = data.length
    ? data.map(renderRow).join('')
    : `
      <tr>
        <td colspan="6" class="ui-td col-center">
          No se encontraron transacciones
        </td>
      </tr>
    `
}

function renderMobile(data) {
  const container = document.getElementById('transactions-mobile')
  if (!container) return

  container.innerHTML = data.length
    ? data.map(renderCard).join('')
    : `<div class="ui-empty">No se encontraron transacciones</div>`
}

function render(data) {
  if (window.innerWidth <= 768) {
    renderMobile(data)
  } else {
    renderDesktop(data)
  }
}

/* ============================
   Data + Pagination
============================ */
function updatePaginationInfo() {
  document.getElementById('page-info-top').textContent =
    `Página ${currentPage} de ${totalPages}`
}

async function loadTransactions(page = 1) {
  const params = new URLSearchParams({
    page,
    limit: PAGE_SIZE
  })

  if (currentSearch) params.append('search', currentSearch)

  const res = await fetch(`${API_BASE}?${params}`)
  const data = await res.json()

  allItems = data.items
  totalPages = Math.ceil(data.total / PAGE_SIZE)
  currentPage = page

  render(allItems)
  updatePaginationInfo()
}

/* ============================
   Filtro
============================ */
function applySearch() {
  currentSearch = searchInput.value.trim()
  clearBtn.classList.toggle('hidden', !currentSearch)
  loadTransactions(1)
}

const debouncedSearch = debounce(applySearch, 300)

searchInput.addEventListener('input', debouncedSearch)

clearBtn.addEventListener('click', () => {
  searchInput.value = ''
  currentSearch = ''
  clearBtn.classList.add('hidden')
  loadTransactions(1)
})

/* ============================
   Paginado (solo arriba)
============================ */
document.getElementById('prev-page-top').onclick = () => {
  if (currentPage > 1) loadTransactions(currentPage - 1)
}

document.getElementById('next-page-top').onclick = () => {
  if (currentPage < totalPages) loadTransactions(currentPage + 1)
}

/* ============================
   Acciones
============================ */
function goToTransactionUpdate(id) {
  location.href = `/transactions/update/${id}`
}

function goToTransactionDelete(id) {
  location.href = `/transactions/delete/${id}`
}

/* ============================
   Init
============================ */
loadTransactions()
window.addEventListener('resize', () => render(allItems))
