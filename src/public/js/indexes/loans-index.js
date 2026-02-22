/* ============================================================================
1. Constantes globales
2. Variables de estado
3. Selectores DOM
4. Utils generales
5. Render helpers (iconos, tags, cajas)
6. Render Desktop / Mobile
7. Render principal
8. Data (loadLoans)
9. Filtros (texto + estado)
10. Status Filter UI
11. Acciones (redirects / selects)
12. Eventos
13. Scroll
14. Init
============================================================================ */

/* =========================================================
1. Constantes globales
========================================================= */
const API_BASE = '/loans/list'
const FILTER_KEY = `loans.filters.${window.USER_ID}`
const SELECTED_KEY = `loans.selected.${window.USER_ID}`
const SCROLL_KEY = `loans.scroll.${window.USER_ID}`
const STATUS_FILTER_KEY = `loans.status.${window.USER_ID}`
const COLLAPSE_KEY = `loans.collapse.${window.USER_ID}`

/* =========================================================
2. Variables de estado
========================================================= */
let allLoans = []

/* ============================
   Layout detection
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

/*const formatDate = value =>
  value ? new Date(value).toLocaleDateString('es-EC') : '-'*/

function isGroupCollapsed(groupId) {
  const state = loadFilters(COLLAPSE_KEY) || {}
  return !!state[groupId]
}

function toggleGroupCollapse(groupId) {
  const state = loadFilters(COLLAPSE_KEY) || {}
  state[groupId] = !state[groupId]
  saveFilters(COLLAPSE_KEY, state)
  applyAllFilters()
}

function getGroupPendingTotal(group_id) {
  if (!window.groupTotals) return 0
  const group = window.groupTotals.find(g => g.loan_group_id === group_id)
  return group ? group.total_balance : 0
}

/* ============================
   Degradado por grupo (AGREGADO)
============================ */
function getParentBackgroundColor(index, total) {
  if (total <= 1) return 'hsl(210, 40%, 96%)'

  const startLightness = 96
  const endLightness = 88
  const step = (startLightness - endLightness) / (total - 1)

  const lightness = startLightness - (step * index)

  return `hsl(140, 35%, ${lightness}%)`
}

/* =========================================================
5. Render helpers
========================================================= */
/*
  iconEdit()
  iconDelete()
  iconList()
  iconView()
  iconViewOff()
  iconChevronOpen()
  iconChevronClose()
  amountBox()
  statusTag()
  → ya existen en tu proyecto
*/

/* =========================================================
6. Render Desktop
========================================================= */
function renderRow(loan) {
  console.log(loan)
  const { date, time, weekday } = formatDateTime(loan.start_date)
  const group_id = loan.loan_group ? loan.loan_group.id : null

  if (group_id && isGroupCollapsed(group_id)) {
    return ''
  }

  const rowClass = loan.is_active ? '' : 'bg-red-50'

  return `
    <tr id="loan-${loan.id}" class="${rowClass}">
      <td class="ui-td col-left">
        <div class="child-cell">
          <span class="child-indent"></span>
          <span class="child-name">${loan.name}</span>
        </div>
      </td>
      <td class="ui-td col-right">${amountBox(loan.total_amount)}</td>
      <td class="ui-td col-right>${amountBox(loan.principal_paid)}</td>
      <td class="ui-td col-right">${amountBox(loan.interest_paid)}</td>
      <td class="ui-td col-right">${amountBox(loan.balance)}</td>
      <td class="ui-td col-left">${date} - ${weekday}</td>
      <td class="ui-td col-left">${statusTag(loan.is_active)}</td>
      <td class="ui-td col-left">${loan.disbursement_account ? loan.disbursement_account.name : '-'}</td>
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
  const { date, time, weekday } = formatDateTime(loan.start_date)
  const group_id = loan.loan_group ? loan.loan_group.id : null

  if (group_id && isGroupCollapsed(group_id)) {
    return ''
  }

  return `
    <div 
      class="loan-card ${loan.is_active ? '' : 'inactive'}"
      data-id="${loan.id}"
      onclick="selectLoanCard(event, ${loan.id})">

      <div class="card-header">
        <div class="card-title">
          ${loan.name}
        </div>
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
        Monto: ${amountBox(loan.total_amount)} · Capital: ${amountBox(loan.principal_paid)}· Interés: ${amountBox(loan.interest_paid)}
      </div>

      <div class="card-footer">
        <span>${date} - ${weekday}</span>
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
        <td colspan="9" class="ui-td col-center text-gray-500">
          No se encontraron préstamos
        </td>
      </tr>
    `
    restoreScroll()
    return
  }

  const groupsMap = new Map()

  data.forEach(loan => {
    const group = loan.loan_group || { id: 0, name: 'Sin grupo' }
    if (!groupsMap.has(group.id)) {
      groupsMap.set(group.id, { group, loans: [] })
    }
    groupsMap.get(group.id).loans.push(loan)
  })

  const html = Array.from(groupsMap.values()).map(entry => {
    const group = entry.group
    const loans = entry.loans
    const collapsed = isGroupCollapsed(group.id)
    const pending = getGroupPendingTotal(group.id)

    const groupRow = `
      <tr class="parent-row">
        <td class="ui-td col-left">
          <div class="group-cell">
            <button class="group-toggle" onclick="toggleGroupCollapse(${group.id})">
              ${collapsed ? iconChevronOpen() : iconChevronClose()}
            </button>
            <span class="group-name">${group.name}</span>
          </div>
        </td>
        <td class="ui-td col-right group-pending" colspan="7">
          Pendiente: ${amountBox(pending)}
        </td>
        <td class="ui-td col-center"></td>
      </tr>
    `

    const loanRows = collapsed ? '' : loans.map(l => renderRow(l)).join('')
    return groupRow + loanRows
  }).join('')

  tableBody.innerHTML = html

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

  const groupsMap = new Map()

  data.forEach(loan => {
    const group = loan.loan_group || { id: 0, name: 'Sin grupo' }
    if (!groupsMap.has(group.id)) {
      groupsMap.set(group.id, { group, loans: [] })
    }
    groupsMap.get(group.id).loans.push(loan)
  })

  const groups = Array.from(groupsMap.values())
  const totalParents = groups.length

  const html = groups.map((entry, index) => {
    const group = entry.group
    const loans = entry.loans
    const collapsed = isGroupCollapsed(group.id)
    const bgColor = getParentBackgroundColor(index, totalParents)
    const pending = getGroupPendingTotal(group.id)


    const cards = collapsed ? '' : loans.map(l => renderCard(l)).join('')

    return `
      <div class="loan-group ${collapsed ? 'collapsed' : ''}" style="background: ${bgColor};">
        <div class="loan-group-header">
          <button onclick="toggleGroupCollapse(${group.id})">
            ${collapsed ? iconChevronOpen() : iconChevronClose()}
          </button>

          <div class="group-header-content">
            <span class="group-title">${group.name}</span>
            <span class="group-pending">
              Pendiente: ${amountBox(pending)}
            </span>
          </div>
        </div>

        <div class="loan-group-body">
          ${cards}
        </div>
      </div>
    `

  }).join('')

  container.innerHTML = html

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
   8. Data
============================ */
async function loadLoans() {
  const res = await fetch(API_BASE)
  const data = await res.json()
  allLoans = data.loans || []
  window.groupTotals = data.group_totals || []

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
function getFilteredLoans() {
  const term = searchInput.value.trim().toLowerCase()
  const status = loadFilters(STATUS_FILTER_KEY)?.status || 'all'

  return allLoans.filter(loan => {


    const matchText =
      !term || loan.name.toLowerCase().includes(term)


    const matchStatus =
      status === 'all' ||

      (status === 'active' && loan.is_active) ||
      (status === 'inactive' && !loan.is_active)


    return matchText && matchStatus
  })
}

function applyAllFilters() {
  const filtered = getFilteredLoans()

  saveFilters(FILTER_KEY, { term: searchInput.value.trim().toLowerCase() })
  saveFilters(SCROLL_KEY, { y: 0 })

  render(filtered)
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
searchBtn?.addEventListener('click', applyAllFilters)

searchInput?.addEventListener('input', debounce(() => {
  clearBtn.classList.toggle('hidden', !searchInput.value)
  applyAllFilters()
}, 300))

clearBtn?.addEventListener('click', () => {
  searchInput.value = ''
  clearBtn.classList.add('hidden')
  clearFilters(FILTER_KEY)
  clearFilters(SELECTED_KEY)
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

