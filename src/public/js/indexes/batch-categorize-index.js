/* ============================================================================
1. Datos iniciales desde el servidor
============================================================================ */
const BATCH_TRANSACTIONS = Array.isArray(window.BATCH_TRANSACTIONS) ? window.BATCH_TRANSACTIONS : []

/* ============================================================================
2. Layout detection
============================================================================ */
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
const tableBody = document.getElementById('transactions-table')
const mobileContainer = document.getElementById('batch-categorize-mobile')

/* ============================================================================
4. Utils
============================================================================ */
function rowClassByType(type) {
  if (type === 'income') return 'income'
  if (type === 'expense') return 'expense'
  if (type === 'transfer') return 'transfer'
  return ''
}

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/* ============================================================================
5. Render Desktop (tabla)
============================================================================ */
function renderRow(transaction) {
  const date = formatDate(transaction.date)

  return `
    <tr class="${rowClassByType(transaction.type)}">
      <td class="ui-td col-left">${date}</td>
      <td class="ui-td col-left col-sm">${transactionTypeTag(transaction.type)}</td>
      <td class="ui-td col-right">${amountBox(transaction.amount)}</td>
      <td class="ui-td col-left">${transaction.category?.name || '-'}</td>
      <td class="ui-td col-left">
        <span class="text-gray-400">Seleccione categoría...</span>
      </td>
    </tr>
  `
}

function renderTable(data) {
  if (!tableBody) return

  if (!data.length) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="5" class="ui-td col-center text-gray-500">
          No hay transacciones para categorizar
        </td>
      </tr>
    `
    return
  }

  tableBody.innerHTML = data.map(renderRow).join('')
}

/* ============================================================================
6. Render Mobile (cards)
============================================================================ */
function renderCard(transaction) {
  const date = formatDate(transaction.date)

  return `
    <div class="transaction-card ${rowClassByType(transaction.type)}">
      <div class="card-header">
        <div class="card-datetime">
          <span class="card-date">${date}</span>
        </div>
        <div class="card-type">
          ${transactionTypeTag(transaction.type)}
        </div>
      </div>

      <div class="card-content">
        <div class="card-info">
          <div class="card-category">
            Categoría actual:
            <strong>${transaction.category?.name || '-'}</strong>
          </div>
        </div>

        <div class="card-amount">
          ${amountBox(transaction.amount)}
        </div>
      </div>

      <div class="card-footer">
        <span class="text-gray-400">Seleccione nueva categoría...</span>
      </div>
    </div>
  `
}

function renderCards(data) {
  if (!mobileContainer) return

  if (!data.length) {
    mobileContainer.innerHTML = `<div class="ui-empty">No hay transacciones para categorizar</div>`
    return
  }

  mobileContainer.innerHTML = data.map(renderCard).join('')
}

/* ============================================================================
7. Render principal
============================================================================ */
function render(data) {
  if (window.innerWidth <= 768) {
    renderCards(data)
  } else {
    renderTable(data)
  }
}

/* ============================================================================
9. Estado de categorías seleccionadas
============================================================================ */
let selected_income_category = null
let selected_expense_category = null

const incomeHidden = document.getElementById('batch-income-category-id')
const expenseHidden = document.getElementById('batch-expense-category-id')

const incomeInput = document.getElementById('batch-income-category-input')
const expenseInput = document.getElementById('batch-expense-category-input')

function updateNewCategoryLabels() {
  // Desktop
  document.querySelectorAll('#transactions-table tr').forEach((tr, index) => {
    const tx = BATCH_TRANSACTIONS[index]
    if (!tx) return

    const tdNew = tr.querySelector('td:last-child')
    if (!tdNew) return

    let label = '<span class="text-gray-400">Seleccione categoría...</span>'

    if (tx.type === 'income' && selected_income_category) {
      label = selected_income_category.name
    }

    if (tx.type === 'expense' && selected_expense_category) {
      label = selected_expense_category.name
    }

    tdNew.innerHTML = label
  })

  // Mobile
  document.querySelectorAll('.transaction-card').forEach((card, index) => {
    const tx = BATCH_TRANSACTIONS[index]
    if (!tx) return

    const footer = card.querySelector('.card-footer')
    if (!footer) return

    let label = '<span class="text-gray-400">Seleccione nueva categoría...</span>'

    if (tx.type === 'income' && selected_income_category) {
      label = selected_income_category.name
    }

    if (tx.type === 'expense' && selected_expense_category) {
      label = selected_expense_category.name
    }

    footer.innerHTML = label
  })
}


/* ============================================================================
10. Init
============================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  render(BATCH_TRANSACTIONS)

  if (incomeHidden && incomeInput) {
    incomeHidden.addEventListener('change', () => {
      const id = incomeHidden.value
      const name = incomeInput.value

      if (id) {
        selected_income_category = { id, name }
      } else {
        selected_income_category = null
      }

      updateNewCategoryLabels()
    })
  }

  if (expenseHidden && expenseInput) {
    expenseHidden.addEventListener('change', () => {
      const id = expenseHidden.value
      const name = expenseInput.value

      if (id) {
        selected_expense_category = { id, name }
      } else {
        selected_expense_category = null
      }

      updateNewCategoryLabels()
    })
  }

  window.addEventListener('resize', () => {
    const nextLayout = getLayoutMode()

    if (nextLayout !== currentLayout) {
      currentLayout = nextLayout
      render(BATCH_TRANSACTIONS)
      updateNewCategoryLabels()
    }
  })
})

/* ============================================================================
11. Guardar / Cancelar
============================================================================ */
const form = document.getElementById('batch-categorize-form')
const cancelBtn = document.getElementById('batch-cancel-btn')
const incomeIdsInput = document.getElementById('income-ids-input')
const expenseIdsInput = document.getElementById('expense-ids-input')

function buildPayload() {
  const income_ids = []
  const expense_ids = []

  BATCH_TRANSACTIONS.forEach(tx => {
    if (tx.type === 'income') income_ids.push(tx.id)
    if (tx.type === 'expense') expense_ids.push(tx.id)
  })

  return {
    income_ids,
    expense_ids
  }
}

function validateBatch() {
  const payload = buildPayload()

  if (payload.income_ids.length && !selected_income_category?.id) {
    showError('Debe seleccionar categoría de ingresos')
    return false
  }

  if (payload.expense_ids.length && !selected_expense_category?.id) {
    showError('Debe seleccionar categoría de gastos')
    return false
  }

  return true
}

function showError(message) {
  alert(message)
}

if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault()

    if (!validateBatch()) {
      return
    }

    const payload = buildPayload()
    incomeIdsInput.value = JSON.stringify(payload.income_ids)
    expenseIdsInput.value = JSON.stringify(payload.expense_ids)

    form.submit()
  })
}

if (cancelBtn) {
  cancelBtn.addEventListener('click', () => {
    window.history.back()
  })
}


