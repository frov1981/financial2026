/* ============================================================================
   1. Constantes batch (NO colisionan con las existentes)
============================================================================ */
const BATCH_STATE_KEY = `transactions.batch_state.${window.USER_ID}`
const BATCH_SELECTED_KEY = `transactions.batch_selected.${window.USER_ID}`

/* ============================================================================
   2. Selectores de botones batch
============================================================================ */
const btn_batch_start = document.getElementById('btn-batch-start')
const btn_batch_accept = document.getElementById('btn-batch-accept')
const btn_batch_cancel = document.getElementById('btn-batch-cancel')

/* ============================================================================
   3. Estado batch usando helpers existentes (saveFilters / loadFilters / clearFilters)
============================================================================ */
function batchGetState() {
  return loadFilters(BATCH_STATE_KEY) || { active: false }
}

function batchSetState(state) {
  saveFilters(BATCH_STATE_KEY, state)
}

function batchClearState() {
  clearFilters(BATCH_STATE_KEY)
}

/* ============================================================================
   4. Selección batch (lista de IDs)
============================================================================ */
function batchGetSelected() {
  const data = loadFilters(BATCH_SELECTED_KEY)
  return data?.ids || []
}

function batchSetSelected(ids) {
  saveFilters(BATCH_SELECTED_KEY, { ids })
}

function batchClearSelected() {
  clearFilters(BATCH_SELECTED_KEY)
}

/* ============================================================================
   5. UI: alternar toolbar normal / batch
============================================================================ */
function batchApplyUi(is_active) {
  const normal_actions = document.getElementById('toolbar-normal-actions')
  const batch_actions = document.getElementById('toolbar-batch-actions')

  if (!normal_actions || !batch_actions) return

  if (is_active) {
    normal_actions.classList.add('hidden')
    batch_actions.classList.remove('hidden')
  } else {
    normal_actions.classList.remove('hidden')
    batch_actions.classList.add('hidden')
  }
}

/* ============================================================================
   6. UI: desactivar acciones por fila (editar / clonar / eliminar)
============================================================================ */
function batchToggleRowActions(disabled) {
  const buttons = document.querySelectorAll('.icon-actions button')

  buttons.forEach(btn => {
    btn.disabled = disabled
    btn.classList.toggle('opacity-50', disabled)
    btn.classList.toggle('pointer-events-none', disabled)
  })
}

/* ============================================================================
   7. Toggle de selección de una transacción en modo batch
============================================================================ */
function batchToggleSelection(id, checked) {
  const current = batchGetSelected()

  let next

  if (checked) {
    if (!current.includes(id)) {
      next = [...current, id]
    } else {
      next = current
    }
  } else {
    next = current.filter(x => x !== id)
  }

  batchSetSelected(next)
}

/* ============================================================================
   8. Restaurar selección visual al cargar o volver a la página
============================================================================ */
function batchRestoreSelection() {
  const selected = batchGetSelected()

  selected.forEach(id => {
    const checkbox = document.querySelector(`[data-transaction-id="${id}"]`)
    if (checkbox) {
      checkbox.checked = true
    }
  })
}

/* ============================================================================
   9. Limpiar selección visual
============================================================================ */
function batchClearUiSelection() {
  const checkboxes = document.querySelectorAll('[data-transaction-id]')
  checkboxes.forEach(cb => {
    cb.checked = false
  })
}

/* ============================================================================
   10. Acciones de botones batch
============================================================================ */
function batchStartCategorize() {
  batchSetState({ active: true })
  batchApplyUi(true)

  render(allItems)

  batchToggleRowActions(true)
  batchRestoreSelection()
}

function batchAcceptCategorize() {
  const ids = batchGetSelected()

  if (!ids.length) {
    alert('Debe seleccionar al menos una transacción')
    return
  }

  const query = ids.join(',')
  location.href = `/transactions/batch-categorize?ids=${encodeURIComponent(query)}`
}

function batchCancelCategorize() {
  batchClearState()
  batchClearSelected()
  batchApplyUi(false)

  render(allItems)

  batchToggleRowActions(false)
  batchClearUiSelection()
}

function batchRestoreState() {
  batchClearState()
  batchClearSelected()
  batchApplyUi(false)

  batchToggleRowActions(false)
  batchClearUiSelection()
}


/* ============================================================================
   11. Binding de eventos
============================================================================ */
if (btn_batch_start) {
  btn_batch_start.addEventListener('click', batchStartCategorize)
}

if (btn_batch_accept) {
  btn_batch_accept.addEventListener('click', batchAcceptCategorize)
}

if (btn_batch_cancel) {
  btn_batch_cancel.addEventListener('click', batchCancelCategorize)
}

/* ============================================================================
   12. Inicialización al cargar la página
============================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const batch_state = batchGetState()

  if (batch_state.active) {
    batchApplyUi(true)
    batchToggleRowActions(true)
    batchRestoreSelection()
  } else {
    batchApplyUi(false)
    batchToggleRowActions(false)
  }
})

/* ============================================================================
   13. Exponer funciones batch globalmente (para usar desde render de filas/cards)
============================================================================ */
window.batchToggleSelection = batchToggleSelection
window.batchStartCategorize = batchStartCategorize
window.batchAcceptCategorize = batchAcceptCategorize
window.batchCancelCategorize = batchCancelCategorize
window.batchRestoreState = batchRestoreState
