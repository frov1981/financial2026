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

/* =========================================================
1. Constantes globales
========================================================= */
const API_BASE = '/loans/list'
const FILTER_KEY = `loans.filters.${window.USER_ID}`
const SELECTED_KEY = `loans.selected.${window.USER_ID}`
const SCROLL_KEY = `loans.scroll.${window.USER_ID}`
const STATUS_FILTER_KEY = `loans.status.${window.USER_ID}`

/* =========================================================
2. Variables de estado
========================================================= */
let allLoans = []

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

/* =========================================================
3. Selectores DOM
========================================================= */
const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')
const searchBtn = document.getElementById('search-btn')
const tableBody = document.getElementById('loans-table')
const scrollContainer = document.querySelector('.ui-scroll-area')
const statusBtn = document.querySelector('.js-status-filter-toggle')

/* =========================================================
4. Utils generales
========================================================= */
function debounce(fn, delay) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), delay)
  }
}

function saveFilters(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function loadFilters(key) {
  const raw = localStorage.getItem(key)
  return raw ? JSON.parse(raw) : null
}

function clearFilters(key) {
  localStorage.removeItem(key)
}

const formatDate = value =>
  value ? new Date(value).toLocaleDateString('es-EC') : '-'

/* =========================================================
5. Render helpers (iconos, tags, cajas)
========================================================= */
/*
  iconEdit()
  iconDelete()
  iconList()
  iconView()
  iconViewOff()
  amountBox()
  statusTag()
  → ya existen en tu proyecto
*/

/* =========================================================
6. Render Desktop
========================================================= */
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
      <td class="ui-td col-left col-sm">${loan.disbursement_account ? loan.disbursement_account.name : '-'}</td>
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button 
            class="icon-btn edit" 
            onclick="goToLoanUpdate(${loan.id})">
            ${iconEdit()}
            <span class="ui-btn-text">Editar</span>
          </button>
          <button
            class="icon-btn delete" 
            onclick="goToLoanDelete(${loan.id})">
            ${iconDelete()}
            <span class="ui-btn-text">Eliminar</span>
          </button>
          <button 
            class="icon-btn" 
            onclick="goToLoanView(${loan.id})">
            ${iconList()}
            <span class="ui-btn-text">Detalles</span>
          </button>
        </div>
      </td>
    </tr>
  `
}

/* =========================================================
7. Render Mobile
========================================================= */
function renderCard(loan) {
  return `
    <div 
      class="loan-card ${loan.is_active ? '' : 'inactive'}"
      data-id="${loan.id}"
      onclick="selectLoanCard(event, ${loan.id})">

      <div class="card-header">
        <div class="card-title">${loan.name}</div>
        <div class="card-actions">
          <button 
            class="icon-btn edit"
            onclick="event.stopPropagation(); goToLoanUpdate(${loan.id})">
            ${iconEdit()}
          </button>
          <button 
            class="icon-btn delete"
            onclick="event.stopPropagation(); goToLoanDelete(${loan.id})">
            ${iconDelete()}
          </button>
          <button 
            class="icon-btn"
            onclick="event.stopPropagation(); goToLoanView(${loan.id})">
            ${iconList()}
          </button>
        </div>
      </div>

      <div class="card-balance">${amountBox(loan.balance)}</div>

      <div class="card-sub">
        Monto: ${amountBox(loan.total_amount)} · Interés: ${amountBox(loan.interest_amount)}
      </div>

      <div class="card-footer">
        <span>${formatDate(loan.start_date)}</span>
        <div class="card-tags">
          ${statusTag(loan.is_active)}
          <span>${loan.disbursement_account ? loan.disbursement_account.name : '-'}</span>
        </div>
      </div>
    </div>
  `
}

/* =========================================================
8. Render principal
========================================================= */
function renderTable(data) {
  if (!data.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="ui-td col-center text-gray-500">
          No se encontraron préstamos
        </td>
      </tr>
    `
    restoreScroll()
    return
  }

  tableBody.innerHTML = data.map(renderRow).join('')

  const selected = loadFilters(SELECTED_KEY)
  if (selected?.id) {
    const row = document.getElementById(`loan-${selected.id}`)
    if (row) row.classList.add('tr-selected')
  }

  restoreScroll()
}

function renderCards(data) {
  const container = document.getElementById('loans-mobile')
  if (!container) return

  container.innerHTML = data.length
    ? data.map(renderCard).join('')
    : `<div class="ui-empty">No se encontraron préstamos</div>`

  const selected = loadFilters(SELECTED_KEY)
  if (selected?.id) {
    const card = container.querySelector(`[data-id="${selected.id}"]`)
    if (card) card.classList.add('card-selected')
  }

  restoreScroll()
}

function render(data) {
  window.innerWidth <= 768 ? renderCards(data) : renderTable(data)
}

/* ============================
   8. Data (loadLoans)
============================ */
async function loadLoans() {
  const res = await fetch(API_BASE)
  allLoans = await res.json()

  const cachedText = loadFilters(FILTER_KEY)
  const cachedStatus = loadFilters(STATUS_FILTER_KEY)

  if (cachedText?.term) {
    searchInput.value = cachedText.term
    clearBtn.classList.remove('hidden')
  }

  syncStatusFilterButton(cachedStatus?.status || 'all')
  applyAllFilters()
}

/* =========================================================
9. Filtros (texto + estado)
========================================================= */
function applyAllFilters() {
  const term = searchInput.value.trim().toLowerCase()
  const status = loadFilters(STATUS_FILTER_KEY)?.status || 'all'

  let data = [...allLoans]

  if (term) {
    data = data.filter(l => l.name.toLowerCase().includes(term))
  }

  if (status !== 'all') {
    data = data.filter(l =>
      status === 'active' ? l.is_active : !l.is_active
    )
  }

  saveFilters(FILTER_KEY, { term })
  saveFilters(SCROLL_KEY, { y: 0 })

  render(data)
}

/* =========================================================
10. Status Filter UI
========================================================= */
function syncStatusFilterButton(status) {
  if (!statusBtn) return

  const icon = statusBtn.querySelector('.ui-btn-icon')
  const text = statusBtn.querySelector('.ui-btn-text')

  if (status === 'active') {
    icon.innerHTML = iconView()
    text.textContent = 'Activos'
    statusBtn.dataset.status = 'active'
    return
  }

  if (status === 'inactive') {
    icon.innerHTML = iconViewOff()
    text.textContent = 'Inactivos'
    statusBtn.dataset.status = 'inactive'
    return
  }

  icon.innerHTML = iconList()
  text.textContent = 'Todos'
  statusBtn.dataset.status = 'all'
}

function applyStatusFilter(status) {
  saveFilters(STATUS_FILTER_KEY, { status })
  syncStatusFilterButton(status)
  applyAllFilters()
}

/* =========================================================
11. Acciones
========================================================= */
function goToLoanUpdate(id) {
  location.href = `/loans/update/${id}`
}

function goToLoanDelete(id) {
  location.href = `/loans/delete/${id}`
}

function goToLoanView(id) {
  location.href = `/loans/${id}/loan`
}

function selectLoanCard(event, id) {
  if (event.target.closest('button')) return

  document.querySelectorAll('.loan-card')
    .forEach(card => card.classList.remove('card-selected'))

  event.currentTarget.classList.add('card-selected')
  saveFilters(SELECTED_KEY, { id })
}

/* =========================================================
12. Eventos
========================================================= */
searchBtn.addEventListener('click', applyAllFilters)

searchInput.addEventListener('input', debounce(() => {
  clearBtn.classList.toggle('hidden', !searchInput.value)
  applyAllFilters()
}, 300))

clearBtn.addEventListener('click', () => {
  searchInput.value = ''
  clearBtn.classList.add('hidden')
  clearFilters(FILTER_KEY)
  applyAllFilters()
})

statusBtn?.addEventListener('click', () => {
  const current = statusBtn.dataset.status || 'all'
  const next =
    current === 'all' ? 'active'
    : current === 'active' ? 'inactive'
    : 'all'

  applyStatusFilter(next)
})

/* =========================================================
13. Scroll
========================================================= */
function restoreScroll() {
  if (!scrollContainer) return
  const saved = loadFilters(SCROLL_KEY)
  if (!saved?.y) return

  requestAnimationFrame(() => {
    scrollContainer.scrollTop = saved.y
  })
}

scrollContainer?.addEventListener('scroll', () => {
  saveFilters(SCROLL_KEY, { y: scrollContainer.scrollTop })
})

/* =========================================================
14. Init
========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  loadLoans()

  window.addEventListener('resize', () => {
    const nextLayout = getLayoutMode()

    if (nextLayout !== currentLayout) {
      currentLayout = nextLayout
      applyAllFilters()
    }
  })
})

