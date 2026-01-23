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
const SCROLL_KEY = `accounts.scroll.${window.USER_ID}`

let allAccounts = []

/* ============================
   DOM
============================ */
const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')
const searchBtn = document.getElementById('search-btn')
const tableBody = document.getElementById('accounts-table')
const scrollContainer = document.querySelector('.ui-scroll-area')

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
      <button 
        class="icon-btn deactivate" 
        onclick="goToAccountUpdateStatus(${account.id})">
        ${iconViewOff()}
        <span class="ui-btn-text">Desactivar</span>
      </button>
    `
    : `
      <button 
        class="icon-btn activate" 
        onclick="goToAccountUpdateStatus(${account.id})">
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
          <!-- Botón Editar -->
          <button 
            class="icon-btn edit" 
            onclick="goToAccountUpdate(${account.id})">
            ${iconEdit()}
            <span class="ui-btn-text">Editar</span>
          </button>
          <!-- Botón Eliminar -->
          <button 
            class="icon-btn delete" 
            onclick="goToAccountDelete(${account.id})">
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
         data-id="${account.id}"
         onclick="selectAccountCard(event, ${account.id})">
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
  if (!data.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="ui-td col-center text-gray-500">
          No se encontraron cuentas
        </td>
      </tr>
    `

    restoreScroll()
    return
  }

  tableBody.innerHTML = data.map(renderRow).join('')

  const selected = loadFilters(SELECTED_KEY)
  if (selected?.id) {
    const row = document.getElementById(`account-${selected.id}`)
    if (row) {
      row.classList.add('tr-selected')
    }
  }

  restoreScroll()
}

function renderCards(data) {
  const container = document.getElementById('accounts-mobile')
  if (!container) return

  container.innerHTML = data.length
    ? data.map(renderCard).join('')
    : `<div class="ui-empty">No se encontraron cuentas</div>`

  const selected = loadFilters(SELECTED_KEY)
  if (selected?.id) {
    const card = container.querySelector(`[data-id="${selected.id}"]`)
    if (card) {
      card.classList.add('card-selected')
    }
  }

  restoreScroll()
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
  
  const cached = loadFilters(FILTER_KEY)
  if (cached?.term) {
    searchInput.value = cached.term
    clearBtn.classList.remove('hidden')
    filterAccounts()
  } else {
    render(allAccounts)
  }
}

/* ============================
   Filtro
============================ */
function filterAccounts() {
  const term = searchInput.value.trim().toLowerCase()  
  saveFilters(FILTER_KEY, { term })
  saveFilters(SCROLL_KEY, { y: 0 })

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

function selectAccountCard(event, id) {
  if (event.target.closest('button')) {
    return
  }

  document.querySelectorAll('.account-card').forEach(card => card.classList.remove('card-selected'))
  const card = event.currentTarget
  card.classList.add('card-selected')

  saveFilters(SELECTED_KEY, { id })
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
  clearFilters(SELECTED_KEY)
  
  render(allAccounts)
})

/* ============================
   Selección de fila
============================ */
document
  .querySelector('.ui-table')
  .addEventListener('click', (event) => {

    if (event.target.closest('button') || event.target.closest('a')) {
      return
    }

    const row = event.target.closest('tr[id^="account-"]')
    if (!row) return

    document
      .querySelectorAll('#accounts-table tr')
      .forEach(tr => tr.classList.remove('tr-selected'))

    row.classList.add('tr-selected')

    // guardar selección
    const accountId = row.id.replace('account-', '')
    saveFilters(SELECTED_KEY, { id: accountId })
  })


/* ============================
   Scroll actions
============================ */
function restoreScroll() {
  if (!scrollContainer) return

  const saved = loadFilters(SCROLL_KEY)
  if (!saved?.y) return

  requestAnimationFrame(() => {
    scrollContainer.scrollTop = saved.y
  })
}

if (scrollContainer) {
  scrollContainer.addEventListener('scroll', () => {
    saveFilters(SCROLL_KEY, { y: scrollContainer.scrollTop })
  })
}

/* ============================
   Init
============================ */
loadAccounts()
window.addEventListener('resize', () => render(allAccounts))
