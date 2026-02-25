/* ============================================================================
1. Constantes globales
2. Variables de estado
3. Selectores DOM
4. Utils generales
5. Render helpers (iconos, tags, cajas)
6. Render Desktop / Mobile
7. Render principal
8. Data (loadCategories)
9. Filtros (texto + estado)
10. Status Filter UI
11. Acciones (redirects / selects)
12. Eventos
13. Scroll
14. Init
============================================================================ */

/* ============================
   1. Constantes globales
============================ */
const API_BASE = '/categories/list'
const FILTER_KEY = `categories.filters.${window.USER_ID}`
const SELECTED_KEY = `categories.selected.${window.USER_ID}`
const SCROLL_KEY = `categories.scroll.${window.USER_ID}`
const STATUS_FILTER_KEY = `categories.statusFilter.${window.USER_ID}`
const COLLAPSE_KEY = `categories.collapse.${window.USER_ID}`

/* ============================
   2. Variables de estado
============================ */
let allCategories = []

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
const tableBody = document.getElementById('categories-table')
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

function isCategoryCollapsed(parentId) {
  const state = loadFilters(COLLAPSE_KEY) || {}
  return !!state[parentId]
}

function toggleCategoryCollapse(parentId) {
  const state = loadFilters(COLLAPSE_KEY) || {}
  state[parentId] = !state[parentId]
  saveFilters(COLLAPSE_KEY, state)
  applyAllFilters()
}

function getParentBackgroundColor(index, total) {
  if (total <= 1) return 'hsl(210, 40%, 96%)'

  const startLightness = 96
  const endLightness = 88
  const step = (startLightness - endLightness) / (total - 1)

  const lightness = startLightness - (step * index)

  return `hsl(140, 35%, ${lightness}%)`
}

/* ============================
   5. Render helpers
============================ */
// iconEdit()
// iconDelete()
// iconView()
// iconViewOff()
// iconList()
// numberBox()
// statusTag()
// categoryTypeTag()

/* ============================
   6. Render Desktop / Mobile
============================ */
function renderRow(category) {
  const isParent = false
  const isChild = true

  const collapsed = isCategoryCollapsed(category.category_group.id)

  if (collapsed) {
    return ''
  }

  const rowClass = category.is_active ? '' : 'bg-red-50'

  const statusButton = category.is_active
    ? `
      <button 
        class="icon-btn deactivate" 
        onclick="goToCategoryUpdateStatus(${category.id})">
        ${iconViewOff()}
        <span class="ui-btn-text">Desactivar</span>
      </button>
    `
    : `
      <button 
        class="icon-btn activate" 
        onclick="goToCategoryUpdateStatus(${category.id})">
        ${iconView()}
        <span class="ui-btn-text">Activar</span>
      </button>
    `

  return `
    <tr id="category-${category.id}" class="${rowClass}">
      <td class="ui-td col-left">
        <div class="child-cell">
          <span class="child-indent"></span>
          <span class="child-name">${category.name}</span>
        </div>
      </td>
      <td class="ui-td col-left">${categoryTypeTag(category.type)}</td>
      <td class="ui-td col-right">${numberBox(category.transactions_count)}</td>
      <td class="ui-td col-left">${statusTag(category.is_active)}</td>
      
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button 
            class="icon-btn edit" 
            onclick="goToCategoryUpdate(${category.id})">
            ${iconEdit()}
            <span class="ui-btn-text">Editar</span>
          </button>
          <button 
            class="icon-btn delete" 
            onclick="goToCategoryDelete(${category.id})">
            ${iconDelete()}
            <span class="ui-btn-text">Eliminar</span>
          </button>
          ${statusButton}
          <button 
            class="icon-btn"
            onclick="goToCategoryList(${category.id})">
            ${iconList()}
            <span class="ui-btn-text">Transacciones</span>
          </button> 
        </div>
      </td>
    </tr>
  `
}

function renderCard(category) {
  const collapsed = isCategoryCollapsed(category.category_group.id)

  if (collapsed) {
    return ''
  }

  const statusButton = category.is_active
    ? `
      <button 
        class="icon-btn deactivate"
        onclick="event.stopPropagation(); goToCategoryUpdateStatus(${category.id})">
        ${iconViewOff()}
      </button>
    `
    : `
      <button 
        class="icon-btn activate"
        onclick="event.stopPropagation(); goToCategoryUpdateStatus(${category.id})">
        ${iconView()}
      </button>
    `

  return `
    <div 
      class="category-card ${category.is_active ? '' : 'inactive'}"
      data-id="${category.id}"
      onclick="selectCategoryCard(event, ${category.id})">
      <div class="card-header">
        <div class="card-title">
          ${category.name}
        </div>
        <div class="card-actions">
          <button 
            class="icon-btn edit"
            onclick="event.stopPropagation(); goToCategoryUpdate(${category.id})">
            ${iconEdit()}
          </button>
          <button 
            class="icon-btn delete"
            onclick="event.stopPropagation(); goToCategoryDelete(${category.id})">
            ${iconDelete()}
          </button> 
          ${statusButton}
          <button 
            class="icon-btn"
            onclick="event.stopPropagation(); goToCategoryList(${category.id})">
            ${iconList()}
          </button> 
        </div>
      </div>

      <div class="card-footer">
        <span class="card-meta">
          ${numberBox(category.transactions_count)} trx
        </span>

        <div class="card-tags">
          ${categoryTypeTag(category.type)}
          ${statusTag(category.is_active)}
        </div>
      </div>
    </div>
  `
}

/* ============================
   7. Render principal
============================ */
function renderTable(data) {
  const selected = loadFilters(SELECTED_KEY)

  if (!data.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="ui-td col-center text-gray-500">
          No se encontraron categorías
        </td>
      </tr>
    `
    restoreScroll()
    return
  }

  const groupsMap = new Map()

  data.forEach(cat => {
    const g = cat.category_group
    if (!groupsMap.has(g.id)) {
      groupsMap.set(g.id, { group: g, items: [] })
    }
    groupsMap.get(g.id).items.push(cat)
  })

  const groups = Array.from(groupsMap.values())

  const html = groups.map(({ group, items }, index) => {
    const collapsed = isCategoryCollapsed(group.id)

    const parentRow = `
      <tr class="parent-row">
        <td class="ui-td col-left">
          <div class="group-cell">
            <button class="group-toggle" onclick="toggleCategoryCollapse(${group.id})">
              ${collapsed ? iconChevronOpen() : iconChevronClose()}
            </button>
            <span class="group-name">${group.name}</span>
          </div>
        </td>
        <td class="ui-td col-left"></td>
        <td class="ui-td col-right col-sm"></td>
        <td class="ui-td col-left col-sm"></td>
        <td class="ui-td col-center"></td>
      </tr>
    `

    const childRows = collapsed ? '' : items.map(c => renderRow(c)).join('')

    return parentRow + childRows
  }).join('')

  tableBody.innerHTML = html

  if (selected?.id) {
    document
      .getElementById(`category-${selected.id}`)
      ?.classList.add('tr-selected')
  }

  restoreScroll()
}

function renderCards(data) {
  const container = document.getElementById('categories-mobile')
  if (!container) return

  const groupsMap = new Map()

  data.forEach(cat => {
    const g = cat.category_group
    if (!groupsMap.has(g.id)) {
      groupsMap.set(g.id, { group: g, items: [] })
    }
    groupsMap.get(g.id).items.push(cat)
  })

  const groups = Array.from(groupsMap.values())
  const totalParents = groups.length

  const html = groups.map(({ group, items }, index) => {
    const collapsed = isCategoryCollapsed(group.id)
    const bgColor = getParentBackgroundColor(index, totalParents)

    const childCards = collapsed ? '' : items.map(c => renderCard(c)).join('')

    return `
      <div class="category-group ${collapsed ? 'collapsed' : ''}" style="background: ${bgColor};">
        <div class="category-group-header">
          <button onclick="toggleCategoryCollapse(${group.id})">
            ${collapsed ? iconChevronOpen() : iconChevronClose()}
          </button>
          ${group.name}
        </div>
        <div class="category-group-body">
          ${childCards}
        </div>
      </div>
    `
  }).join('')

  container.innerHTML = html
  restoreScroll()
}

function render(data) {
  window.innerWidth <= 768
    ? renderCards(data)
    : renderTable(data)
}

/* ============================
   8. Data
============================ */
async function loadCategories() {
  const res = await fetch(API_BASE)
  allCategories = await res.json()

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
function getFilteredCategories() {
  const cached = loadFilters(FILTER_KEY)
  const statusCached = loadFilters(STATUS_FILTER_KEY)

  const term = cached?.term?.toLowerCase() || ''
  const status = statusCached?.status || 'all'

  return allCategories.filter(category => {
    const matchText =
      !term ||
      category.name.toLowerCase().includes(term) ||
      category.type.toLowerCase().includes(term)

    const matchStatus =
      status === 'all' ||
      (status === 'active' && category.is_active) ||
      (status === 'inactive' && !category.is_active)

    return matchText && matchStatus
  })
}

function applyAllFilters() {
  const filtered = getFilteredCategories()
  render(filtered)
}

function filterCategories() {
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

/* ============================
   11. Acciones
============================ */
function goToCategoryUpdateStatus(id) {
  location.href = `/categories/status/${id}`
}

function goToCategoryUpdate(id) {
  location.href = `/categories/update/${id}`
}

function goToCategoryDelete(id) {
  location.href = `/categories/delete/${id}`
}

function goToCategoryList(id) {
  location.href = `/transactions?category_id=${id}&from=categories`
}

function selectCategoryCard(event, id) {
  if (event.target.closest('button')) return

  document
    .querySelectorAll('.category-card')
    .forEach(c => c.classList.remove('card-selected'))

  event.currentTarget.classList.add('card-selected')
  saveFilters(SELECTED_KEY, { id })
}

/* ============================
   12. Eventos
============================ */
const debouncedFilter = debounce(filterCategories, 300)

searchBtn?.addEventListener('click', filterCategories)

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
  loadCategories()

  window.addEventListener('resize', () => {
    const nextLayout = getLayoutMode()

    if (nextLayout !== currentLayout) {
      currentLayout = nextLayout
      applyAllFilters()
    }
  })
})
