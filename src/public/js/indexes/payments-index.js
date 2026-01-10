/* ============================
   Variables globales
============================ */
const API_BASE = `/api/payments/${window.LOAN_ID}`
const FILTER_KEY = `payments.filters.${window.USER_ID}.${window.LOAN_ID}`

let allPayments = []

/* ============================
   DOM
============================ */
const tableBody = document.getElementById('payments-table')
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
  new Date(value).toLocaleDateString('es-EC')

/* ============================
   Render
============================ */
function renderRow(p) {
  return `
    <tr>
      <td class="ui-td col-left">
        ${formatDate(p.payment_date)}
      </td>

      <td class="ui-td col-right">
        ${formatAmount(p.principal_amount)}
      </td>

      <td class="ui-td col-right">
        ${formatAmount(p.interest_amount)}
      </td>

      <td class="ui-td col-left col-sm">
        ${p.account?.name || '-'}
      </td>

      <td class="ui-td col-center">
        <div class="icon-actions">

          <button
            class="icon-btn edit"
            title="Editar"
            onclick="location.href='/payments/update/${p.id}'">
            ${iconEdit()}
            <span class="ui-btn-text">Editar</span>
          </button>

          <button
            class="icon-btn delete"
            title="Eliminar"
            onclick="location.href='/payments/delete/${p.id}'">
            ${iconDelete()}
            <span class="ui-btn-text">Eliminar</span>
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
        <td colspan="4" class="ui-td col-center text-gray-500">
          No se encontraron pagos
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
async function loadPayments() {
  const res = await fetch(API_BASE)
  allPayments = await res.json()

  const cached = loadFilters(FILTER_KEY)
  if (cached?.term) {
    searchInput.value = cached.term
    clearBtn.classList.remove('hidden')
    filterPayments()
  } else {
    renderTable(allPayments)
  }
}

/* ============================
   Filtro
============================ */
function filterPayments() {
  const term = searchInput.value.trim().toLowerCase()
  saveFilters(FILTER_KEY, { term })

  renderTable(
    !term
      ? allPayments
      : allPayments.filter(p =>
          p.account?.name.toLowerCase().includes(term) ||
          p.note?.toLowerCase().includes(term)
        )
  )
}

/* ============================
   Eventos
============================ */
searchInput.addEventListener('input', debounce(filterPayments, 300))

clearBtn.addEventListener('click', () => {
  searchInput.value = ''
  clearFilters(FILTER_KEY)
  renderTable(allPayments)
})

/* ============================
   Init
============================ */
loadPayments()
