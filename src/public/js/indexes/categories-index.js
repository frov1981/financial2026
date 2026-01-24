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
const API_BASE = '/api/categories'
const FILTER_KEY = `categories.filters.${window.USER_ID}`
const SELECTED_KEY = `categories.selected.${window.USER_ID}`
const SCROLL_KEY = `categories.scroll.${window.USER_ID}`
const STATUS_FILTER_KEY = `categories.statusFilter.${window.USER_ID}`

/* ============================
   2. Variables de estado
============================ */
let allCategories = []

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
  const rowClass = category.is_active ? '' : 'bg-red-50'

  const statusButton = category.is_active
    ? `
      <button class="icon-btn deactivate" onclick="goToCategoryUpdateStatus(${category.id})">
        ${iconViewOff()}
        <span class="ui-btn-text">Desactivar</span>
      </button>
    `
    : `
      <button class="icon-btn activate" onclick="goToCategoryUpdateStatus(${category.id})">
        ${iconView()}
        <span class="ui-btn-text">Activar</span>
      </button>
    `

  return `
    <tr id="category-${category.id}" class="${rowClass}">
      <td class="ui-td col-left">${category.name}</td>
      <td class="ui-td col-left">${categoryTypeTag(category.type)}</td>
      <td class="ui-td col-right col-sm">${numberBox(category.transactions_count)}</td>
      <td class="ui-td col-left col-sm">${statusTag(category.is_active)}</td>
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button class="icon-btn edit" onclick="goToCategoryUpdate(${category.id})">
            ${iconEdit()}
            <span class="ui-btn-text">Editar</span>
          </button>
          <button class="icon-btn delete" onclick="goToCategoryDelete(${category.id})">
            ${iconDelete()}
            <span class="ui-btn-text">Eliminar</span>
          </button>
          ${statusButton}
        </div>
      </td>
    </tr>
  `
}

function renderCard(category) {
  const statusButton = category.is_active
    ? `
      <button class="icon-btn deactivate"
        onclick="event.stopPropagation(); goToCategoryUpdateStatus(${category.id})">
        ${iconViewOff()}
      </button>
    `
    : `
      <button class="icon-btn activate"
        onclick="event.stopPropagation(); goToCategoryUpdateStatus(${category.id})">
        ${iconView()}
      </button>
    `

  return `
    <div class="category-card ${category.is_active ? '' : 'inactive'}"
         data-id="${category.id}"
         onclick="selectCategoryCard(event, ${category.id})">
      <div class="card-header">
        <div class="card-title">${category.name}</div>
        <div class="card-actions">
          <button class="icon-btn edit"
            onclick="event.stopPropagation(); goToCategoryUpdate(${category.id})">
            ${iconEdit()}
          </button>
          <button class="icon-btn delete"
            onclick="event.stopPropagation(); goToCategoryDelete(${category.id})">
            ${iconDelete()}
          </button>
          ${statusButton}
        </div>
      </div>

      <div class="card-body">
        ${numberBox(category.transactions_count)} trx
      </div>

      <div class="card-footer">
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

  tableBody.innerHTML = data.map(renderRow).join('')

  const selected = loadFilters(SELECTED_KEY)
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

  container.innerHTML = data.length
    ? data.map(renderCard).join('')
    : `<div class="ui-empty">No se encontraron categorías</div>`

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
  render(getFilteredCategories())
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
  render(allCategories)
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

    const row = event.target.closest('tr[id^="category-"]')
    if (!row) return

    document
      .querySelectorAll('#categories-table tr')
      .forEach(tr => tr.classList.remove('tr-selected'))

    row.classList.add('tr-selected')
    saveFilters(SELECTED_KEY, { id: row.id.replace('category-', '') })
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
  window.addEventListener('resize', () => render(allCategories))
})
