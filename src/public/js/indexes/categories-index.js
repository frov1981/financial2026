/* ============================
   Variables globales
============================ */
const API_BASE = '/api/categories'
const FILTER_KEY = `categories.filters.${window.USER_ID}`
const SELECTED_KEY = `categories.selected.${window.USER_ID}`
const SCROLL_KEY = `categories.scroll.${window.USER_ID}`

let allCategories = []

/* ============================
   DOM
============================ */
const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')
const searchBtn = document.getElementById('search-btn')
const tableBody = document.getElementById('categories-table')
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
   Render
============================ */
function renderRow(category) {
  const rowClass = category.is_active ? '' : 'bg-red-50'
  const statusButton = category.is_active
    ? `
      <button
        class="icon-btn deactivate"
        title="Desactivar"
        onclick="goToCategoryUpdateStatus(${category.id})">
        ${iconViewOff()}
        <span class="ui-btn-text">Desactivar</span>
      </button>
    `
    : `
      <button
        class="icon-btn activate"
        title="Activar"
        onclick="goToCategoryUpdateStatus(${category.id})">
        ${iconView()}
        <span class="ui-btn-text">Activar</span>
      </button>
    `

  return `
    <tr id="category-${category.id}" class="${rowClass}">
      <td class="ui-td col-left">${category.name}</td>
      <td class="ui-td col-left">${categoryTypeTag(category.type)}</td>
      <td class="ui-td col-right ui-col-sm">${numberBox(category.transactions_count)}</td>
      <td class="ui-td col-left ui-col-sm">${statusTag(category.is_active)}</td>
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button
            class="icon-btn edit"
            title="Editar"
            onclick="goToCategoryUpdate(${category.id})">
            ${iconEdit()} 
            <span class="ui-btn-text">Editar</span>
          </button>

          <!-- Botón Eliminar -->
          <button
            class="icon-btn delete"
            title="Eliminar"
            onclick="goToCategoryDelete(${category.id})">
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
        <span>${numberBox(category.transactions_count)} trx</span>
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
   Render helpers
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
    const row = document.getElementById(`category-${selected.id}`)
    if (row) {
      row.classList.add('tr-selected')
    }
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
async function loadCategories() {
  const res = await fetch(API_BASE)
  allCategories = await res.json()

  const cached = loadFilters(FILTER_KEY)
  if (cached?.term) {
    searchInput.value = cached.term
    clearBtn.classList.remove('hidden')
    filterCategories()
  } else {
    render(allCategories)
  }
}

/* ============================
   Filtro
============================ */
function filterCategories() {
  const term = searchInput.value.trim().toLowerCase()
  saveFilters(FILTER_KEY, { term })
  saveFilters(SCROLL_KEY, { y: 0 })

  render(
    !term
      ? allCategories
      : allCategories.filter(c =>
        c.name.toLowerCase().includes(term) ||
        c.type.toLowerCase().includes(term)
      )
  )
}

const debouncedFilter = debounce(filterCategories, 300)

/* ============================
   Acciones (GLOBAL)
============================ */
function goToCategoryUpdateStatus(id) {
  location.href = `/categories/status/${id}`
}

function goToCategoryUpdate(id) {
  window.location.href = `/categories/update/${id}`
}

function goToCategoryDelete(id) {
  window.location.href = `/categories/delete/${id}`
}

function selectCategoryCard(event, id) {
  if (event.target.closest('button')) {
    return
  }

  document.querySelectorAll('.category-card').forEach(card => card.classList.remove('card-selected'))
  const card = event.currentTarget
  card.classList.add('card-selected')

  saveFilters(SELECTED_KEY, { id })
}

/* ============================
   Eventos
============================ */
searchBtn.addEventListener('click', filterCategories)

searchInput.addEventListener('input', () => {
  clearBtn.classList.toggle('hidden', !searchInput.value)
  debouncedFilter()
})

clearBtn.addEventListener('click', () => {
  searchInput.value = ''
  clearBtn.classList.add('hidden')
  clearFilters(FILTER_KEY)
  clearFilters(SELECTED_KEY)
  renderTable(allCategories)
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

    const row = event.target.closest('tr[id^="category-"]')
    if (!row) return

    document
      .querySelectorAll('#categories-table tr')
      .forEach(tr => tr.classList.remove('tr-selected'))

    row.classList.add('tr-selected')

    // guardar selección
    const categoryId = row.id.replace('category-', '')
    saveFilters(SELECTED_KEY, { id: categoryId })
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
loadCategories()
window.addEventListener('resize', () => render(allCategories))

