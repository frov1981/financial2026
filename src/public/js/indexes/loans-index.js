/* ============================
   Variables globales
============================ */
const API_BASE = '/api/loans'
const FILTER_KEY = `loans.filters.${window.USER_ID}`
const SELECTED_KEY = `loans.selected.${window.USER_ID}`

let allLoans = []

/* ============================
   DOM
============================ */
const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')
const searchBtn = document.getElementById('search-btn')
const tableBody = document.getElementById('loans-table')

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

const formatDate = value =>
  value ? new Date(value).toLocaleDateString('es-EC') : '-'


/* ============================ 
   Render
============================ */
function renderRow(loan) {
  const rowClass = loan.status === 'active' ? '' : 'bg-red-50'
  return `    
    <tr id="loan-${loan.id}" class="${rowClass}">
      <td class="ui-td col-left">${loan.name}</td>
      <td class="ui-td col-right">${amountBox(loan.total_amount)}</td>
      <td class="ui-td col-right col-sm">${amountBox(loan.interest_amount)}</td>
      <td class="ui-td col-right">${amountBox(loan.balance)}</td>
      <td class="ui-td col-left col-sm">${formatDate(loan.start_date)}</td>
      <td class="ui-td col-left col-sm">${statusTag(loan.is_active)}</td>
      <td class="ui-td col-left col-sm">${loan.disbursement_account.name}</td>
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button
            class="icon-btn edit"
            title="Editar"
            onclick="goToLoanUpdate(${loan.id})">
            ${iconEdit()}
            <span class="ui-btn-text">Editar</span>
          </button>

          <button
            class="icon-btn delete"
            title="Eliminar"
            onclick="goToLoanDelete(${loan.id})">
            ${iconDelete()}
            <span class="ui-btn-text">Eliminar</span>
          </button>

          <button
            class="icon-btn"
            title="Detalles"
            onclick="goToLoanView(${loan.id})">
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

  const selected = loadFilters(SELECTED_KEY)
  if (selected?.id) {
    const row = document.getElementById(`loan-${selected.id}`)
    if (row) {
      row.classList.add('tr-selected')
    }
  }
}

/* ============================
   Data
============================ */
async function loadLoans() {
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

const debouncedFilter = debounce(filterLoans, 300)

/* ============================
   Acciones (GLOBAL)
============================ */
function goToLoanUpdate(id) {
  window.location.href = `/loans/update/${id}`
}

function goToLoanDelete(id) {
  window.location.href = `/loans/delete/${id}`
}

function goToLoanView(id) {
  window.location.href = `/loans/${id}`
  "location.href='/loans/${loan.id}'"
}

/* ============================
   Eventos
============================ */
searchBtn.addEventListener('click', filterLoans)

searchInput.addEventListener('input', () => {
  clearBtn.classList.toggle('hidden', !searchInput.value)
  debouncedFilter()
})

clearBtn.addEventListener('click', () => {
  searchInput.value = ''
  clearBtn.classList.add('hidden')
  clearFilters(FILTER_KEY)
  clearFilters(SELECTED_KEY)
  renderTable(allLoans)
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

    const row = event.target.closest('tr[id^="loan-"]')
    if (!row) return

    document
      .querySelectorAll('#loans-table tr')
      .forEach(tr => tr.classList.remove('tr-selected'))

    row.classList.add('tr-selected')

    // guardar selección
    const loanId = row.id.replace('loan-', '')
    saveFilters(SELECTED_KEY, { id: loanId })
  })

/* ============================
   Init
============================ */
loadLoans()
