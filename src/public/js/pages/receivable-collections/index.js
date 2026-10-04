(() => {
const API_BASE = '/receivables-collections/list/'

const RECEIVABLE_COLLECTION_FILTERS_STORAGE_KEY = `ssrfinan:v1:user:${window.USER_ID}:receivable-collections:filters:${window.RECEIVABLE_ID}`
const RECEIVABLE_COLLECTION_SELECTED_STORAGE_KEY = `ssrfinan:v1:user:${window.USER_ID}:receivable-collections:selected-row:${window.RECEIVABLE_ID}`
const RECEIVABLE_COLLECTION_SCROLL_STORAGE_KEY = `ssrfinan:v1:user:${window.USER_ID}:receivable-collections:scroll-position:${window.RECEIVABLE_ID}`

let allCollections = []

const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')
const tableBody = document.getElementById('receivable-collections-table')
const mobileContainer = document.getElementById('receivable-collections-mobile')
const scrollContainer = document.querySelector('.ui-scroll-area')

function getLayoutMode() {
  const w = window.innerWidth
  if (w >= 1024) return 'desktop'
  if (w >= 769) return 'tablet'
  return 'mobile'
}

let currentLayout = getLayoutMode()

function debounce(fn, delay) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), delay)
  }
}

function loadCollections() {
  fetch(`${API_BASE}${window.RECEIVABLE_ID}/payable`)
    .then(res => res.json())
    .then(data => {
      allCollections = data || []
      applyFilters()
    })
    .catch(err => console.error('Error loading receivable collections', err))
}

function getSearchText() {
  const filters = loadFilters(RECEIVABLE_COLLECTION_FILTERS_STORAGE_KEY)
  return (filters?.term || '').toLowerCase()
}

function applyFilters() {
  const searchText = getSearchText()
  const filtered = allCollections.filter(collection => {
    const haystack = `${collection.note || ''} ${collection.account ? collection.account.name : ''} ${collection.category ? collection.category.name : ''}`.toLowerCase()
    return haystack.includes(searchText)
  })

  render(filtered)
}

function renderTable(data) {
  if (!tableBody) return
  if (!data.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="ui-td col-center text-gray-500">No se encontraron cobros</td>
      </tr>
    `
    restoreScroll()
    return
  }
  tableBody.innerHTML = data.map(renderRow).join('')
  const selected = loadFilters(RECEIVABLE_COLLECTION_SELECTED_STORAGE_KEY)
  if (selected?.id) {
    const row = document.getElementById(`receivable-collection-${selected.id}`)
    if (row) row.classList.add('tr-selected')
  }
  restoreScroll()
}

function renderCards(data) {
  if (!mobileContainer) return
  mobileContainer.innerHTML = data.length
    ? data.map(renderCard).join('')
    : `<div class="ui-empty">No se encontraron cobros</div>`
  const selected = loadFilters(RECEIVABLE_COLLECTION_SELECTED_STORAGE_KEY)
  if (selected?.id) {
    const card = mobileContainer.querySelector(`[data-id="${selected.id}"]`)
    if (card) card.classList.add('card-selected')
  }
  restoreScroll()
}

function render(data) {
  if (window.innerWidth <= 768) {
    // mobile
    renderCards(data)
    if (tableBody) tableBody.innerHTML = ''
  } else {
    // desktop / tablet
    renderTable(data)
    if (mobileContainer) mobileContainer.innerHTML = ''
  }
}

function renderRow(collection) {
  return `
    <tr id="receivable-collection-${collection.id}">
      <td class="ui-td col-left">${formatDateTime(collection.collection_date).date}</td>
      <td class="ui-td col-right">${amountBox(collection.principal_received)}</td>
      <td class="ui-td col-right">${amountBox(collection.interest_received)}</td>
      <td class="ui-td col-left">${collection.account ? collection.account.name : '-'}</td>
      <td class="ui-td col-left">${collection.category ? collection.category.name : '-'}</td>
      <td class="ui-td col-left">${collectionLabel(collection)}</td>
      <td class="ui-td col-center">
        <div class="icon-actions">
          <button class="icon-btn edit" onclick="goToCollectionUpdate(${collection.id})">${iconEdit()}<span class="ui-btn-text">Editar</span></button>
          <button class="icon-btn delete" onclick="goToCollectionDelete(${collection.id})">${iconDelete()}<span class="ui-btn-text">Eliminar</span></button>
        </div>
      </td>
    </tr>
  `
}

function renderCard(collection) {
  return `
    <div class="payable-card" data-id="${collection.id}">
      <div class="card-header">
        <div class="card-datetime">
          <div class="card-title">Cobro</div>
        </div>

        <div class="card-actions">
          <button class="icon-btn edit" onclick="event.stopPropagation(); goToCollectionUpdate(${collection.id})">${iconEdit()}</button>
          <button class="icon-btn delete" onclick="event.stopPropagation(); goToCollectionDelete(${collection.id})">${iconDelete()}</button>
        </div>
      </div>

      <div class="card-body payment-amounts">
        <div class="amount-item">
          <div class="amount-label">Capital</div>
          <div class="amount-value">${amountBox(collection.principal_received)}</div>
        </div>

        <div class="amount-item">
          <div class="amount-label">Interés</div>
          <div class="amount-value">${amountBox(collection.interest_received)}</div>
        </div>

        <div class="amount-item">
          <div class="amount-label">Total</div>
          <div class="amount-value">${amountBox(Number(collection.principal_received) + Number(collection.interest_received))}</div>
        </div>
      </div>

      <div class="card-footer">
        <div class="footer-left">
          <div class="footer-account">${collection.account ? collection.account.name : '-'}</div>
          <div class="footer-category">${collection.category ? collection.category.name : '-'}</div>
        </div>

        <div class="footer-right">
          <span class="footer-label">Cobro No.</span>
          <span class="footer-number">${collectionLabel(collection)}</span>
        </div>
      </div>
    </div>
  `
}

function collectionLabel(collection) {
  const principal = Number(collection.principal_received || 0)
  const collNumber = Number(collection.collection_number || 0)
  if (principal > 0 && collNumber > 0) return `${numberBox(collNumber)}`
  return 'No Aplica'
}

function bindEvents() {
  if (searchInput) {
    const savedFilters = loadFilters(RECEIVABLE_COLLECTION_FILTERS_STORAGE_KEY)
    searchInput.value = savedFilters?.term || ''
    clearBtn?.classList.toggle('hidden', !searchInput.value)
    searchInput.addEventListener('input', debounce(() => {
      const term = searchInput.value.trim()
      saveFilters(RECEIVABLE_COLLECTION_FILTERS_STORAGE_KEY, { term })
      saveFilters(RECEIVABLE_COLLECTION_SCROLL_STORAGE_KEY, { y: 0 })
      applyFilters()
    }, 200))
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = ''
      clearFilters(RECEIVABLE_COLLECTION_FILTERS_STORAGE_KEY)
      saveFilters(RECEIVABLE_COLLECTION_SCROLL_STORAGE_KEY, { y: 0 })
      applyFilters()
    })
  }

  tableBody?.addEventListener('click', event => {
    if (event.target.closest('button') || event.target.closest('a')) return
    const row = event.target.closest('tr[id^="receivable-collection-"]')
    if (!row) return

    tableBody.querySelectorAll('tr').forEach(item => item.classList.remove('tr-selected'))
    row.classList.add('tr-selected')
    saveFilters(RECEIVABLE_COLLECTION_SELECTED_STORAGE_KEY, {
      id: row.id.replace('receivable-collection-', ''),
    })
  })

  mobileContainer?.addEventListener('click', event => {
    if (event.target.closest('button') || event.target.closest('a')) return
    const card = event.target.closest('.payable-card[data-id]')
    if (!card) return

    mobileContainer.querySelectorAll('.payable-card')
      .forEach(item => item.classList.remove('card-selected'))
    card.classList.add('card-selected')
    saveFilters(RECEIVABLE_COLLECTION_SELECTED_STORAGE_KEY, { id: card.dataset.id })
  })

  scrollContainer?.addEventListener('scroll', () => {
    saveFilters(RECEIVABLE_COLLECTION_SCROLL_STORAGE_KEY, { y: scrollContainer.scrollTop })
  })
}

function restoreScroll() {
  const saved = loadFilters(RECEIVABLE_COLLECTION_SCROLL_STORAGE_KEY)
  if (!saved?.y || !scrollContainer) return

  requestAnimationFrame(() => {
    scrollContainer.scrollTop = saved.y
  })
}

window.goToCollectionUpdate = function (id) { window.location.href = `/receivables-collections/update/${id}` }
window.goToCollectionDelete = function (id) { window.location.href = `/receivables-collections/delete/${id}` }

bindEvents()
loadCollections()

window.addEventListener('resize', () => {
  const nextLayout = getLayoutMode()
  if (nextLayout !== currentLayout) {
    currentLayout = nextLayout
    applyFilters()
  }
})
})()
