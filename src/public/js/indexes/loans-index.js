/* ============================
   Variables globales
============================ */
const API_BASE = '/api/loans'
const FILTER_KEY = `loans.filters.${window.USER_ID}`

let allLoans = []

/* ============================
   DOM
============================ */
const tableBody = document.getElementById('loans-table')
const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')

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

const formatAmount = value =>
  Number(value).toLocaleString('es-EC', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

const formatDate = value =>
  value ? new Date(value).toLocaleDateString('es-EC') : '-'

const renderStatus = status =>
  status === 'closed'
    ? '<span class="text-green-600 font-semibold">Cerrado</span>'
    : '<span class="text-blue-600 font-semibold">Activo</span>'


/* ============================ 
   Render
============================ */
function renderRow(loan) {
  const rowClass = loan.status === 'active' ? '' : 'bg-red-50'
  return `    
    <tr class="${rowClass}">
      <td class="ui-td col-left">${loan.name}</td>
      <td class="ui-td col-right">${formatAmount(loan.total_amount)}</td>
      <td class="ui-td col-right col-sm">${formatAmount(loan.interest_amount)}</td>
      <td class="ui-td col-right">${formatAmount(loan.balance)}</td>
      <td class="ui-td col-left col-sm">${formatDate(loan.start_date)}</td>
      <td class="ui-td col-left col-sm">${renderStatus(loan.status)}</td>
      <td class="ui-td col-left col-sm">${loan.disbursement_account.name}</td>
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button
            class="icon-btn edit"
            title="Editar"
            onclick="location.href='/loans/update/${loan.id}'">
            ${iconEdit()}
            <span class="ui-btn-text">Editar</span>
          </button>

          <button
            class="icon-btn delete"
            title="Eliminar"
            onclick="location.href='/loans/delete/${loan.id}'">
            ${iconDelete()}
            <span class="ui-btn-text">Eliminar</span>
          </button>

          <button
            class="icon-btn"
            title="Detalles"
            onclick="location.href='/loans/${loan.id}'">
            ${iconList()}
            <span class="ui-btn-text">Detalles</span>
          </button>
        </div>
      </td>
    </tr>
  `
}

function renderTable(data) {
  if (!data.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="8" class="ui-td col-center text-gray-500">
          No se encontraron préstamos
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
async function loadLoans() {
  try {
    const res = await fetch(API_BASE)
    allLoans = await res.json()

    const cached = loadFilters(FILTER_KEY)
    if (cached?.term) {
      searchInput.value = cached.term
      clearBtn.classList.remove('hidden')
      filterLoans()
    } else {
      renderTable(allLoans)
    }
  } catch (error) {
    console.error('Error al cargar préstamos', error)
  }
}

/* ============================
   Filtro
============================ */
function filterLoans() {
  const term = searchInput.value.trim().toLowerCase()
  saveFilters(FILTER_KEY, { term })

  renderTable(
    !term
      ? allLoans
      : allLoans.filter(l =>
        l.name.toLowerCase().includes(term) ||
        l.status.toLowerCase().includes(term)
      )
  )
}

/* ============================
   Eventos
============================ */
searchInput.addEventListener('input', debounce(filterLoans, 300))

clearBtn.addEventListener('click', () => {
  searchInput.value = ''
  clearFilters(FILTER_KEY)
  renderTable(allLoans)
})

/* ============================
   Init
============================ */
loadLoans()
