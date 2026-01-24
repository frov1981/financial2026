

/* ============================
   Variables globales
============================ */
const API_BASE = `/api/payments/${window.LOAN_ID}`
const FILTER_KEY = `payments.filters.${window.USER_ID}.${window.LOAN_ID}`
const SELECTED_KEY = `payments.selected.${window.USER_ID}.${window.LOAN_ID}`
const SCROLL_KEY = `payments.scroll.${window.USER_ID}.${window.LOAN_ID}`

let allPayments = []

/* ============================
   DOM
============================ */
const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')
const searchBtn = document.getElementById('search-btn')
const tableBody = document.getElementById('payments-table')
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

const formatAmount = value =>
  Number(value).toLocaleString('es-EC', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

const formatDate = value =>
  new Date(value).toLocaleDateString('es-EC')

/* ============================
   Render - Desktop
============================ */
function renderRow(payment) {
  return `
    <tr id="payment-${payment.id}">
      <td class="ui-td col-left">${formatDate(payment.payment_date)}</td>
      <td class="ui-td col-right">${formatAmount(payment.principal_amount)}</td>
      <td class="ui-td col-right">${formatAmount(payment.interest_amount)}</td>
      <td class="ui-td col-left col-sm">${payment.account?.name || '-'}</td>
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button 
            class="icon-btn edit" 
            onclick="goToPaymentUpdate(${payment.id})">
            ${iconEdit()}
            <span class="ui-btn-text">Editar</span>
          </button>
          <button 
            class="icon-btn delete" 
            onclick="goToPaymentDelete(${payment.id})">
            ${iconDelete()}
            <span class="ui-btn-text">Eliminar</span>
          </button>
        </div>
      </td>
    </tr>
  `
}

/* ============================
   Render - Mobile
============================ */
function renderCard(payment) {
  return `
    <div class="payment-card"
         data-id="${payment.id}"
         onclick="selectPaymentCard(event, ${payment.id})">

      <div class="card-header">
        <div class="card-title">
          ${formatDate(payment.payment_date)}
        </div>

        <div class="card-actions">
          <button 
            class="icon-btn edit"
            onclick="event.stopPropagation(); goToPaymentUpdate(${payment.id})">
            ${iconEdit()}
          </button>
          <button 
            class="icon-btn delete"
            onclick="event.stopPropagation(); goToPaymentDelete(${payment.id})">
            ${iconDelete()}
          </button>
        </div>
      </div>

      <div class="card-body">
        <div class="amount-main">
          ${formatAmount(payment.principal_amount)}
        </div>
        <div class="amount-sub">
          Interés: ${formatAmount(payment.interest_amount)}
        </div>
      </div>

      <div class="card-footer">
        <span>${payment.account?.name || '-'}</span>
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
          No se encontraron pagos
        </td>
      </tr>
    `

    restoreScroll()
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

  restoreScroll()
}

function renderCards(data) {
  const container = document.getElementById('payments-mobile')
  if (!container) return

  container.innerHTML = data.length
    ? data.map(renderCard).join('')
    : `<div class="ui-empty">No se encontraron pagos</div>`

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
async function loadPayments() {
  const res = await fetch(API_BASE)
  allPayments = await res.json()
  render(allPayments)

  const cached = loadFilters(FILTER_KEY)
  if (cached?.term) {
    searchInput.value = cached.term
    clearBtn.classList.remove('hidden')
    filterPayments()
  } else {
    render(allPayments)
  }
}

/* ============================
   Filtro
============================ */
function filterPayments() {
  const term = searchInput.value.trim().toLowerCase()
  saveFilters(FILTER_KEY, { term })
  saveFilters(SCROLL_KEY, { y: 0 })

  render(
    !term
      ? allPayments
      : allPayments.filter(p =>
        p.account?.name.toLowerCase().includes(term)
      )
  )
}

const debouncedFilter = debounce(filterPayments, 300)
/* ============================
   Acciones
============================ */
function goToPaymentUpdate(id) {
  location.href = `/payments/update/${id}`
}

function goToPaymentDelete(id) {
  location.href = `/payments/delete/${id}`
}

function selectPaymentCard(event, id) {
  if (event.target.closest('button')) {
    return
  }

  document.querySelectorAll('.payment-card').forEach(card => card.classList.remove('card-selected'))
  const card = event.currentTarget
  card.classList.add('card-selected')

  saveFilters(SELECTED_KEY, { id })
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
  
  render(allPayments)
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
loadPayments()
window.addEventListener('resize', () => render(allPayments))
