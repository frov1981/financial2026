document.addEventListener('DOMContentLoaded', () => {
    initAutocompletes()
})

function initAutocompletes() {
    document.querySelectorAll('.autocomplete').forEach(container => {
        setupAutocomplete(container)
    })

    document.addEventListener('click', event => {
        document.querySelectorAll('.autocomplete-panel.open').forEach(panel_el => {
            if (!panel_el.parentElement.contains(event.target)) {
                closePanel(panel_el)
            }
        })
    })
}

function setupAutocomplete(container) {
    const input_el = container.querySelector('.autocomplete-input')
    const hidden_el = container.querySelector('.autocomplete-hidden')
    const panel_el = container.querySelector('.autocomplete-panel')

    const items_raw = container.getAttribute('data-items') || '[]'
    const items = JSON.parse(items_raw)
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

  items.forEach((it, index) => {
    const item_el = document.createElement('div')
    item_el.className = 'autocomplete-item'
    item_el.setAttribute('data-index', index)

    const has_balance = typeof it.balance === 'number'

    if (has_balance) {
      item_el.classList.add('two-columns')

      const name_el = document.createElement('div')
      name_el.className = 'item-label'
      name_el.textContent = it.name || ''

      const balance_el = document.createElement('div')
      balance_el.className = 'item-balance'
      balance_el.textContent = formatBalance(it.balance)

      // color según valor
      balance_el.classList.add(it.balance > 0 ? 'positive' : 'negative')

      item_el.appendChild(name_el)
      item_el.appendChild(balance_el)
    } else {
      item_el.textContent = it.name || ''
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
    closePanel(panel_el)
}

function setInputValue(item, input_el) {
  if (typeof item.balance === 'number') {
    input_el.value = `${item.name} (${formatBalance(item.balance)})`
    // opcional: color general según balance
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
