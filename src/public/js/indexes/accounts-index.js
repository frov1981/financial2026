document.addEventListener('DOMContentLoaded', () => {

  const btnRecalculate = document.getElementById('btnRecalculate')
  const overlay = document.getElementById('overlay')

  if (!btnRecalculate) {
    console.error('btnRecalculate not found')
    return
  }

  btnRecalculate.addEventListener('click', async () => {

    overlay.classList.remove('hidden')
    btnRecalculate.disabled = true

    try {
      const response = await fetch('/api/accounts/recalculate-balances', {
        method: 'POST'
      })

      const result = await response.json()

      if (result.success) {
        MessageBox.success(result.message)
        await loadAccounts()
      } else {
        MessageBox.error(result.message)
      }

    } catch (error) {
      console.error(error)
      MessageBox.error('Error inesperado')
    } finally {
      overlay.classList.add('hidden')
      btnRecalculate.disabled = false
    }
  })

})

/* ============================
   Variables globales
============================ */
const API_BASE = '/api/accounts'
const FILTER_KEY = `accounts.filters.${window.USER_ID}`
const SELECTED_KEY = `accounts.selected.${window.USER_ID}`

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
   Render - Desktop
============================ */
function renderRow(account) {
  const rowClass = account.is_active ? '' : 'bg-red-50'

  const statusButton = account.is_active
    ? `
      <button class="icon-btn deactivate" onclick="goToAccountUpdateStatus(${account.id})">
        ${iconViewOff()}
        <span class="ui-btn-text">Desactivar</span>
      </button>
    `
    : `
      <button class="icon-btn activate" onclick="goToAccountUpdateStatus(${account.id})">
        ${iconView()}
        <span class="ui-btn-text">Activar</span>
      </button>
    `

  return `
    <tr id="account-${account.id}" class="${rowClass}">
      <td class="ui-td col-left">${account.name}</td>
      <td class="ui-td col-left">${accountTypeTag(account.type)}</td>
      <td class="ui-td col-left col-sm">${statusTag(account.is_active)}</td>
      <td class="ui-td col-right col-sm">${numberBox(account.transaction_count)}</td>
      <td class="ui-td col-right">${amountBox(account.balance)}</td>
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button class="icon-btn edit" onclick="goToAccountUpdate(${account.id})">
            ${iconEdit()}
            <span class="ui-btn-text">Editar</span>
          </button>
          <button class="icon-btn delete" onclick="goToAccountDelete(${account.id})">
            ${iconDelete()}
            <span class="ui-btn-text">Eliminar</span>
          </button>
          ${statusButton}
        </div>
      </td>
    </tr>
  `
}

/* ============================
   Render - Mobile
============================ */
function renderCard(account) {

  const statusButton = account.is_active
    ? `
      <button class="icon-btn deactivate"
        onclick="event.stopPropagation(); goToAccountUpdateStatus(${account.id})">
        ${iconViewOff()}
      </button>
    `
    : `
      <button class="icon-btn activate"
        onclick="event.stopPropagation(); goToAccountUpdateStatus(${account.id})">
        ${iconView()}
      </button>
    `

  return `
    <div class="account-card ${account.is_active ? '' : 'inactive'}"
         onclick="goToAccountUpdate(${account.id})">

      <!-- Header -->
      <div class="card-header">
        <div class="card-title">${account.name}</div>

        <div class="card-actions">
          <button class="icon-btn edit"
            onclick="event.stopPropagation(); goToAccountUpdate(${account.id})">
            ${iconEdit()}
          </button>

          <button class="icon-btn delete"
            onclick="event.stopPropagation(); goToAccountDelete(${account.id})">
            ${iconDelete()}
          </button>

          ${statusButton}
        </div>
      </div>

      <!-- Balance -->
      <div class="card-balance">
        ${amountBox(account.balance)}
      </div>

      <!-- Footer -->
      <div class="card-footer">
        <span>${numberBox(account.transaction_count)} trx</span>
        <div class="card-tags">
          ${accountTypeTag(account.type)}
          ${statusTag(account.is_active)}
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
    : `<tr><td colspan="6" class="ui-td col-center">No se encontraron cuentas</td></tr>`
}

function renderCards(data) {
  const container = document.getElementById('accounts-mobile')
  if (!container) return

  container.innerHTML = data.length
    ? data.map(renderCard).join('')
    : `<div class="ui-empty">No se encontraron cuentas</div>`
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
async function loadAccounts() {
  const res = await fetch(API_BASE)
  allAccounts = await res.json()
  render(allAccounts)
}

/* ============================
   Búsqueda
============================ */
function filterAccounts() {
  const term = searchInput.value.trim().toLowerCase()
  render(
    !term
      ? allAccounts
      : allAccounts.filter(a =>
          a.name.toLowerCase().includes(term) ||
          a.type.toLowerCase().includes(term)
        )
  )
}

const debouncedFilter = debounce(filterAccounts, 300)

searchBtn.addEventListener('click', filterAccounts)
searchInput.addEventListener('input', debouncedFilter)

clearBtn.addEventListener('click', () => {
  searchInput.value = ''
  render(allAccounts)
})

/* ============================
   Acciones
============================ */
function goToAccountUpdate(id) {
  location.href = `/accounts/update/${id}`
}

function goToAccountDelete(id) {
  location.href = `/accounts/delete/${id}`
}

function goToAccountUpdateStatus(id) {
  location.href = `/accounts/status/${id}`
}

function openAccountActions(id) {
  const action = prompt('1 Editar\n2 Activar/Desactivar\n3 Eliminar')
  if (action === '1') goToAccountUpdate(id)
  if (action === '2') goToAccountUpdateStatus(id)
  if (action === '3') goToAccountDelete(id)
}

/* ============================
   Init
============================ */
loadAccounts()
window.addEventListener('resize', () => render(allAccounts))
