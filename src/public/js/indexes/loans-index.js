/* ============================
   Variables globales
============================ */
const API_BASE = '/api/loans'
const FILTER_KEY = `loans.filters.${window.USER_ID}`
const SELECTED_KEY = `loans.selected.${window.USER_ID}`
const SCROLL_KEY = `loans.scroll.${window.USER_ID}`

let allLoans = []

/* ============================
   DOM
============================ */
const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')
const searchBtn = document.getElementById('search-btn')
const tableBody = document.getElementById('loans-table')
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

const formatDate = value =>
  value ? new Date(value).toLocaleDateString('es-EC') : '-'

/* ============================
   Render - Desktop
============================ */
function renderRow(loan) {
  const rowClass = loan.is_active ? '' : 'bg-red-50'

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
          <!-- Botón Editar -->
          <button 
            class="icon-btn edit" 
            onclick="goToLoanUpdate(${loan.id})">
            ${iconEdit()}
            <span class="ui-btn-text">Editar</span>
          </button>
          <!-- Botón Eliminar -->
          <button 
            class="icon-btn delete" 
            onclick="goToLoanDelete(${loan.id})">
            ${iconDelete()}
            <span class="ui-btn-text">Eliminar</span>
          </button>
          <!-- Botón Ver -->
          <button 
            class="icon-btn" 
            onclick="goToLoanView(${loan.id})">
            ${iconList()}
            <span class="ui-btn-text">Detalles</span>
          </button>
        </div>
      </td>
    </tr>
  `
}

/* ============================
   Render - Mobile
============================ */
function renderCard(loan) {
  return `
    <div class="loan-card ${loan.is_active ? '' : 'inactive'}"
         data-id="${loan.id}"
         onclick="selectLoanCard(event, ${loan.id})">

      <div class="card-header">
        <div class="card-title">${loan.name}</div>

        <div class="card-actions">
          <button class="icon-btn edit"
            onclick="event.stopPropagation(); goToLoanUpdate(${loan.id})">
            ${iconEdit()}
          </button>
          <button class="icon-btn delete"
            onclick="event.stopPropagation(); goToLoanDelete(${loan.id})">
            ${iconDelete()}
          </button>
          <button class="icon-btn"
            onclick="event.stopPropagation(); goToLoanView(${loan.id})">
            ${iconList()}
          </button>
        </div>
      </div>

      <div class="card-balance">
        ${amountBox(loan.balance)}
      </div>

      <div class="card-sub">
        Monto: ${amountBox(loan.total_amount)} · Interés: ${amountBox(loan.interest_amount)}
      </div>

      <div class="card-footer">
        <span>${formatDate(loan.start_date)}</span>
        <div class="card-tags">
          ${statusTag(loan.is_active)}
          <span>${loan.disbursement_account.name}</span>
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
        <td colspan="8" class="ui-td col-center text-gray-500">
          No se encontraron prestamos
        </td>
      </tr>
    `

    restoreScroll()
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

  restoreScroll()
}

function renderCards(data) {
  const container = document.getElementById('loans-mobile')
  if (!container) return

  container.innerHTML = data.length
    ? data.map(renderCard).join('')
    : `<div class="ui-empty">No se encontraron préstamos</div>`

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
async function loadLoans() {
  const res = await fetch(API_BASE)
  allLoans = await res.json()

  const cached = loadFilters(FILTER_KEY)
  if (cached?.term) {
    searchInput.value = cached.term
    clearBtn.classList.remove('hidden')
    filterLoans()
  } else {
    render(allLoans)
  }
}

/* ============================
   Filtro
============================ */
function filterLoans() {
  const term = searchInput.value.trim().toLowerCase()
  saveFilters(FILTER_KEY, { term })
  saveFilters(SCROLL_KEY, { y: 0 })

  render(
    !term
      ? allLoans
      : allLoans.filter(l =>
        l.name.toLowerCase().includes(term)
      )
  )
}

const debouncedFilter = debounce(filterLoans, 300)

/* ============================
   Acciones
============================ */
function goToLoanUpdate(id) {
  location.href = `/loans/update/${id}`
}

function goToLoanDelete(id) {
  location.href = `/loans/delete/${id}`
}

function goToLoanView(id) {
  location.href = `/loans/${id}`
}

function selectLoanCard(event, id) {
  if (event.target.closest('button')) {
    return
  }

  document.querySelectorAll('.loan-card').forEach(card => card.classList.remove('card-selected'))
  const card = event.currentTarget
  card.classList.add('card-selected')

  saveFilters(SELECTED_KEY, { id })
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

  render(allLoans)
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
loadLoans()
window.addEventListener('resize', () => render(allLoans))
