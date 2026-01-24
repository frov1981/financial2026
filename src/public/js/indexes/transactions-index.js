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
const searchBtn = document.getElementById('search-btn')
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
function renderRow(transaction) {
  const { date, time } = formatDateTime(transaction.date)

  return `
    <tr id="transaction-${transaction.id}" class="${rowClassByType(transaction.type)}">
      <td class="px-4 py-2 text-center">
        <div>${date}</div>
        <div class="text-xs text-gray-600">${time}</div>
      </td>
      <td class="ui-td col-left col-sm">${transactionTypeTag(transaction.type)}</td>
      <td class="ui-td col-right">${amountBox(transaction.amount)}</td>
      <td class="ui-td col-left">${transaction.account?.name || '-'}</td>
      <td class="ui-td col-left">${transaction.category?.name || '-'}</td>
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button 
            class="icon-btn edit" 
            onclick="goToTransactionUpdate(${transaction.id})">
            ${iconEdit()}
          </button>
          <button 
            class="icon-btn delete" 
            onclick="goToTransactionDelete(${transaction.id})">
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
function renderCard(transaction) {
  const { date, time } = formatDateTime(transaction.date)

  return `
    <div class="transaction-card ${rowClassByType(transaction.type)}"
         data-id="${transaction.id}"
         onclick="selectTransactionCard(event, ${transaction.id})">

      <div class="card-header">
        <div>
          <div class="card-date">${date}</div>
          <div class="card-time">${time}</div>
        </div>

        <div class="card-amount">
          ${amountBox(transaction.amount)}
        </div>
      </div>

      <div class="card-body">
        <div class="card-account">
          ${transaction.account?.name || '-'}
        </div>
        <div class="card-category">
          ${transaction.category?.name || '-'}
        </div>

        ${transaction.description
      ? `<div class="card-description">${transaction.description}</div>`
      : ''
    }
      </div>

      <div class="card-actions">
        <button 
          class="icon-btn edit"
          onclick="event.stopPropagation(); goToTransactionUpdate(${transaction.id})">
          ${iconEdit()}
        </button>
        <button 
          class="icon-btn delete"
          onclick="event.stopPropagation(); goToTransactionDelete(${transaction.id})">
          ${iconDelete()}
        </button>
      </div>
    </div>
  `
}

/* ============================
   Render helpers
============================ */
function renderTable(data) {
  if (!data.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="ui-td col-center text-gray-500">
          No se encontraron transacciones
        </td>
      </tr>
    `

    //restoreScroll()
    return
  }

  tableBody.innerHTML = data.map(renderRow).join('')

  const selected = loadFilters(SELECTED_KEY)
  if (selected?.id) {
    const row = document.getElementById(`transaction-${selected.id}`)
    if (row) {
      row.classList.add('tr-selected')
    }
  }

  //restoreScroll()
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
    if (card) {
      card.classList.add('card-selected')
    }
  }

  //restoreScroll()
}

function render(data) {
  if (window.innerWidth <= 768) {
    renderCards(data)
  } else {
    renderTable(data)
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

function selectTransactionCard(event, id) {
  if (event.target.closest('button')) {
    return
  }

  document.querySelectorAll('.transaction-card').forEach(card => card.classList.remove('card-selected'))
  const card = event.currentTarget
  card.classList.add('card-selected')

  saveFilters(SELECTED_KEY, { id })
}

/* ============================
   Selección de fila
============================ */
document
  .querySelector('.ui-table')
  .addEventListener('click', (event) => {

    if (event.target.closest('button') || event.target.closest('a')) {
      return
    }

    const row = event.target.closest('tr[id^="transaction-"]')
    if (!row) return

    document
      .querySelectorAll('#transactions-table tr')
      .forEach(tr => tr.classList.remove('tr-selected'))

    row.classList.add('tr-selected')

    // guardar selección
    const transactionId = row.id.replace('transaction-', '')
    saveFilters(SELECTED_KEY, { id: transactionId })
  })

/* ============================
   Init
============================ */
loadTransactions()
window.addEventListener('resize', () => render(allItems))
