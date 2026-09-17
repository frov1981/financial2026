/* ============================================================================
1. Constantes globales
============================================================================ */
const API_BASE = '/transactions/list'
const FILTER_KEY = `transactions.filters.${window.USER_ID}`
const SELECTED_KEY = `transactions.selected.${window.USER_ID}`
const PAGE_SIZE = 10

const context = window.TRANSACTIONS_CONTEXT || {}
const CATEGORY_ID = context.category_id || null
const SAVED_BATCH = context.saved_batch || false

/* ============================================================================
2. Variables de estado
============================================================================ */
let currentPage = 1
let currentSearch = ''
let totalPages = 1
let allItems = []
let transactionImagesState = {
  transactionId: null,
  files: [],
  currentIndex: 0,
  enlarged: false
}

/* ============================
   Layout detection (AGREGADO)
============================ */
function getLayoutMode() {
  const w = window.innerWidth

  if (w >= 1024) return 'desktop'
  if (w >= 769) return 'tablet'
  return 'mobile'
}

let currentLayout = getLayoutMode()

/* ============================================================================
3. Selectores DOM
============================================================================ */
const searchInput = document.getElementById('search-input')
const clearBtn = document.getElementById('clear-search-btn')
const searchBtn = document.getElementById('search-btn')
const tableBody = document.getElementById('transactions-table')
const table = document.querySelector('.ui-table')
const transactionImagesModal = document.getElementById('transaction-images-modal')
const transactionImagesViewer = document.getElementById('transaction-images-viewer')
const transactionImagesEmpty = document.getElementById('transaction-images-empty')
const transactionImagesCurrent = document.getElementById('transaction-images-current')
const transactionImagesPreview = document.getElementById('transaction-images-preview')
const transactionImagesCounter = document.getElementById('transaction-images-counter')
const transactionImagesPrev = document.getElementById('transaction-images-prev')
const transactionImagesNext = document.getElementById('transaction-images-next')
const transactionImagesInput = document.getElementById('transaction-images-input')
const transactionImagesInsert = document.getElementById('transaction-images-insert')
const transactionImagesDelete = document.getElementById('transaction-images-delete')
const transactionImagesClose = document.getElementById('transaction-images-close')

/* ============================================================================
4. Utils generales
============================================================================ */
function debounce(fn, delay) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), delay)
  }
}

function rowClassByType(transactionOrType) {
  // Accept either a transaction object or a bare type string
  if (!transactionOrType) return ''

  let type = ''

  if (typeof transactionOrType === 'string') {
    type = transactionOrType
  } else {
    type = transactionOrType.type || ''
  }

  if (type === 'income') return 'income'
  if (type === 'expense') return 'expense'
  if (type === 'transfer') return 'transfer'
  return ''
}

function moduleOriginClass(transaction) {
  const dt = transaction?.detailed_type || ''
  if (dt.includes('payable')) return 'payable'
  if (dt.includes('receivable')) return 'receivable'
  return ''
}

function isBatchActive() {
  if (typeof batchGetState !== 'function') return false
  const state = batchGetState()
  return !!state?.active
}

function isModuleManaged(transaction) {
  const dt = transaction?.detailed_type || ''
  return dt.includes('payable') || dt.includes('receivable')
}

function moduleOriginLabel(transaction) {
  const dt = transaction?.detailed_type || ''
  if (dt.includes('payable')) return 'Modulo de Pagos'
  if (dt.includes('receivable')) return 'Modulo de Cobros'
  return ''
}

/* ============================================================================
5. Render helpers (iconos, tags, cajas)
============================================================================ */
function hideAllTransactionDetails() {
  document.querySelectorAll('.transaction-detail-row')
    .forEach(row => row.classList.add('hidden'))
}

function showTransactionDetail(id) {
  hideAllTransactionDetails()

  const detail_row = document.getElementById(`transaction-detail-${id}`)

  if (detail_row) {
    detail_row.classList.remove('hidden')
  }
}

function showTransactionCardDetail(id) {
  document
    .querySelectorAll('.transaction-card-detail')
    .forEach(el => el.classList.add('hidden'))

  document
    .getElementById(`transaction-card-detail-${id}`)
    ?.classList.remove('hidden')
}

function transactionImagesButton(transaction) {
  const hasImages = Number(transaction.no_images) > 0
  return `
    <button
      class="icon-btn transaction-images-btn ${hasImages ? 'has-images' : 'no-images'}"
      type="button"
      title="${hasImages ? 'Ver imágenes' : 'Sin imágenes'}"
      aria-label="${hasImages ? 'Ver imágenes' : 'Sin imágenes'}"
      onclick="event.stopPropagation(); openTransactionImages(${transaction.id})">
      ${hasImages ? iconImage() : iconImageOff()}
    </button>
  `
}

function renderTable(data) {
  if (!data.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" class="ui-td col-center text-gray-500">
          No se encontraron transacciones
        </td>
      </tr>
    `
    return
  }

  tableBody.innerHTML = data.map(renderRow).join('')

  const selected = loadFilters(SELECTED_KEY)
  if (selected?.id) {
    const row = document.getElementById(`transaction-${selected.id}`)
    if (row) {
      row.classList.add('tr-selected')
      showTransactionDetail(selected.id)
    }
  }
}

function renderCards(data) {
  const container = document.getElementById('transactions-mobile')
  if (!container) return

  container.innerHTML = data.length
    ? data.map(renderCard).join('')
    : `<div class="ui-empty">No se encontraron transacciones</div>`

  const selected = loadFilters(SELECTED_KEY)
  if (selected?.id) {
    const card = container.querySelector(`[data-id="${selected.id}"]`)
    if (card) {
      card.classList.add('card-selected')
      showTransactionCardDetail(selected.id)
    }
  }
}

function updateTransactionImageCount(transactionId, count) {
  const transaction = allItems.find(item => item.id === transactionId)
  if (transaction) transaction.no_images = count
  render(allItems)
}

function renderTransactionImageModal() {
  const { files, currentIndex, enlarged } = transactionImagesState
  const file = files[currentIndex]
  const hasFiles = files.length > 0

  transactionImagesEmpty.classList.toggle('hidden', hasFiles)
  transactionImagesViewer.classList.toggle('hidden', !hasFiles)
  transactionImagesDelete.disabled = !hasFiles
  transactionImagesPreview.classList.toggle('is-enlarged', enlarged)

  if (!file) {
    transactionImagesCurrent.removeAttribute('src')
    transactionImagesCounter.textContent = ''
    transactionImagesPrev.disabled = true
    transactionImagesNext.disabled = true
    return
  }

  transactionImagesCurrent.src = enlarged ? file.url : (file.thumbnail_url || file.url)
  transactionImagesCounter.textContent = `${currentIndex + 1} de ${files.length}`
  transactionImagesPrev.disabled = files.length < 2
  transactionImagesNext.disabled = files.length < 2
  transactionImagesPrev.innerHTML = iconCarouselPrev()
  transactionImagesNext.innerHTML = iconCarouselNext()
}

function closeTransactionImages() {
  transactionImagesModal.classList.add('hidden')
  transactionImagesState = { transactionId: null, files: [], currentIndex: 0, enlarged: false }
}

async function openTransactionImages(transactionId) {
  try {
    const response = await fetch(`/files/transactions/${transactionId}`)
    if (!response.ok) throw new Error('No fue posible cargar las imágenes')

    const data = await response.json()
    transactionImagesState = {
      transactionId,
      files: data.files || [],
      currentIndex: 0,
      enlarged: false
    }
    transactionImagesModal.classList.remove('hidden')
    renderTransactionImageModal()
  } catch (error) {
    console.error('Error cargando imágenes:', error)
    alert('No fue posible cargar las imágenes de la transacción.')
  }
}

async function uploadTransactionImages() {
  const files = Array.from(transactionImagesInput.files || [])
  const transactionId = transactionImagesState.transactionId
  if (!files.length || !transactionId) return

  const formData = new FormData()
  files.forEach(file => formData.append('images', file))

  try {
    const response = await fetch(`/files/transactions/${transactionId}`, {
      method: 'POST',
      headers: { 'X-CSRF-Token': window.CSRF_TOKEN },
      body: formData
    })
    const data = await response.json().catch(() => ({}))
    if (data.csrfToken) window.CSRF_TOKEN = data.csrfToken
    if (!response.ok) throw new Error(data.error || 'Error al insertar imágenes')

    transactionImagesState.files = [...transactionImagesState.files, ...(data.files || [])]
    transactionImagesState.currentIndex = Math.max(0, transactionImagesState.files.length - 1)
    updateTransactionImageCount(transactionId, transactionImagesState.files.length)
    renderTransactionImageModal()
  } catch (error) {
    console.error('Error insertando imágenes:', error)
    alert(error.message || 'No fue posible insertar las imágenes.')
  } finally {
    transactionImagesInput.value = ''
  }
}

async function deleteCurrentTransactionImage() {
  const { files, currentIndex, transactionId } = transactionImagesState
  const file = files[currentIndex]
  if (!file || !transactionId || !confirm('¿Eliminar esta imagen?')) return

  try {
    const response = await fetch(`/files/item/${file.id}`, {
      method: 'DELETE',
      headers: { 'X-CSRF-Token': window.CSRF_TOKEN }
    })
    const data = await response.json().catch(() => ({}))
    if (data.csrfToken) window.CSRF_TOKEN = data.csrfToken
    if (!response.ok) throw new Error(data.error || 'Error al eliminar la imagen')

    transactionImagesState.files.splice(currentIndex, 1)
    transactionImagesState.currentIndex = Math.min(currentIndex, transactionImagesState.files.length - 1)
    transactionImagesState.enlarged = false
    updateTransactionImageCount(transactionId, transactionImagesState.files.length)
    renderTransactionImageModal()
  } catch (error) {
    console.error('Error eliminando imagen:', error)
    alert(error.message || 'No fue posible eliminar la imagen.')
  }
}

transactionImagesPrev.addEventListener('click', () => {
  const total = transactionImagesState.files.length
  if (total > 1) {
    transactionImagesState.currentIndex = (transactionImagesState.currentIndex - 1 + total) % total
    transactionImagesState.enlarged = false
    renderTransactionImageModal()
  }
})

transactionImagesNext.addEventListener('click', () => {
  const total = transactionImagesState.files.length
  if (total > 1) {
    transactionImagesState.currentIndex = (transactionImagesState.currentIndex + 1) % total
    transactionImagesState.enlarged = false
    renderTransactionImageModal()
  }
})

transactionImagesPreview.addEventListener('click', () => {
  if (transactionImagesState.files.length) {
    transactionImagesState.enlarged = !transactionImagesState.enlarged
    renderTransactionImageModal()
  }
})

transactionImagesInsert.addEventListener('click', () => transactionImagesInput.click())
transactionImagesInput.addEventListener('change', uploadTransactionImages)
transactionImagesDelete.addEventListener('click', deleteCurrentTransactionImage)
transactionImagesClose.addEventListener('click', closeTransactionImages)
transactionImagesModal.addEventListener('click', closeTransactionImages)
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !transactionImagesModal.classList.contains('hidden')) {
    closeTransactionImages()
  }
})

/* ============================================================================
6. Render Desktop / Mobile
============================================================================ */
function renderRow(transaction) {
  const { date, time, weekday } = formatDateTime(transaction.date)

  let action_name = ""
  let action_id = 0
  if (transaction.Payable) {
    action_name = "Payable"
    action_id = transaction.Payable.id
  } else if (transaction.Payable_payment) {
    action_name = "payment"
    action_id = transaction.Payable_payment.id
  } else {
    action_name = "transaction"
    action_id = transaction.id
  }

  return `
    <tr id="transaction-${transaction.id}" class="${rowClassByType(transaction)}">
      <td class="px-4 py-2 text-center col-nowrap">
        <div>${date}</div>
        <div class="text-xs text-gray-600">${time}</div>
        <div class="text-xs text-gray-600">${weekday}</div>
      </td>
      <td class="ui-td col-left">
        ${transactionTypeTag(transaction.type)}
        ${isModuleManaged(transaction) ? `<span class="tx-origin ${moduleOriginClass(transaction)}">${moduleOriginLabel(transaction)}</span>` : ''}
      </td>
      <td class="ui-td col-right">${amountBox(transaction.amount)}</td>
      <td class="ui-td col-left col-nowrap">
        ${transaction.type === 'transfer'
      ? `
            <div class="grouped-icon-line">
              <span class="grouped-icon">${iconTransferOut()}</span>
              <span>${transaction.account?.name || '-'}</span>
            </div>
            <div class="grouped-icon-line">
              <span class="grouped-icon">${iconTransferIn()}</span>
              <span>${transaction.to_account?.name || '-'}</span>
            </div>
          `
      : transaction.type === 'income'
        ? `
        <div class="grouped-icon-line">
          <span class="grouped-icon">${iconTransferIn()}</span>
          <span>${transaction.account?.name || '-'}</span>
        </div>
      `
        : transaction.type === 'expense'
          ? `
        <div class="grouped-icon-line">
          <span class="grouped-icon">${iconTransferOut()}</span>
          <span>${transaction.account?.name || '-'}</span>
        </div>
      `
          : '-'
    }
      </td>
      <td class="ui-td col-left col-nowrap">
      ${transaction.category?.name
      ? `
        <div class="grouped-icon-line">
          <span class="grouped-icon">${iconGrouped()}</span>
          <span>${transaction.category?.name || '-'}</span>
        </div>
        ` : ''
    }
      ${transaction.Payable_payment?.Payable?.name
      ? `
        <div class="grouped-icon-line">
          <span class="grouped-icon">${iconGrouped()}</span>
          <span>${transaction.Payable_payment?.Payable?.name || '-'}</span>
        </div>
        ` : ''
    }
      ${transaction.Payable_payment?.Payable?.category?.name
      ? `
        <div class="grouped-icon-line">
          <span class="grouped-icon">${iconGrouped()}</span>
          <span>${transaction.Payable_payment?.Payable?.category?.name || '-'}</span>
        </div>
        ` : ''
    }
      </td>
      
      <td class="ui-td col-center col-nowrap">
        <div class="icon-actions">

          ${isBatchActive() ? `
            <input
              type="checkbox"
              data-transaction-id="${transaction.id}"
              onclick="event.stopPropagation(); batchToggleSelection(${transaction.id}, this.checked)"
            >
          ` : ''}

          ${!isModuleManaged(transaction) ? `
            <button 
              class="icon-btn edit" 
              title="Editar"
              onclick="goToRouteUpdate('${action_name}', ${action_id})">
              ${iconEdit()}
              <span class="ui-btn-text">Editar</span>
            </button>
          ` : ''}

          <button 
            class="icon-btn clone" 
            title="Clonar"
            onclick="goToRouteClone('${action_name}', ${action_id})">
            ${iconClone()}
            <span class="ui-btn-text">Clonar</span>
          </button>

          ${!isModuleManaged(transaction) ? `
            <button 
              class="icon-btn delete" 
              title="Eliminar"
              onclick="goToRouteDelete('${action_name}', ${action_id})">
              ${iconDelete()}
              <span class="ui-btn-text">Eliminar</span>
            </button>
          ` : ''}

          ${transactionImagesButton(transaction)}

        </div>
      </td>
    </tr> 

    <tr id="transaction-detail-${transaction.id}" class="transaction-detail-row hidden">
      <td colspan="8">
        ${transaction.description || '-'}
      </td>
    </tr>
  `
}

function renderCard(transaction) {
  const { date, time, weekday } = formatDateTime(transaction.date)

  let action_name = ""
  let action_id = 0
  if (transaction.Payable) {
    action_name = "Payable"
    action_id = transaction.Payable.id
  } else if (transaction.Payable_payment) {
    action_name = "payment"
    action_id = transaction.Payable_payment.id
  } else {
    action_name = "transaction"
    action_id = transaction.id
  }

  return `
    <div 
      class="transaction-card ${rowClassByType(transaction)}"
      data-id="${transaction.id}"
      onclick="selectTransactionCard(event, ${transaction.id})">

      <div class="card-header">
        <div class="card-datetime">
          <span class="card-date">${date}</span>
          <span class="card-time">${time}</span>
          <span class="card-weekday">${weekday}</span>
        </div>

        <div class="card-actions">

          ${isBatchActive() ? `
            <input
              type="checkbox"
              data-transaction-id="${transaction.id}"
              onclick="event.stopPropagation(); batchToggleSelection(${transaction.id}, this.checked)"
            >
          ` : ''}

          ${!isModuleManaged(transaction) ? `
            <button 
              class="icon-btn edit"
              onclick="event.stopPropagation(); goToRouteUpdate('${action_name}', ${action_id})">
              ${iconEdit()}
            </button>
          ` : ''}
          <button 
            class="icon-btn clone"
            onclick="event.stopPropagation(); goToRouteClone('${action_name}', ${action_id})">
            ${iconClone()}
          </button>
          ${!isModuleManaged(transaction) ? `
            <button  
              class="icon-btn delete"
              onclick="event.stopPropagation(); goToRouteDelete('${action_name}', ${action_id})">
              ${iconDelete()}
            </button>
          ` : ''}
          ${transactionImagesButton(transaction)}
        </div>
      </div>

      <div class="card-content">
        <div class="card-info">
          <div class="card-account">
            ${isModuleManaged(transaction) ? `<span class="tx-origin ${moduleOriginClass(transaction)}">${moduleOriginLabel(transaction)}</span>` : ''}
            ${transaction.type === 'transfer'
      ? `
                <div class="grouped-icon-line">
                  <span class="grouped-icon">${iconTransferOut()}</span>
                  <span>${transaction.account?.name || '-'}</span>
                </div>
                <div class="grouped-icon-line">
                  <span class="grouped-icon">${iconTransferIn()}</span>
                  <span>${transaction.to_account?.name || '-'}</span>
                </div>
              `
      : transaction.type === 'income'
        ? `
                <div class="grouped-icon-line">
                  <span class="grouped-icon">${iconTransferIn()}</span>
                  <span>${transaction.account?.name || '-'}</span>
                </div>
                `
        : transaction.type === 'expense'
          ? `
                <div class="grouped-icon-line">
                  <span class="grouped-icon">${iconTransferOut()}</span>
                  <span>${transaction.account?.name || '-'}</span>
                </div>
                `
          : '-'
    }
          </div>
          ${transaction.category?.name
      ? `<div class="card-category">
              <div class="grouped-icon-line">
                <span class="grouped-icon">${iconGrouped()}</span>
                <span>${transaction.category?.name || '-'}</span>
              </div>
            </div>
          ` : ''
    }
          ${transaction.Payable_payment?.Payable?.name
      ? `<div class="card-category">
                <div class="grouped-icon-line">
                  <span class="grouped-icon">${iconGrouped()}</span>
                  <span>${transaction.Payable_payment?.Payable?.name || '-'}</span>
                </div>
              </div>
            ` : ''
    }
          ${transaction.Payable_payment?.Payable?.category?.name
      ? `<div class="card-category">
                <div class="grouped-icon-line">
                  <span class="grouped-icon">${iconGrouped()}</span>
                  <span>${transaction.Payable_payment?.Payable?.category?.name || '-'}</span>
                </div>
              </div>
            ` : ''
    }
          <div id="transaction-card-detail-${transaction.id}" class="transaction-card-detail hidden" >
            ${transaction.description}
          </div>
        </div>

        <div class="card-amount">
          ${amountBox(transaction.amount)}
        </div>
      </div>
    </div>
  `
}

/* ============================================================================
7. Render principal
============================================================================ */
function render(data) {
  window.innerWidth <= 768 ? renderCards(data) : renderTable(data)
}

/* ============================================================================
8. Data (loadCategories / loadTransactions)
============================================================================ */
function updatePaginationInfo() {
  document.getElementById('page-info-top').textContent =
    `Página ${currentPage} de ${totalPages}`
}

async function loadTransactions(page = 1) {
  try {
    const params = new URLSearchParams({ page, limit: PAGE_SIZE })
    if (currentSearch) params.append('search', currentSearch)
    if (CATEGORY_ID) params.append('category_id', CATEGORY_ID)

    const res = await fetch(`${API_BASE}?${params}`)

    // Manejar errores de rate limiting
    if (res.status === 429) {
      const errorData = await res.json().catch(() => ({}))
      const retryAfter = errorData.retryAfter || 60
      alert(`⏱️ Límite de solicitudes excedido.\n\nEspera ${retryAfter} segundos antes de intentar nuevamente.`)
      return
    }

    if (!res.ok) {
      throw new Error(`Error ${res.status}: ${res.statusText}`)
    }

    const data = await res.json()

    allItems = data.items
    totalPages = Math.ceil(data.total / PAGE_SIZE)
    currentPage = page

    // 🔹 Guardar filtros incluyendo página
    saveFilters(FILTER_KEY, { term: currentSearch, page: currentPage })

    render(allItems)
    updatePaginationInfo()

    if (isBatchActive()) {
      if (typeof batchApplyUi === 'function') batchApplyUi(true)
      if (typeof batchToggleActionButtons === 'function') batchToggleActionButtons(true)
      if (typeof batchRestoreSelection === 'function') batchRestoreSelection()
    }
  } catch (error) {
    console.error('Error cargando transacciones:', error)
    alert('Error al cargar transacciones. Intenta nuevamente.')
  }
}

/* ============================================================================
9. Filtros (texto + estado)
============================================================================ */
function applySearch() {
  currentSearch = searchInput.value.trim()
  currentPage = 1   // 🔹 Siempre volver a página 1 en nueva búsqueda

  saveFilters(FILTER_KEY, {
    term: currentSearch,
    page: currentPage
  })

  clearBtn.classList.toggle('hidden', !currentSearch)
  loadTransactions(currentPage)
}

/* ============================================================================
10. Status Filter UI
============================================================================ */
/* (reservado para futuros filtros visuales) */

/* ============================================================================
11. Acciones (redirects / selects)
============================================================================ */
function goToRouteUpdate(action_name, action_id) {
  const params = new URLSearchParams()
  if (CATEGORY_ID) {
    params.set('category_id', CATEGORY_ID)
    params.set('from', 'categories')
  }
  if (action_name === "Payable") {
    location.href = `/Payables/update/${action_id}?${params.toString()}`
  } else if (action_name === "payment") {
    location.href = `/payments/update/${action_id}?${params.toString()}`
  } else {
    location.href = `/transactions/update/${action_id}?${params.toString()}`
  }
}

function goToRouteClone(action_name, action_id) {
  const params = new URLSearchParams()
  if (CATEGORY_ID) {
    params.set('category_id', CATEGORY_ID)
    params.set('from', 'categories')
  }
  if (action_name === "Payable") {
    location.href = `/Payables/clone/${action_id}?${params.toString()}`
  } else if (action_name === "payment") {
    location.href = `/payments/clone/${action_id}?${params.toString()}`
  } else {
    location.href = `/transactions/clone/${action_id}?${params.toString()}`
  }
}

function goToRouteDelete(action_name, action_id) {
  const params = new URLSearchParams()
  if (CATEGORY_ID) {
    params.set('category_id', CATEGORY_ID)
    params.set('from', 'categories')
  }
  if (action_name === "Payable") {
    location.href = `/Payables/delete/${action_id}?${params.toString()}`
  } else if (action_name === "payment") {
    location.href = `/payments/delete/${action_id}?${params.toString()}`
  } else {
    location.href = `/transactions/delete/${action_id}?${params.toString()}`
  }
}

function goBackToCategories() {
  location.href = '/categories'
}

function selectTransactionCard(event, id) {
  if (event.target.closest('button')) return

  const card = event.target.closest('.transaction-card')
  if (!card) return

  const detail = document.getElementById(`transaction-card-detail-${id}`)
  const is_open = detail && !detail.classList.contains('hidden')

  if (is_open) {
    card.classList.remove('card-selected')
    detail.classList.add('hidden')
    clearFilters(SELECTED_KEY)
    return
  }

  document.querySelectorAll('.transaction-card')
    .forEach(c => c.classList.remove('card-selected'))

  document.querySelectorAll('.transaction-card-detail')
    .forEach(d => d.classList.add('hidden'))

  card.classList.add('card-selected')
  detail?.classList.remove('hidden')

  saveFilters(SELECTED_KEY, { id })
}

/* ============================================================================
12. Eventos
============================================================================ */
searchInput.addEventListener('input', debounce(applySearch, 300))

clearBtn.addEventListener('click', () => {
  searchInput.value = ''
  currentSearch = ''
  clearBtn.classList.add('hidden')
  clearFilters(FILTER_KEY)
  clearFilters(SELECTED_KEY)
  loadTransactions(1)
})

document.getElementById('prev-page-top')?.addEventListener('click', () => {
  if (currentPage > 1) loadTransactions(currentPage - 1)
})

document.getElementById('next-page-top')?.addEventListener('click', () => {
  if (currentPage < totalPages) loadTransactions(currentPage + 1)
})

if (table) {
  table.addEventListener('click', event => {
    if (event.target.closest('button') || event.target.closest('a')) return

    const row = event.target.closest('tr[id^="transaction-"]')
    if (!row) return

    const id = row.id.replace('transaction-', '')
    const detail_row = document.getElementById(`transaction-detail-${id}`)

    const is_open = detail_row && !detail_row.classList.contains('hidden')

    if (is_open) {
      row.classList.remove('tr-selected')
      detail_row.classList.add('hidden')
      clearFilters(SELECTED_KEY)
      return
    }

    document.querySelectorAll('#transactions-table tr')
      .forEach(tr => tr.classList.remove('tr-selected'))

    document.querySelectorAll('.transaction-detail-row')
      .forEach(tr => tr.classList.add('hidden'))

    row.classList.add('tr-selected')
    detail_row?.classList.remove('hidden')

    saveFilters(SELECTED_KEY, { id })
  })
}

/* ============================================================================
13. Scroll
============================================================================ */
/* (no implementado todavía) */

/* ============================================================================
14. Init
============================================================================ */
const savedFilters = loadFilters(FILTER_KEY)
if (savedFilters?.term) {
  currentSearch = savedFilters.term
  searchInput.value = savedFilters.term
  clearBtn.classList.remove('hidden')
}

document.addEventListener('DOMContentLoaded', () => {
  const savedFilters = loadFilters(FILTER_KEY)

  if (savedFilters?.term) {
    currentSearch = savedFilters.term
    searchInput.value = savedFilters.term
    clearBtn.classList.remove('hidden')
  }

  const savedPage = savedFilters?.page || 1
  currentPage = savedPage

  loadTransactions(currentPage)

  if (SAVED_BATCH) {
    if (typeof batchRestoreState === 'function') {
      batchRestoreState()
    }

    if (window.history.replaceState) {
      const url = new URL(window.location)
      url.searchParams.delete('saved_batch')
      window.history.replaceState({}, document.title, url.toString())
    }
  }

  window.addEventListener('resize', () => {
    const nextLayout = getLayoutMode()

    if (nextLayout !== currentLayout) {
      currentLayout = nextLayout
      render(allItems)

      if (isBatchActive()) {
        batchApplyUi(true)
        batchToggleActionButtons(true)
        batchRestoreSelection()
      }
    }
  })
})