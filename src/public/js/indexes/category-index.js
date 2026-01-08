/* ============================
   Variables globales
============================ */
const API_BASE = '/api/categories'
const FILTER_KEY = `categories.filters.${window.USER_ID}`

let allCategories = []

/* ============================
   DOM
============================ */
const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')
const searchBtn = document.getElementById('search-btn')
const tableBody = document.getElementById('categories-table')

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
        onclick="updateCategoryStatus(${category.id})"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8"/>
          <circle cx="12" cy="12" r="3"/>
          <line x1="2" y1="2" x2="22" y2="22"/>
        </svg>
        <span class="ui-btn-text">Desactivar</span>
      </button>
    `
    : `
      <button
        class="icon-btn activate"
        title="Activar"
        onclick="updateCategoryStatus(${category.id})"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <span class="ui-btn-text">Activar</span>
      </button>
    `

  return `
    <tr id="category-${category.id}" class="${rowClass}">
      <td class="ui-td col-left">${category.name}</td>
      <td class="ui-td col-left">${categoryTypeTag(category.type)}</td>
      <td class="ui-td col-left ui-col-sm">${statusTag(category.is_active)}</td>
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button
            class="icon-btn edit"
            title="Editar"
            onclick="window.location.href='/categories/update/${category.id}'"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"/>
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>
            </svg> 
            <span class="ui-btn-text">Editar</span>
          </button>

          <!-- Botón Eliminar -->
          <button
            class="icon-btn delete"
            title="Eliminar"
            onclick="window.location.href='/categories/delete/${category.id}'">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6 17.5 20H6.5L5 6"/>
              <path d="M10 11v6"/>
              <path d="M14 11v6"/>
            </svg>
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
  tableBody.innerHTML = data.map(renderRow).join('')
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
    renderTable(allCategories)
  }
}

function filterCategories() {
  const term = searchInput.value.trim().toLowerCase()
  saveFilters(FILTER_KEY, { term })

  renderTable(
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
function updateCategoryStatus(id) {
  location.href = `/categories/status/${id}`
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
  renderTable(allCategories)
})

/* ============================
   Init
============================ */
loadCategories()
