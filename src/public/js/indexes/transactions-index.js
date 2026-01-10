const API_BASE = '/api/transactions'
const FILTER_KEY = `transactions.filters.${window.USER_ID}`

let currentPage = 1
let currentSearch = ''
const PAGE_SIZE = 10
let totalPages = 1

const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')

function debounce(fn, delay) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), delay)
  }
}

function rowClassByType(type) {
  if (type === 'income') return 'bg-green-50'
  if (type === 'expense') return 'bg-red-50'
  if (type === 'transfer') return 'bg-purple-50'
  return ''
}

function accountCell(tx) {
  if (tx.type === 'income') {
    return `
      <div class="flex items-center gap-1 whitespace-nowrap leading-tight">
        ${iconArrowRight({ size: 4, color: '#16a34a' })}
        <span>${tx.account?.name || '-'}</span>
      </div>
    `
  }

  if (tx.type === 'expense') {
    return `
      <div class="flex items-center gap-1 whitespace-nowrap leading-tight">
        ${iconArrowLeft({ size: 4, color: '#dc2626' })}
        <span>${tx.account?.name || '-'}</span>
      </div>
    `
  }

  if (tx.type === 'transfer') {
    return `
      <div class="flex flex-col gap-0.5 leading-tight whitespace-nowrap">
        <div class="flex items-center gap-1">
          ${iconArrowLeft({ size: 3.5, color: '#dc2626' })}
          <span>${tx.account?.name || '-'}</span>
        </div>

        <div class="flex items-center gap-1">
          ${iconArrowRight({ size: 3.5, color: '#16a34a' })}
          <span>${tx.to_account?.name || '-'}</span>
        </div>
      </div>
    `
  }

  return '-'
}

function renderRow(tx) {
  const d = new Date(tx.date)
  const dateStr =
    String(d.getDate()).padStart(2, '0') + '/' +
    String(d.getMonth() + 1).padStart(2, '0') + '/' +
    d.getFullYear()
  const timeStr =
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0')

  return `
    <tr class="${rowClassByType(tx.type)}">
      <td class="px-4 py-2 text-center whitespace-nowrap leading-tight">
        <div>${dateStr}</div>
        <div class="text-xs font-semibold text-gray-600">${timeStr}</div>
      </td>
      <td class="ui-td col-left col-sm">${transactionTypeTag(tx.type)}</td>
      <td class="ui-td col-right">${amountBox(tx.amount)}</td>
      <td class="ui-td col-left">${accountCell(tx)}</td>
      <td class="ui-td col-left">${tx.category?.name || '-'}</td>
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button
            class="icon-btn edit"
            onclick="location.href='/transactions/update/${tx.id}'"
            title="Editar">
            ${iconEdit()}
            <span class="ui-btn-text">Editar</span>
          </button>

          <!-- Botón Eliminar -->
          <button
            class="icon-btn delete"
            title="Eliminar"
            onclick="window.location.href='/transactions/delete/${tx.id}'">
            ${iconDelete()}
            <span class="ui-btn-text">Eliminar</span>
          </button>
        </div>
      </td>
    </tr>
  `
}

function updatePaginationInfo() {
  const text = `Página ${currentPage} de ${totalPages}`
  document.getElementById('page-info-top').textContent = text
  document.getElementById('page-info-bottom').textContent = text
}

async function loadTransactions(page = 1) {
  const params = new URLSearchParams({ page, limit: PAGE_SIZE })
  if (currentSearch) params.append('search', currentSearch)

  const res = await fetch(`${API_BASE}?${params}`)
  const data = await res.json()

  totalPages = Math.ceil(data.total / PAGE_SIZE)
  currentPage = page

  const tableBody = document.getElementById('transactions-table')

  if (!data.items.length) {
    tableBody.innerHTML = `
    <tr>
      <td colspan="6" class="ui-td col-center text-gray-500">
        No se encontraron transacciones
      </td>
    </tr>
  `
  } else {
    tableBody.innerHTML = data.items.map(renderRow).join('')
  }


  saveFilters(FILTER_KEY, { page, search: currentSearch })
  updatePaginationInfo()
}

function applySearch() {
  currentSearch = searchInput.value.trim()
  clearBtn.classList.toggle('hidden', !currentSearch)
  loadTransactions(1)
}

const debouncedSearch = debounce(applySearch, 300)

searchInput.addEventListener('input', debouncedSearch)
clearBtn.addEventListener('click', () => {
  searchInput.value = ''
  clearBtn.classList.add('hidden')
  clearFilters(FILTER_KEY)
  loadTransactions(1)
})

  ;['top', 'bottom'].forEach(pos => {
    document.getElementById(`prev-page-${pos}`).onclick = () => {
      if (currentPage > 1) loadTransactions(currentPage - 1)
    }
    document.getElementById(`next-page-${pos}`).onclick = () => {
      if (currentPage < totalPages) loadTransactions(currentPage + 1)
    }
  })

const cached = loadFilters(FILTER_KEY)
if (cached) {
  currentPage = cached.page || 1
  currentSearch = cached.search || ''
  searchInput.value = currentSearch
  clearBtn.classList.toggle('hidden', !currentSearch)
}

loadTransactions(currentPage)
