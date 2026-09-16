const API_BASE = '/receivables/list'
const FILTER_KEY = `receivables.filters.${window.USER_ID}`
const SELECTED_KEY = `receivables.selected.${window.USER_ID}`
const SCROLL_KEY = `receivables.scroll.${window.USER_ID}`
const COLLAPSE_KEY = `receivables.collapse.${window.USER_ID}`

let allReceivables = []

function getLayoutMode() {
  const w = window.innerWidth
  if (w >= 1024) return 'desktop'
  if (w >= 769) return 'tablet'
  return 'mobile'
}

let currentLayout = getLayoutMode()

const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')
const searchBtn = document.getElementById('search-btn')
const tableBody = document.getElementById('receivables-table')
const scrollContainer = document.querySelector('.ui-scroll-area')
const mobileContainer = document.getElementById('receivables-mobile')

const newBtn = document.querySelector('[data-btn="new"]')
const insertModal = document.getElementById('insert-modal')
const insertModalContent = document.getElementById('insert-modal-content')
const insertGroupBtn = document.getElementById('insert-group')
const insertChildBtn = document.getElementById('insert-child')
const closeInsertModalBtn = document.getElementById('close-modal')

function debounce(fn, delay) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), delay)
  }
}

function loadFilters() {
  try {
    return JSON.parse(localStorage.getItem(FILTER_KEY) || '{}')
  } catch {
    return {}
  }
}

function saveFilters(value) {
  localStorage.setItem(FILTER_KEY, JSON.stringify(value))
}

function isReceivableGroupCollapsed(groupId) {
  const state = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}') || {}
  return !!state[groupId]
}

function toggleReceivableGroupCollapse(groupId) {
  const state = JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}') || {}
  state[groupId] = !state[groupId]
  localStorage.setItem(COLLAPSE_KEY, JSON.stringify(state))
  applyAllFilters()
}

function getGroupPendingTotal(group_id) {
  if (!window.groupTotals) return 0
  const g = window.groupTotals.find(x => x.receivable_group_id === group_id)
  return g ? g.total_balance : 0
}

function getParentBackgroundColor(index, total) {
  if (total <= 1) return 'hsl(210, 40%, 96%)'

  const startLightness = 96
  const endLightness = 88
  const step = (startLightness - endLightness) / (total - 1)

  const lightness = startLightness - (step * index)

  return `hsl(140, 35%, ${lightness}%)`
}

function getSearchText() {
  const filters = loadFilters()
  return (filters.search || '').toLowerCase()
}

function renderRow(receivable) {
  const { date, weekday } = formatDateTime(receivable.start_date || new Date())
  const group_id = receivable.receivable_group ? receivable.receivable_group.id : null
  if (group_id && isReceivableGroupCollapsed(group_id)) return ''

  const rowClass = receivable.is_active ? '' : 'bg-red-50'
  return `
    <tr id="receivable-${receivable.id}" class="${rowClass}">
      <td class="ui-td col-left">
        <div class="child-cell">
          <span class="child-indent"></span>
          <div class="payable-name-block">
            <div class="payable-name">${receivable.name}</div>
            <div class="payable-date">${date} · ${weekday}</div>
          </div>
        </div>
      </td>
      <td class="ui-td col-right">${amountBox(receivable.total_amount)}</td>
      <td class="ui-td col-right">${amountBox(receivable.principal_received)}</td>
      <td class="ui-td col-right">${amountBox(receivable.interest_received)}</td>
      <td class="ui-td col-right">${amountBox(receivable.balance)}</td>
      <td class="ui-td col-left">${statusTag(receivable.is_active)}</td>
      <td class="ui-td col-left">${receivable.disbursement_account ? receivable.disbursement_account.name : '-'}</td>
      <td class="ui-td col-left">${receivable.category ? receivable.category.name : '-'}</td>
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button class="icon-btn edit" onclick="goToReceivableUpdate(${receivable.id})">${iconEdit()}<span class="ui-btn-text">Editar</span></button>
          <button class="icon-btn delete" onclick="goToReceivableDelete(${receivable.id})">${iconDelete()}<span class="ui-btn-text">Eliminar</span></button>
          <button class="icon-btn" onclick="goToReceivableView(${receivable.id})">${iconList()}<span class="ui-btn-text">Cobros</span></button>
        </div>
      </td>
    </tr>
  `
}

function renderCard(receivable) {
  const group_id = receivable.receivable_group ? receivable.receivable_group.id : null
  if (group_id && isReceivableGroupCollapsed(group_id)) return ''

  return `
    <div class="payable-card ${receivable.is_active ? '' : 'inactive'}" data-id="${receivable.id}">
      <div class="card-header">
        <div class="card-title">${receivable.name}</div>
        <div class="card-actions">
          <button class="icon-btn edit" onclick="event.stopPropagation(); goToReceivableUpdate(${receivable.id})">${iconEdit()}</button>
          <button class="icon-btn delete" onclick="event.stopPropagation(); goToReceivableDelete(${receivable.id})">${iconDelete()}</button>
          <button class="icon-btn" onclick="event.stopPropagation(); goToReceivableView(${receivable.id})">${iconList()}</button>
        </div>
      </div>
      <div class="card-balance">${amountBox(receivable.balance)}</div>
      <div class="card-sub payable-amounts">
        <div class="payable-amount-item"><div class="payable-amount-title">Monto</div><div class="payable-amount-value">${amountBox(receivable.total_amount)}</div></div>
        <div class="payable-amount-item"><div class="payable-amount-title">Capital</div><div class="payable-amount-value">${amountBox(receivable.principal_received)}</div></div>
        <div class="payable-amount-item"><div class="payable-amount-title">Interés</div><div class="payable-amount-value">${amountBox(receivable.interest_received)}</div></div>
      </div>
      <div class="card-footer">
        <div class="card-tags">
          <div class="tag-line">${statusTag(receivable.is_active)}</div>
          <div class="tag-line">${receivable.disbursement_account ? receivable.disbursement_account.name : '-'}</div>
          <div class="tag-line">${receivable.category ? receivable.category.name : '-'}</div>
        </div>
      </div>
    </div>
  `
}

function applyAllFilters() {
  const searchText = getSearchText()
  const filtered = allReceivables.filter(receivable => {
    const haystack = `${receivable.name} ${receivable.category ? receivable.category.name : ''} ${receivable.disbursement_account ? receivable.disbursement_account.name : ''}`.toLowerCase()
    return haystack.includes(searchText)
  })

  render(filtered)
}

function loadReceivables() {
  fetch(API_BASE)
    .then(res => res.json())
    .then(data => {
      allReceivables = data.receivables || []
      window.groupTotals = data.group_totals || []
      applyAllFilters()
    })
    .catch(err => console.error('Error loading receivables', err))
}

function updateSearchValue() {
  const filters = loadFilters()
  if (searchInput) searchInput.value = filters.search || ''
}

function bindEvents() {
  if (searchInput) {
    searchInput.addEventListener('input', debounce(event => {
      const filters = loadFilters()
      filters.search = event.target.value
      saveFilters(filters)
      applyAllFilters()
    }, 200))
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      const filters = loadFilters()
      filters.search = ''
      saveFilters(filters)
      updateSearchValue()
      applyAllFilters()
    })
  }

  window.addEventListener('resize', () => {
    const nextLayout = getLayoutMode()
    if (nextLayout !== currentLayout) {
      currentLayout = nextLayout
      applyAllFilters()
    }
  })
}

/* Modal for insert (group or child) */
function openModal() { if (insertModal) insertModal.classList.remove('hidden') }
function closeModal() { if (insertModal) insertModal.classList.add('hidden') }

if (newBtn) newBtn.addEventListener('click', (e) => { e.preventDefault(); openModal() })
if (closeInsertModalBtn) closeInsertModalBtn.addEventListener('click', () => closeModal())
if (insertGroupBtn) insertGroupBtn.addEventListener('click', () => { location.href = '/receivables-groups/insert' })
if (insertChildBtn) insertChildBtn.addEventListener('click', () => { location.href = '/receivables/insert' })
if (insertModal) insertModal.addEventListener('click', (e) => { if (!insertModalContent?.contains(e.target)) insertModal.classList.add('hidden') })

function restoreScroll() {
  const saved = JSON.parse(localStorage.getItem(SCROLL_KEY) || '{}')
  if (!saved?.y || !scrollContainer) return
  requestAnimationFrame(() => { scrollContainer.scrollTop = saved.y })
}

scrollContainer?.addEventListener('scroll', () => {
  const state = JSON.parse(localStorage.getItem(SCROLL_KEY) || '{}') || {}
  state.y = scrollContainer.scrollTop
  localStorage.setItem(SCROLL_KEY, JSON.stringify(state))
})

function renderTable(data) {
  if (!data.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="9" class="ui-td col-center text-gray-500">
          No se encontraron Cuentas por Cobrar
        </td>
      </tr>
    `
    restoreScroll()
    return
  }

  const groupsMap = new Map()

  data.forEach(r => {
    const group = r.receivable_group || { id: 0, name: 'Sin grupo' }
    if (!groupsMap.has(group.id)) {
      groupsMap.set(group.id, { group, items: [] })
    }
    groupsMap.get(group.id).items.push(r)
  })

  const html = Array.from(groupsMap.values()).map(entry => {
    const group = entry.group
    const items = entry.items
    const collapsed = isReceivableGroupCollapsed(group.id)
    const pending = getGroupPendingTotal(group.id)

    const groupRow = `
      <tr class="parent-row">
        <td class="ui-td col-left">
          <div class="group-cell">
            <button class="group-toggle" onclick="toggleReceivableGroupCollapse(${group.id})">
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
            <button class="icon-btn edit" onclick="goToReceivableGroupUpdate(${group.id})">${iconEdit()}<span class="ui-btn-text">Editar</span></button>
            <button class="icon-btn delete" onclick="goToReceivableGroupDelete(${group.id})">${iconDelete()}<span class="ui-btn-text">Eliminar</span></button>
          </div>
        </td>
      </tr>
    `

    const rows = collapsed ? '' : items.map(i => renderRow(i)).join('')
    return groupRow + rows
  }).join('')

  tableBody.innerHTML = html
  restoreScroll()
}

function renderCards(data) {
  const container = document.getElementById('receivables-mobile')
  if (!container) return

  const groupsMap = new Map()
  data.forEach(r => {
    const group = r.receivable_group || { id: 0, name: 'Sin grupo' }
    if (!groupsMap.has(group.id)) {
      groupsMap.set(group.id, { group, items: [] })
    }
    groupsMap.get(group.id).items.push(r)
  })

  const groups = Array.from(groupsMap.values())
  const totalParents = groups.length

  const html = groups.map((entry, index) => {
    const group = entry.group
    const items = entry.items
    const collapsed = isReceivableGroupCollapsed(group.id)
    const bgColor = getParentBackgroundColor(index, totalParents)
    const pending = getGroupPendingTotal(group.id)

    const cards = collapsed ? '' : items.map(i => renderCard(i)).join('')

    return `
      <div class="payable-group ${collapsed ? 'collapsed' : ''}" style="background:${bgColor};">
        <div class="payable-group-header">
          <div class="payables-group-header-left">
            <button onclick="toggleReceivableGroupCollapse(${group.id})">
              ${collapsed ? iconChevronOpen() : iconChevronClose()}
            </button>
          </div>
          <div class="payables-group-center">
            <span class="payables-group-title">${group.name}</span>
            <span class="payables-group-pending">Pendiente: ${amountBox(pending)}</span>
          </div>
          <div class="payables-group-actions">
            <button class="icon-btn edit" onclick="event.stopPropagation();goToReceivableGroupUpdate(${group.id})">${iconEdit()}</button>
            <button class="icon-btn delete" onclick="event.stopPropagation();goToReceivableGroupDelete(${group.id})">${iconDelete()}</button>
          </div>
        </div>
        <div class="payable-group-body">${cards}</div>
      </div>
    `
  }).join('')

  container.innerHTML = html
}

function render(data) {
  window.innerWidth <= 768 ? renderCards(data) : renderTable(data)
}

window.goToReceivableUpdate = function (id) { window.location.href = `/receivables/update/${id}` }
window.goToReceivableDelete = function (id) { window.location.href = `/receivables/delete/${id}` }
window.goToReceivableView = function (id) { window.location.href = `/receivables-collections/${id}/payable` }
window.goToReceivableGroupUpdate = function (id) { window.location.href = `/receivables-groups/update/${id}` }
window.goToReceivableGroupDelete = function (id) { window.location.href = `/receivables-groups/delete/${id}` }

bindEvents()
updateSearchValue()
loadReceivables()
