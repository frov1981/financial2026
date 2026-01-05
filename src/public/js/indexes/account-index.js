/* ============================
   Variables globales
============================ */
const API_BASE = '/api/accounts'
const FILTER_KEY = `accounts.filters.${window.USER_ID}`

let allAccounts = []

/* ============================
   DOM
============================ */
const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')
const searchBtn = document.getElementById('search-btn')
const tableBody = document.getElementById('accounts-table')

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

/* ============================
   Render
============================ */
function renderRow(account) {
  const rowClass = account.is_active ? '' : 'bg-red-50'
  const statusButton = account.is_active
    ? `
      <button
        class="icon-btn deactivate"
        title="Desactivar"
        onclick="updateAccountStatus(${account.id})">

        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8"/>
          <circle cx="12" cy="12" r="3"/>
          <line x1="2" y1="2" x2="22" y2="22"/>
        </svg>
        <span class="btn-text">Desactivar</span>
      </button>
    `
    : `
      <button
        class="icon-btn activate"
        title="Activar"
        onclick="updateAccountStatus(${account.id})">

        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <span class="btn-text">Activar</span>
      </button>
    `

  return `
    <tr id="account-${account.id}" class="${rowClass}">
      <td class="px-4 py-2">${account.name}</td>
      <td class="px-4 py-2">${accountTypeTag(account.type)}</td>
      <td class="px-4 py-2 hidden sm:table-cell">${statusTag(account.is_active)}</td>
      <td class="px-4 py-2">${amountBox(account.balance)}</td>
      <td class="px-4 py-2">
        <div class="icon-actions">
          <button
            class="icon-btn edit"
            title="Editar"
            onclick="window.location.href='/accounts/update/${account.id}'">

            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg>
            <span class="btn-text">Editar</span>
          </button>
          ${statusButton}
        </div>
      </td>
    </tr>
  `
}

function renderTable(data) {
  tableBody.innerHTML = data.map(renderRow).join('')
}

/* ============================
   Data
============================ */
async function loadAccounts() {
  const res = await fetch(API_BASE)
  allAccounts = await res.json()

  const cached = loadFilters(FILTER_KEY)
  if (cached?.term) {
    searchInput.value = cached.term
    clearBtn.classList.remove('hidden')
    filterAccounts()
  } else {
    renderTable(allAccounts)
  }
}

function filterAccounts() {
  const term = searchInput.value.trim().toLowerCase()
  saveFilters(FILTER_KEY, { term })

  renderTable(
    !term
      ? allAccounts
      : allAccounts.filter(a =>
          a.name.toLowerCase().includes(term) ||
          a.type.toLowerCase().includes(term)
        )
  )
}

const debouncedFilter = debounce(filterAccounts, 300)

/* ============================
   Acciones (GLOBAL)
============================ */
function updateAccountStatus(id) {
  location.href = `/accounts/status/${id}`
}

/* ============================
   Eventos
============================ */
searchBtn.addEventListener('click', filterAccounts)

searchInput.addEventListener('input', () => {
  clearBtn.classList.toggle('hidden', !searchInput.value)
  debouncedFilter()
})

clearBtn.addEventListener('click', () => {
  searchInput.value = ''
  clearBtn.classList.add('hidden')
  clearFilters(FILTER_KEY)
  renderTable(allAccounts)
})

/* ============================
   Init
============================ */
loadAccounts()
