// Inicializa todos los autocompletados de la página
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-autocomplete]').forEach(initAutocomplete)
})

function initAutocomplete(container) {
  const input = container.querySelector('[data-autocomplete-input]')
  const hidden = container.querySelector('[data-autocomplete-hidden]')
  const lists = Array.from(container.querySelectorAll('[data-autocomplete-list]'))
  const balanceDisplay = container.querySelector('[data-autocomplete-display-balance]')
  const balanceTarget = container.querySelector('[data-balance-target]')
  const fieldName = container.getAttribute('data-field') || ''

  if (!input || !hidden || lists.length === 0) return

  /* ================================
     LISTA ACTIVA (SIMPLE / MULTIPLE)
  ================================= */

  function getActiveList() {
    if (lists.length === 1) {
      return lists[0]
    }

    return lists.find(l => l.dataset.active === '1') || null
  }

  function getItems() {
    const list = getActiveList()
    if (!list) return []
    return Array.from(list.querySelectorAll('[data-autocomplete-item]'))
  }

  function hideAllLists() {
    lists.forEach(l => l.classList.add('hidden'))
  }

  /* ================================
     EVENTOS INPUT
  ================================= */

  input.addEventListener('focus', () => {
    hideAllLists()
    const list = getActiveList()
    if (list) {
      list.classList.remove('hidden')
    }
  })

  input.addEventListener('input', () => {
    const value = input.value.toLowerCase().trim()
    const list = getActiveList()
    const items = getItems()

    let visibleCount = 0

    items.forEach(item => {
      const label = item.dataset.label.toLowerCase()
      const visible = label.includes(value)

      item.style.display = visible ? '' : 'none'
      if (visible) visibleCount++
    })

    if (list) {
      list.classList.toggle('hidden', visibleCount === 0)
    }
  })

  /* ================================
     CLICK EN ITEM
  ================================= */

  lists.forEach(list => {
    const items = Array.from(list.querySelectorAll('[data-autocomplete-item]'))

    items.forEach(item => {
      item.addEventListener('click', () => {
        const label = item.dataset.label
        const bal =
          item.dataset.balance !== undefined ? Number(item.dataset.balance) : null

        input.value = label
        hidden.value = item.dataset.id

        if (balanceDisplay) {
          balanceDisplay.textContent = bal !== null ? bal.toFixed(2) : ''
          balanceDisplay.classList.toggle('amount-positive', bal > 0)
          balanceDisplay.classList.toggle('amount-negative', bal <= 0)
        }

        if (balanceTarget) {
          balanceTarget.value = bal !== null ? bal.toFixed(2) : ''
          balanceTarget.classList.toggle('amount-positive', bal > 0)
          balanceTarget.classList.toggle('amount-negative', bal <= 0)
        }

        if (fieldName === 'account' || fieldName === 'to_account') {
          document.dispatchEvent(
            new CustomEvent('account:balance', {
              detail: { balance: bal, field: fieldName }
            })
          )
        }

        if (fieldName === 'parent') {
          document.dispatchEvent(
            new CustomEvent('category:parentSelected', {
              detail: { id: item.dataset.id, label: item.dataset.label }
            })
          )
        }

        hideAllLists()
      })
    })
  })

  /* ================================
     CLICK FUERA
  ================================= */

  document.addEventListener('click', e => {
    if (!container.contains(e.target)) {
      hideAllLists()
    }
  })

  /* ================================
     INIT MODO EDICIÓN
  ================================= */

  if (hidden.value) {
    const items = lists.flatMap(l =>
      Array.from(l.querySelectorAll('[data-autocomplete-item]'))
    )

    const found = items.find(i => i.dataset.id === hidden.value)
    if (!found) return

    const bal =
      found.dataset.balance !== undefined ? Number(found.dataset.balance) : null

    if (balanceDisplay) {
      balanceDisplay.textContent = bal !== null ? bal.toFixed(2) : ''
      balanceDisplay.classList.toggle('amount-positive', bal > 0)
      balanceDisplay.classList.toggle('amount-negative', bal <= 0)
    }

    if (fieldName === 'account' || fieldName === 'to_account' || fieldName === 'disbursement_account') {
      document.dispatchEvent(
        new CustomEvent('account:balance', {
          detail: { balance: bal, field: fieldName }
        })
      )
    }
  }
}
