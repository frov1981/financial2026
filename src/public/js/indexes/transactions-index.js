/* ============================================================================
1. Constantes globales
============================================================================ */
const API_BASE = '/transactions/list'
const FILTER_KEY = `transactions.filters.${window.USER_ID}`
const SELECTED_KEY = `transactions.selected.${window.USER_ID}`
const PAGE_SIZE = 10

const context = window.TRANSACTIONS_CONTEXT || {}
const CATEGORY_ID = context.category_id || null

/* ============================================================================
2. Variables de estado
============================================================================ */
let currentPage = 1
let currentSearch = ''
let totalPages = 1
let allItems = []

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

/* ============================================================================
3. Selectores DOM
============================================================================ */
const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')
const searchBtn = document.getElementById('search-btn')
const tableBody = document.getElementById('transactions-table')
const table = document.querySelector('.ui-table')

/* ============================================================================
4. Utils generales
============================================================================ */
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

function isBatchActive() {
  if (typeof batchGetState !== 'function') return false
  const state = batchGetState()
  return !!state?.active
}

/* ============================================================================
5. Render helpers (iconos, tags, cajas)
============================================================================ */
function renderTable(data) {
  if (!data.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="ui-td col-center text-gray-500">
          No se encontraron transacciones
        </td>
      </tr>
    `
    return
  }

  tableBody.innerHTML = data.map(renderRow).join('')

  const selected = loadFilters(SELECTED_KEY)
  if (selected?.id) {
    const row = document.getElementById(`transaction-${selected.id}`)
    if (row) row.classList.add('tr-selected')
  }
}

function renderCards(data) {
  const container = document.getElementById('transactions-mobile')
  if (!container) return

  container.innerHTML = data.length
    ? data.map(renderCard).join('')
    : `<div class="ui-empty">No se encontraron transacciones</div>`

  const selected = loadFilters(SELECTED_KEY)
  if (selected?.id) {
    const card = container.querySelector(`[data-id="${selected.id}"]`)
    if (card) card.classList.add('card-selected')
  }
}

/* ============================================================================
6. Render Desktop / Mobile
============================================================================ */
function renderRow(transaction) {
  const { date, time, weekday } = formatDateTime(transaction.date)

  return `
    <tr id="transaction-${transaction.id}" class="${rowClassByType(transaction.type)}">
      <td class="px-4 py-2 text-center col-nowrap">
        <div>${date}</div>
        <div class="text-xs text-gray-600">${time}</div>
        <div class="text-xs text-gray-600">${weekday}</div>
      </td>
      <td class="ui-td col-left">${transactionTypeTag(transaction.type)}</td>
      <td class="ui-td col-right">${amountBox(transaction.amount)}</td>
      <td class="ui-td col-left col-nowrap">${transaction.account?.name || '-'}</td>
      <td class="ui-td col-left col-nowrap">${transaction.category?.name || '-'}</td>
      <td class="ui-td col-left col-description">${transaction.description}</td>
      <td class="ui-td col-center col-nowrap">
        <div class="icon-actions">

          ${isBatchActive() ? `
            <input
              type="checkbox"
              data-transaction-id="${transaction.id}"
              onclick="event.stopPropagation(); batchToggleSelection(${transaction.id}, this.checked)"
            >
          ` : ''}

          <button 
            class="icon-btn edit" 
            title="Editar"
            onclick="goToTransactionUpdate(${transaction.id})">
            ${iconEdit()}
            <span class="ui-btn-text hide">Editar</span>
          </button>
          <button 
            class="icon-btn clone" 
            title="Clonar"
            onclick="goToTransactionClone(${transaction.id})">
            ${iconClone()}
            <span class="ui-btn-text hide">Clonar</span>
          </button>
          <button 
            class="icon-btn delete" 
            title="Eliminar"
            onclick="goToTransactionDelete(${transaction.id})">
            ${iconDelete()}
            <span class="ui-btn-text hide">Eliminar</span>
          </button>
        </div>
      </td>
    </tr> 
  `
}


function renderCard(transaction) {
  const { date, time, weekday } = formatDateTime(transaction.date)

  return `
    <div 
      class="transaction-card ${rowClassByType(transaction.type)}"
      data-id="${transaction.id}"
      onclick="selectTransactionCard(event, ${transaction.id})">

      <div class="card-header">
        <div class="card-datetime">
          <span class="card-date">${date}</span>
          <span class="card-time">${time}</span>
          <span class="card-weekday">${weekday}</span>
        </div>

        <div class="card-actions">

          ${isBatchActive() ? `
            <input
              type="checkbox"
              data-transaction-id="${transaction.id}"
              onclick="event.stopPropagation(); batchToggleSelection(${transaction.id}, this.checked)"
            >
          ` : ''}

          <button 
            class="icon-btn edit"
            onclick="event.stopPropagation(); goToTransactionUpdate(${transaction.id})">
            ${iconEdit()}
          </button>
          <button 
            class="icon-btn clone"
            onclick="event.stopPropagation(); goToTransactionClone(${transaction.id})">
            ${iconClone()}
          </button>
          <button 
            class="icon-btn delete"
            onclick="event.stopPropagation(); goToTransactionDelete(${transaction.id})">
            ${iconDelete()}
          </button>
        </div>
      </div>

      <div class="card-content">
        <div class="card-info">
          <div class="card-account">${transaction.account?.name || '-'}</div>
          <div class="card-category">${transaction.category?.name || '-'}</div>
          ${transaction.description ? `<div class="card-description">${transaction.description}</div>` : ''}
        </div>

        <div class="card-amount">
          ${amountBox(transaction.amount)}
        </div>
      </div>
    </div>
  `
}

/* ============================================================================
7. Render principal
============================================================================ */
function render(data) {
  window.innerWidth <= 768 ? renderCards(data) : renderTable(data)
}

/* ============================================================================
8. Data (loadCategories / loadTransactions)
============================================================================ */
function updatePaginationInfo() {
  document.getElementById('page-info-top').textContent =
    `Página ${currentPage} de ${totalPages}`
}

async function loadTransactions(page = 1) {
  const params = new URLSearchParams({ page, limit: PAGE_SIZE })
  if (currentSearch) params.append('search', currentSearch)
  if (CATEGORY_ID) params.append('category_id', CATEGORY_ID)

  const res = await fetch(`${API_BASE}?${params}`)
  const data = await res.json()

  allItems = data.items
  totalPages = Math.ceil(data.total / PAGE_SIZE)
  currentPage = page

  render(allItems)
  updatePaginationInfo()

  if (isBatchActive()) {
    if (typeof batchApplyUi === 'function') {
      batchApplyUi(true)
    }

    if (typeof batchToggleRowActions === 'function') {
      batchToggleRowActions(true)
    }

    if (typeof batchRestoreSelection === 'function') {
      batchRestoreSelection()
    }
  }
}

/* ============================================================================
9. Filtros (texto + estado)
============================================================================ */
function applySearch() {
  currentSearch = searchInput.value.trim()
  saveFilters(FILTER_KEY, { term: currentSearch })
  clearBtn.classList.toggle('hidden', !currentSearch)
  loadTransactions(1)
}

/* ============================================================================
10. Status Filter UI
============================================================================ */
/* (reservado para futuros filtros visuales) */

/* ============================================================================
11. Acciones (redirects / selects)
============================================================================ */
function goToTransactionUpdate(id) {
  const params = new URLSearchParams()
  if (CATEGORY_ID) {
    params.set('category_id', CATEGORY_ID)
    params.set('from', 'categories')
  }
  location.href = `/transactions/update/${id}?${params.toString()}`
}

function goToTransactionClone(id) {
  const params = new URLSearchParams()
  if (CATEGORY_ID) {
    params.set('category_id', CATEGORY_ID)
    params.set('from', 'categories')
  }
  location.href = `/transactions/clone/${id}?${params.toString()}`
}

function goToTransactionDelete(id) {
  const params = new URLSearchParams()
  if (CATEGORY_ID) {
    params.set('category_id', CATEGORY_ID)
    params.set('from', 'categories')
  }
  location.href = `/transactions/delete/${id}?${params.toString()}`
}

function goBackToCategories() {
  location.href = '/categories'
}

function selectTransactionCard(event, id) {
  if (event.target.closest('button')) return

  document.querySelectorAll('.transaction-card')
    .forEach(c => c.classList.remove('card-selected'))

  event.currentTarget.classList.add('card-selected')
  saveFilters(SELECTED_KEY, { id })
}

/* ============================================================================
12. Eventos
============================================================================ */
searchInput.addEventListener('input', debounce(applySearch, 300))

clearBtn.addEventListener('click', () => {
  searchInput.value = ''
  currentSearch = ''
  clearBtn.classList.add('hidden')
  clearFilters(FILTER_KEY)
  clearFilters(SELECTED_KEY)
  loadTransactions(1)
})

document.getElementById('prev-page-top')?.addEventListener('click', () => {
  if (currentPage > 1) loadTransactions(currentPage - 1)
})

document.getElementById('next-page-top')?.addEventListener('click', () => {
  if (currentPage < totalPages) loadTransactions(currentPage + 1)
})

if (table) {
  table.addEventListener('click', event => {
    if (event.target.closest('button') || event.target.closest('a')) return

    const row = event.target.closest('tr[id^="transaction-"]')
    if (!row) return

    document.querySelectorAll('#transactions-table tr')
      .forEach(tr => tr.classList.remove('tr-selected'))

    row.classList.add('tr-selected')
    saveFilters(SELECTED_KEY, { id: row.id.replace('transaction-', '') })
  })
}

/* ============================================================================
13. Scroll
============================================================================ */
/* (no implementado todavía) */

/* ============================================================================
14. Init
============================================================================ */
const savedFilters = loadFilters(FILTER_KEY)
if (savedFilters?.term) {
  currentSearch = savedFilters.term
  searchInput.value = savedFilters.term
  clearBtn.classList.remove('hidden')
}

document.addEventListener('DOMContentLoaded', () => {
  loadTransactions()

  window.addEventListener('resize', () => {
    const nextLayout = getLayoutMode()

    if (nextLayout !== currentLayout) {
      currentLayout = nextLayout
      render(allItems)
    }
  })
})
