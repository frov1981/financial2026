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
  console.log(category)
  const rowClass = category.is_active ? '' : 'bg-red-50'
  const statusButton = category.is_active
    ? `
      <button
        class="icon-btn deactivate"
        title="Desactivar"
        onclick="updateCategoryStatus(${category.id})">
        ${iconViewOff()}
        <span class="ui-btn-text">Desactivar</span>
      </button>
    `
    : `
      <button
        class="icon-btn activate"
        title="Activar"
        onclick="updateCategoryStatus(${category.id})">
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
            onclick="window.location.href='/categories/update/${category.id}'">
            ${iconEdit()} 
            <span class="ui-btn-text">Editar</span>
          </button>

          <!-- Botón Eliminar -->
          <button
            class="icon-btn delete"
            title="Eliminar"
            onclick="window.location.href='/categories/delete/${category.id}'">
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

function renderTable(data) {
  if (!data.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="ui-td col-center text-gray-500">
          No se encontraron categorías
        </td>
      </tr>
    `
    return
  }

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
