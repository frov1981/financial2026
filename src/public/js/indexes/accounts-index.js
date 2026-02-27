/* ============================================================================
1. Constantes globales
2. Variables de estado
3. Selectores DOM
4. Utils generales
5. Render helpers (iconos, tags, cajas)
6. Render Desktop / Mobile
7. Render principal
8. Data (loadAccounts)
9. Filtros (texto + estado)
10. Status Filter UI
11. Acciones (redirects / selects)
12. Eventos
13. Scroll
14. Init (DOMContentLoaded + loadAccounts)
============================================================================ */

/* ============================
   1. Constantes globales
============================ */
const API_BASE = '/accounts/list'
const FILTER_KEY = `accounts.filters.${window.USER_ID}`
const SELECTED_KEY = `accounts.selected.${window.USER_ID}`
const SCROLL_KEY = `accounts.scroll.${window.USER_ID}`
const STATUS_FILTER_KEY = `accounts.statusFilter.${window.USER_ID}`

/* ============================
   2. Variables de estado
============================ */
let allAccounts = []

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
const tableBody = document.getElementById('accounts-table')
const scrollContainer = document.querySelector('.ui-scroll-area')
const statusToggleBtn = document.querySelector('.js-status-filter-toggle')

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

/* ============================
   5. Render helpers (iconos, tags, cajas)
============================ */
// iconEdit()
// iconDelete()
// iconView()
// iconViewOff()
// iconList()
// amountBox()
// numberBox()
// statusTag()
// accountTypeTag()

/* ============================
   6. Render Desktop / Mobile
============================ */
function renderRow(account) {
  const rowClass = account.is_active ? '' : 'bg-red-50'

  /*const statusButton = account.is_active
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
    `*/

  return `
    <tr id="account-${account.id}" class="${rowClass}">
      <td class="ui-td col-left">${account.name}</td>
      <td class="ui-td col-left">${accountTypeTag(account.type)}</td>
      <td class="ui-td col-left">${statusTag(account.is_active)}</td>
      <td class="ui-td col-right">${numberBox(account.transaction_count)}</td>
      <td class="ui-td col-right">${amountBox(account.balance)}</td>
      
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button 
            class="icon-btn edit" 
            onclick="goToAccountUpdate(${account.id})">
            ${iconEdit()}
            <span class="ui-btn-text">Editar</span>
          </button>
          <button 
            class="icon-btn delete" 
            onclick="goToAccountDelete(${account.id})">
            ${iconDelete()}
            <span class="ui-btn-text">Eliminar</span>
          </button>
          ${/*statusButton*/''}
        </div>
      </td>
    </tr>
  `
}

function renderCard(account) {
  /*const statusButton = account.is_active
    ? `
      <button 
        class="icon-btn deactivate"
        onclick="event.stopPropagation(); goToAccountUpdateStatus(${account.id})">
        ${iconViewOff()}
      </button>
    `
    : `
      <button 
        class="icon-btn activate"
        onclick="event.stopPropagation(); goToAccountUpdateStatus(${account.id})">
        ${iconView()}
      </button>
    `*/

  return `
    <div 
      class="account-card ${account.is_active ? '' : 'inactive'}"
      data-id="${account.id}"
      onclick="selectAccountCard(event, ${account.id})">

      <div class="card-header">
        <div class="card-title">${account.name}</div>
        <div class="card-actions">
          <button 
            class="icon-btn edit"
            onclick="event.stopPropagation(); goToAccountUpdate(${account.id})">
            ${iconEdit()}
          </button>
          <button 
            class="icon-btn delete"
            onclick="event.stopPropagation(); goToAccountDelete(${account.id})">
            ${iconDelete()}
          </button>
          ${/*statusButton*/''}
        </div>
      </div>

      <div class="card-balance">
        ${amountBox(account.balance)}
      </div>

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
   7. Render principal
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
    row?.classList.add('tr-selected')
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
    container
      .querySelector(`[data-id="${selected.id}"]`)
      ?.classList.add('card-selected')
  }

  restoreScroll()
}

function render(data) {
  window.innerWidth <= 768
    ? renderCards(data)
    : renderTable(data)
}

/* ============================
   8. Data (loadAccounts)
============================ */
async function loadAccounts() {
  const res = await fetch(API_BASE)
  allAccounts = await res.json()

  const cached = loadFilters(FILTER_KEY)
  const statusCached = loadFilters(STATUS_FILTER_KEY)
  const status = statusCached?.status || 'all'

  if (cached?.term) {
    searchInput.value = cached.term
    clearBtn.classList.remove('hidden')
  }

  syncStatusFilterButton(status)
  applyAllFilters()
}

/* ============================
   9. Filtros (texto + estado)
============================ */
function getFilteredAccounts() {
  const cached = loadFilters(FILTER_KEY)
  const statusCached = loadFilters(STATUS_FILTER_KEY)

  const term = cached?.term?.toLowerCase() || ''
  const status = statusCached?.status || 'all'

  return allAccounts.filter(account => {
    const matchText =
      !term ||
      account.name.toLowerCase().includes(term) ||
      account.type.toLowerCase().includes(term)

    const matchStatus =
      status === 'all' ||
      (status === 'active' && account.is_active) ||
      (status === 'inactive' && !account.is_active)

    return matchText && matchStatus
  })
}

function applyAllFilters() {
  render(getFilteredAccounts())
}

function filterAccounts() {
  const term = searchInput.value.trim().toLowerCase()
  saveFilters(FILTER_KEY, { term })
  saveFilters(SCROLL_KEY, { y: 0 })
  applyAllFilters()
}						   
													 
/* ============================
   10. Status Filter UI
============================ */
function syncStatusFilterButton(status) {
  if (!statusToggleBtn) return

  const icon = statusToggleBtn.querySelector('.ui-btn-icon')
  const text = statusToggleBtn.querySelector('.ui-btn-text')

  if (status === 'active') {
    icon.innerHTML = iconView()
    text.textContent = 'Activos'
  } else if (status === 'inactive') {
    icon.innerHTML = iconViewOff()
    text.textContent = 'Inactivos'
  } else {
    icon.innerHTML = iconList()
    text.textContent = 'Todos'
  }

  statusToggleBtn.dataset.status = status
}

function applyStatusFilter(status) {
  saveFilters(STATUS_FILTER_KEY, { status })
  syncStatusFilterButton(status)
  applyAllFilters()
}

/* ============================
   11. Acciones
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
  if (event.target.closest('button')) return

  document
    .querySelectorAll('.account-card')
    .forEach(c => c.classList.remove('card-selected'))

  event.currentTarget.classList.add('card-selected')
  saveFilters(SELECTED_KEY, { id })
}

/* ============================
   12. Eventos
============================ */
const debouncedFilter = debounce(filterAccounts, 300)

searchBtn?.addEventListener('click', filterAccounts)

searchInput?.addEventListener('input', () => {
  clearBtn.classList.toggle('hidden', !searchInput.value)
  debouncedFilter()
})

clearBtn?.addEventListener('click', () => {
  searchInput.value = ''
  clearBtn.classList.add('hidden')
  clearFilters(FILTER_KEY)
  clearFilters(SELECTED_KEY)
  applyAllFilters()
})

statusToggleBtn?.addEventListener('click', () => {
  const current = statusToggleBtn.dataset.status || 'all'
  const next =
    current === 'all' ? 'active' :
    current === 'active' ? 'inactive' : 'all'

  applyStatusFilter(next)
})

document
  .querySelector('.ui-table')
  ?.addEventListener('click', event => {
    if (event.target.closest('button') || event.target.closest('a')) return

    const row = event.target.closest('tr[id^="account-"]')
    if (!row) return

    document
      .querySelectorAll('#accounts-table tr')
      .forEach(tr => tr.classList.remove('tr-selected'))

    row.classList.add('tr-selected')
    saveFilters(SELECTED_KEY, { id: row.id.replace('account-', '') })
  })

/* ============================
   13. Scroll
============================ */
function restoreScroll() {
  const saved = loadFilters(SCROLL_KEY)
  if (!saved?.y || !scrollContainer) return

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
  loadAccounts()

  window.addEventListener('resize', () => {
    const nextLayout = getLayoutMode()

    if (nextLayout !== currentLayout) {
      currentLayout = nextLayout
      applyAllFilters()
    }
  })
})
