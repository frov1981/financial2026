/* ============================
   Variables globales
============================ */
const API_BASE = `/api/payments/${window.LOAN_ID}`
const FILTER_KEY = `payments.filters.${window.USER_ID}.${window.LOAN_ID}`
const SELECTED_KEY = `payments.selected.${window.USER_ID}`

let allPayments = []

/* ============================
   DOM
============================ */
const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')
const searchBtn = document.getElementById('search-btn')
const tableBody = document.getElementById('payments-table')

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
    <tr id="payment-${p.id}">
      <td class="ui-td col-left">${formatDate(p.payment_date)}</td>
      <td class="ui-td col-right">${formatAmount(p.principal_amount)}</td>
      <td class="ui-td col-right">${formatAmount(p.interest_amount)}</td>
      <td class="ui-td col-left col-sm">${p.account?.name || '-'}</td>
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button
            class="icon-btn edit"
            title="Editar"
            onclick="goToPaymentUpdate(${p.id})">
            ${iconEdit()}
            <span class="ui-btn-text">Editar</span>
          </button>
          <button
            class="icon-btn delete"
            title="Eliminar"
            onclick="goToPaymentDelete(${p.id})">
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
        <td colspan="8" class="ui-td col-center text-gray-500">
          No se encontraron pagos
        </td>
      </tr>
    `
    return
  }

  tableBody.innerHTML = data.map(renderRow).join('')

  const selected = loadFilters(SELECTED_KEY)
  if (selected?.id) {
    const row = document.getElementById(`payment-${selected.id}`)
    if (row) {
      row.classList.add('tr-selected')
    }
  }
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

const debouncedFilter = debounce(filterPayments, 300)

/* ============================
   Acciones (GLOBAL) 
============================ */
function goToPaymentUpdate(id) {
  window.location.href = `/payments/update/${id}`
}

function goToPaymentDelete(id) {
  window.location.href = `/payments/delete/${id}`
}

/* ============================
   Eventos
============================ */
searchBtn.addEventListener('click', filterPayments)

searchInput.addEventListener('input', () => {
  clearBtn.classList.toggle('hidden', !searchInput.value)
  debouncedFilter()
})

clearBtn.addEventListener('click', () => {
  searchInput.value = ''
  clearBtn.classList.add('hidden')
  clearFilters(FILTER_KEY)
  clearFilters(SELECTED_KEY)
  renderTable(allPayments)
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

    const row = event.target.closest('tr[id^="payment-"]')
    if (!row) return

    document
      .querySelectorAll('#payments-table tr')
      .forEach(tr => tr.classList.remove('tr-selected'))

    row.classList.add('tr-selected')

    // guardar selección
    const paymentId = row.id.replace('payment-', '')
    saveFilters(SELECTED_KEY, { id: paymentId })
  })

/* ============================
   Init
============================ */
loadPayments()
