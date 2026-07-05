/* ============================================================================
1. Constantes globales
2. Variables de estado
3. Selectores DOM
4. Utils generales
5. Render helpers (iconos, tags, cajas)
6. Render Desktop / Mobile
7. Render principal
8. Data (loadPayables)
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
const API_BASE = '/payables/list'
const FILTER_KEY = `payables.filters.${window.USER_ID}`
const SELECTED_KEY = `payables.selected.${window.USER_ID}`
const SCROLL_KEY = `payables.scroll.${window.USER_ID}`
const STATUS_FILTER_KEY = `payables.statusFilter.${window.USER_ID}`
const COLLAPSE_KEY = `payables.collapse.${window.USER_ID}`

/* =========================================================
2. Variables de estado
========================================================= */
let allPayables = []

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
const tableBody = document.getElementById('payables-table')
const scrollContainer = document.querySelector('.ui-scroll-area')
const statusToggleBtn = document.querySelector('.js-status-filter-toggle')

const newBtn = document.querySelector('[data-btn="new"]')
const insertModal = document.getElementById('insert-modal')
const insertModalContent = document.getElementById('insert-modal-content')
const insertGroupBtn = document.getElementById('insert-group')
const insertChildBtn = document.getElementById('insert-child')
const closeInsertModalBtn = document.getElementById('close-modal')

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

function isPayableGroupCollapsed(groupId) {
  const state = loadFilters(COLLAPSE_KEY) || {}
  return !!state[groupId]
}

function togglePayableGroupCollapse(groupId) {
  const state = loadFilters(COLLAPSE_KEY) || {}
  state[groupId] = !state[groupId]
  saveFilters(COLLAPSE_KEY, state)
  applyAllFilters()
}

function getGroupPendingTotal(group_id) {
  if (!window.groupTotals) return 0
  const group = window.groupTotals.find(g => g.payable_group_id === group_id)
  return group ? group.total_balance : 0
}

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
function renderRow(payable) {
  const { date, time, weekday } = formatDateTime(payable.start_date)
  const group_id = payable.payable_group ? payable.payable_group.id : null
  if (group_id && isPayableGroupCollapsed(group_id)) {
    return ''
  }

  const rowClass = payable.is_active ? '' : 'bg-red-50'
  return `
    <tr id="payable-${payable.id}" class="${rowClass}">
      <td class="ui-td col-left">
        <div class="child-cell">
          <span class="child-indent"></span>
          <div class="payable-name-block">
            <div class="payable-name">${payable.name}</div>
            <div class="payable-date">
              ${date} · ${weekday}
            </div>
          </div>
        </div>
      </td>
      <td class="ui-td col-right">${amountBox(payable.total_amount)}</td>
      <td class="ui-td col-right">${amountBox(payable.principal_paid)}</td>
      <td class="ui-td col-right">${amountBox(payable.interest_paid)}</td>
      <td class="ui-td col-right">${amountBox(payable.balance)}</td>
      <td class="ui-td col-left">${statusTag(payable.is_active)}</td>
      <td class="ui-td col-left">${payable.disbursement_account ? payable.disbursement_account.name : '-'}</td>
      <td class="ui-td col-left">${payable.category ? payable.category.name : '-'}</td>
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button 
            class="icon-btn edit" 
            onclick="goToPayableUpdate(${payable.id})">
            ${iconEdit()}
            <span class="ui-btn-text">Editar</span>
          </button>
          <button
            class="icon-btn delete" 
            onclick="goToPayableDelete(${payable.id})">
            ${iconDelete()}
            <span class="ui-btn-text">Eliminar</span>
          </button>
          <button 
            class="icon-btn" 
            onclick="goToPayableView(${payable.id})">
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
function renderCard(payable) {
  const { date, time, weekday } = formatDateTime(payable.start_date)
  const group_id = payable.payable_group ? payable.payable_group.id : null
  if (group_id && isPayableGroupCollapsed(group_id)) {
    return ''
  }

  return `
    <div 
      class="payable-card ${payable.is_active ? '' : 'inactive'}"
      data-id="${payable.id}"
      onclick="selectPayableCard(event, ${payable.id})">

      <div class="card-header">
        <div class="card-title">
          ${payable.name}
        </div>
        <div class="card-actions">
          <button 
            class="icon-btn edit"
            onclick="event.stopPropagation(); goToPayableUpdate(${payable.id})">
            ${iconEdit()}
          </button>
          <button 
            class="icon-btn delete"
            onclick="event.stopPropagation(); goToPayableDelete(${payable.id})">
            ${iconDelete()}
          </button>
          <button 
            class="icon-btn"
            onclick="event.stopPropagation(); goToPayableView(${payable.id})">
            ${iconList()}
          </button>
        </div>
      </div>

      <div class="card-balance">${amountBox(payable.balance)}</div>

      <div class="card-sub payable-amounts">
        <div class="payable-amount-item">
          <div class="payable-amount-title">Monto</div>
          <div class="payable-amount-value">${amountBox(payable.total_amount)}</div>
        </div>
        <div class="payable-amount-item">
          <div class="payable-amount-title">Capital</div>
          <div class="payable-amount-value">${amountBox(payable.principal_paid)}</div>
        </div>
        <div class="payable-amount-item">
          <div class="payable-amount-title">Interés</div>
          <div class="payable-amount-value">${amountBox(payable.interest_paid)}</div>
        </div>
      </div>

      <div class="card-footer">
        <span>
          <div class="date-block">
            <div class="date-text">${date}</div>
            <div class="weekday-text">${weekday}</div>
          </div>
        </span>

        <div class="card-tags">
          <div class="tag-line">
            ${statusTag(payable.is_active)}
          </div>
          <div class="tag-line">
            ${payable.disbursement_account ? payable.disbursement_account.name : '-'}
          </div>
          <div class="tag-line">
            ${payable.category ? payable.category.name : '-'}
          </div>
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
          No se encontraron Cuentas por Pagar
        </td>
      </tr>
    `
    restoreScroll()
    return
  }

  const groupsMap = new Map()

  data.forEach(payable => {
    const group = payable.payable_group || { id: 0, name: 'Sin grupo' }
    if (!groupsMap.has(group.id)) {
      groupsMap.set(group.id, { group, payables: [] })
    }
    groupsMap.get(group.id).payables.push(payable)
  })

  const html = Array.from(groupsMap.values()).map(entry => {
    const group = entry.group
    const payables = entry.payables
    const collapsed = isPayableGroupCollapsed(group.id)
    const pending = getGroupPendingTotal(group.id)

    const groupRow = `
      <tr class="parent-row">
        <td class="ui-td col-left">
          <div class="group-cell">
            <button class="group-toggle" onclick="togglePayableGroupCollapse(${group.id})">
              ${collapsed ? iconChevronOpen() : iconChevronClose()}
            </button>
            <span class="group-name">${group.name}</span>
          </div>
        </td>
        <td class="ui-td col-right group-pending" colspan="3">
          Pendiente: ${amountBox(pending)}
        </td>
        <td class="ui-td col-right" colspan="5">
          <div class="icon-actions">
            <button 
                class="icon-btn edit" 
                onclick="goToPayableGroupUpdate(${group.id})">
                ${iconEdit()}
                <span class="ui-btn-text">Editar</span>
              </button>
              <button 
                class="icon-btn delete" 
                onclick="goToPayableGroupDelete(${group.id})">
                ${iconDelete()}
                <span class="ui-btn-text">Eliminar</span>
              </button>
            </div>
        </td>
      </tr>
    `

    const payableRows = collapsed ? '' : payables.map(l => renderRow(l)).join('')
    return groupRow + payableRows
  }).join('')

  tableBody.innerHTML = html

  const selected = loadFilters(SELECTED_KEY)
  if (selected?.id) {
    const row = document.getElementById(`payable-${selected.id}`)
    if (row) row.classList.add('tr-selected')
  }

  restoreScroll()
}

function renderCards(data) {
  const container = document.getElementById('payables-mobile')
  if (!container) return

  const groupsMap = new Map()

  data.forEach(payable => {
    const group = payable.payable_group || { id: 0, name: 'Sin grupo' }
    if (!groupsMap.has(group.id)) {
      groupsMap.set(group.id, { group, payables: [] })
    }
    groupsMap.get(group.id).payables.push(payable)
  })

  const groups = Array.from(groupsMap.values())
  const totalParents = groups.length

  const html = groups.map((entry, index) => {
    const group = entry.group
    const payables = entry.payables
    const collapsed = isPayableGroupCollapsed(group.id)
    const bgColor = getParentBackgroundColor(index, totalParents)
    const pending = getGroupPendingTotal(group.id)


    const cards = collapsed ? '' : payables.map(l => renderCard(l)).join('')

    return `
      <div class="payable-group ${collapsed ? 'collapsed' : ''}" style="background:${bgColor};">
        <div class="payable-group-header">

          <div class="payables-group-header-left">
            <button onclick="togglePayableGroupCollapse(${group.id})">
              ${collapsed ? iconChevronOpen() : iconChevronClose()}
            </button>
          </div>

          <div class="payables-group-center">
            <span class="payables-group-title">${group.name}</span>
            <span class="payables-group-pending">
              Pendiente: ${amountBox(pending)}
            </span>
          </div>

          <div class="payables-group-actions">
            <button 
              class="icon-btn edit"
              onclick="event.stopPropagation();goToPayableGroupUpdate(${group.id})">
              ${iconEdit()}
            </button>
            <button 
              class="icon-btn delete"
              onclick="event.stopPropagation();goToPayableGroupDelete(${group.id})">
              ${iconDelete()}
            </button>
          </div>

        </div>

        <div class="payable-group-body">
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
async function loadPayables() {
  const res = await fetch(API_BASE)
  const data = await res.json()
  allPayables = data.payables || []
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
function getFilteredPayables() {
  const cached = loadFilters(FILTER_KEY)
  const statusCached = loadFilters(STATUS_FILTER_KEY)

  const term = cached?.term?.toLowerCase() || ''
  const status = statusCached?.status || 'all'

  return allPayables.filter(payable => {
    const matchText =
      !term || payable.name.toLowerCase().includes(term)

    const matchStatus =
      status === 'all' ||
      (status === 'active' && payable.is_active) ||
      (status === 'inactive' && !payable.is_active)

    return matchText && matchStatus
  })
}

function applyAllFilters() {
  const filtered = getFilteredPayables()
  render(filtered)
}

function filterPayables() {
  const term = searchInput.value.trim().toLowerCase()
  saveFilters(FILTER_KEY, { term })
  saveFilters(SCROLL_KEY, { y: 0 })
  applyAllFilters()
}

/* =========================================================
10. Status Filter UI
========================================================= */
function syncStatusFilterButton(status) {
  if (!statusToggleBtn) return

  const icon = statusToggleBtn.querySelector('.ui-btn-icon')
  const text = statusToggleBtn.querySelector('.ui-btn-text')

  if (status === 'active') {
    icon.innerHTML = iconView()
    text.textContent = 'Activas'
  } else if (status === 'inactive') {
    icon.innerHTML = iconViewOff()
    text.textContent = 'Inactivas'
  } else {
    icon.innerHTML = iconList()
    text.textContent = 'Todas'
  }

  statusToggleBtn.dataset.status = status
}

function applyStatusFilter(status) {
  saveFilters(STATUS_FILTER_KEY, { status })
  syncStatusFilterButton(status)
  applyAllFilters()
}

/* =========================================================
11. Acciones
========================================================= */
function goToPayableUpdate(id) {
  location.href = `/payables/update/${id}`
}

function goToPayableDelete(id) {
  location.href = `/payables/delete/${id}`
}

function goToPayableView(id) {
  location.href = `/payables/${id}/payable`
}

function selectPayableCard(event, id) {
  if (event.target.closest('button')) return

  document.querySelectorAll('.payable-card')
    .forEach(card => card.classList.remove('card-selected'))

  event.currentTarget.classList.add('card-selected')
  saveFilters(SELECTED_KEY, { id })
}

function goToPayableGroupInsert() {
  location.href = `/payable-groups/insert`
}

function goToPayableGroupUpdate(id) {
  location.href = `/payable-groups/update/${id}`
}

function goToPayableGroupDelete(id) {
  location.href = `/payable-groups/delete/${id}`
}

/* =========================================================
12. Eventos
========================================================= */
const debouncedFilter = debounce(filterPayables, 300)

searchBtn?.addEventListener('click', applyAllFilters)

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
    current === 'all' ? 'active'
      : current === 'active' ? 'inactive'
        : 'all'

  applyStatusFilter(next)
})

/* ============================
   Modal Nuevo (Grupo o Hija)
============================ */
function openModal() {
  if (insertModal) insertModal.classList.remove('hidden')
}
function closeModal() {
  if (insertModal) insertModal.classList.add('hidden')
}

newBtn?.addEventListener('click', (e) => {
  e.preventDefault()
  openModal()
})

closeInsertModalBtn?.addEventListener('click', () => {
  closeModal()
})

insertGroupBtn?.addEventListener('click', () => {
  goToPayableGroupInsert()
})

insertChildBtn?.addEventListener('click', () => {
  location.href = '/payables/insert'
})

insertModal?.addEventListener('click', (e) => {
  if (!insertModalContent?.contains(e.target)) {
    insertModal.classList.add('hidden')
  }
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    insertModal?.classList.add('hidden')
  }
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
  loadPayables()

  window.addEventListener('resize', () => {
    const nextLayout = getLayoutMode()

    if (nextLayout !== currentLayout) {
      currentLayout = nextLayout
      applyAllFilters()
    }
  })
})

