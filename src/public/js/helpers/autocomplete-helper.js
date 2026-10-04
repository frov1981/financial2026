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

;(() => {
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('.autocomplete').forEach(setupAutocomplete)

      document.addEventListener('click', event => {
        document.querySelectorAll('.autocomplete-panel.open').forEach(panel_el => {
          if (!panel_el.parentElement.contains(event.target)) {
            closePanel(panel_el)
          }
        })
      })
    })

    function setupAutocomplete(container) {
      const input_el = container.querySelector('.autocomplete-input')
      const hidden_el = container.querySelector('.autocomplete-hidden')
      const panel_el = container.querySelector('.autocomplete-panel')

      if (!input_el || !hidden_el || !panel_el) return

      const items = JSON.parse(container.getAttribute('data-items') || '[]')
      const default_id = container.getAttribute('data-default-id') || ''
      const placeholder_text = container.getAttribute('data-placeholder') || '-- Escoja una opción --'

      input_el.placeholder = placeholder_text

      let filtered_items = items
      let active_index = -1

      if (default_id) {
        const default_item = items.find(it => String(it.id) === String(default_id))
        if (default_item) {
          setInputValue(default_item, input_el)
          hidden_el.value = default_item.id
        }
      }

      input_el.addEventListener('focus', () => {
        filtered_items = items
        active_index = -1
        renderPanel(panel_el, filtered_items)
        openPanel(panel_el)
      })

      input_el.addEventListener('input', () => {
        const query = input_el.value.toLowerCase()
        filtered_items = items.filter(it => String(it.name || '').toLowerCase().includes(query))
        active_index = -1
        renderPanel(panel_el, filtered_items)
        openPanel(panel_el)
      })

      input_el.addEventListener('keydown', event => {
        if (!panel_el.classList.contains('open')) return

        if (event.key === 'ArrowDown') {
          event.preventDefault()
          active_index = Math.min(active_index + 1, filtered_items.length - 1)
          updateActiveItem(panel_el, active_index)
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault()
          active_index = Math.max(active_index - 1, 0)
          updateActiveItem(panel_el, active_index)
        }

        if (event.key === 'Enter') {
          event.preventDefault()
          if (active_index >= 0 && filtered_items[active_index]) {
            selectItem(filtered_items[active_index], input_el, hidden_el, panel_el)
          }
        }

        if (event.key === 'Escape') {
          closePanel(panel_el)
        }
      })

      panel_el.addEventListener('click', event => {
        const item_el = event.target.closest('.autocomplete-item')
        if (!item_el) return

        const item_index = Number(item_el.getAttribute('data-index'))
        const item = filtered_items[item_index]
        if (!item) return

        selectItem(item, input_el, hidden_el, panel_el)
      })
    }

    function renderPanel(panel_el, items) {
      panel_el.innerHTML = ''

      if (items.length === 0) {
        const empty_el = document.createElement('div')
        empty_el.className = 'autocomplete-item'
        empty_el.textContent = 'Sin resultados'
        panel_el.appendChild(empty_el)
        return
      }

      items.forEach((item, index) => {
        const item_el = document.createElement('div')
        item_el.className = 'autocomplete-item'
        item_el.setAttribute('data-index', index)

        if (typeof item.balance === 'number') {
          item_el.classList.add('two-columns')

          const name_el = document.createElement('div')
          name_el.className = 'item-label'
          name_el.textContent = item.name || ''

          const balance_el = document.createElement('div')
          balance_el.className = 'item-balance'
          balance_el.textContent = formatBalance(item.balance)
          balance_el.classList.add(item.balance > 0 ? 'positive' : 'negative')

          item_el.appendChild(name_el)
          item_el.appendChild(balance_el)
        } else {
          item_el.textContent = item.name || ''
        }

        panel_el.appendChild(item_el)
      })
    }

    function updateActiveItem(panel_el, active_index) {
      const items_el = panel_el.querySelectorAll('.autocomplete-item')
      items_el.forEach(el => el.classList.remove('active'))

      const active_el = items_el[active_index]
      if (active_el) {
        active_el.classList.add('active')
        active_el.scrollIntoView({ block: 'nearest' })
      }
    }

    function selectItem(item, input_el, hidden_el, panel_el) {
      setInputValue(item, input_el)
      hidden_el.value = item.id
      hidden_el.dispatchEvent(new Event('change'))
      closePanel(panel_el)
    }

    function setInputValue(item, input_el) {
      if (typeof item.balance === 'number') {
        input_el.value = `${item.name} (${formatBalance(item.balance)})`
        input_el.style.color = item.balance > 0 ? 'green' : 'red'
      } else {
        input_el.value = item.name || ''
        input_el.style.color = 'inherit'
      }
    }

    function openPanel(panel_el) {
      panel_el.classList.add('open')
    }

    function closePanel(panel_el) {
      panel_el.classList.remove('open')
    }

    function formatBalance(value) {
      const number_value = Number(value) || 0
      return number_value.toFixed(2)
    }

    window.setupAutocomplete = setupAutocomplete
})()
