document.addEventListener('DOMContentLoaded', () => {

  console.log('DOM ready')

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
        ${iconViewOff()}
        <span class="ui-btn-text">Desactivar</span>
      </button>
    `
    : `
      <button
        class="icon-btn activate"
        title="Activar"
        onclick="updateAccountStatus(${account.id})">
        ${iconView()}
        <span class="ui-btn-text">Activar</span>
      </button>
    `

  return `
  <tr id="account-${account.id}" class="${rowClass}">
    <td class="ui-td col-left">${account.name}</td>
    <td class="ui-td col-left">${accountTypeTag(account.type)}</td>
    <td class="ui-td col-left col-sm">${statusTag(account.is_active)}</td>
    <td class="ui-td col-right">${amountBox(account.balance)}</td>
    <td class="ui-td col-center">
      <div class="icon-actions">
        <button
          class="icon-btn edit"
          title="Editar"
          onclick="window.location.href='/accounts/update/${account.id}'">
          ${iconEdit()}
          <span class="ui-btn-text">Editar</span>
        </button>

        <button
          class="icon-btn delete"
          title="Eliminar"
          onclick="window.location.href='/accounts/delete/${account.id}'">
          ${iconDelete()}
          <span class="ui-btn-text">Eliminar</span>
        </button>
        
        <!-- Botón Activar / Inactivar -->
        ${statusButton}
      </div>
    </td>
  </tr>
`
}

function renderTable(data) {
  if (!data.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="ui-td col-center text-gray-500">
          No se encontraron cuentas
        </td>
      </tr>
    `
    return
  }

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
