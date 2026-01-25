document.addEventListener('DOMContentLoaded', () => {
  // ============================
  // Toggle "Es categoría padre"
  // ============================
  const checkbox = document.getElementById('is-parent-checkbox')
  const typeContainer = document.getElementById('type-container')
  const parentContainer = document.getElementById('parent-container')
  const typeRadios = document.querySelectorAll('input[name="type"]')
  const parentInputHidden = parentContainer?.querySelector('input[name="parent_id"]')
  const parentInputText = parentContainer?.querySelector('input[data-autocomplete-input]')

  function ensureTypeSelected() {
    const hasChecked = [...typeRadios].some(r => r.checked)
    if (!hasChecked && typeRadios.length) {
      typeRadios[0].checked = true
    }
  }

  function toggleParentMode() {
    if (!typeContainer || !parentContainer || !checkbox) return

    if (checkbox.checked) {
      // Ocultar visualmente
      typeContainer.style.display = 'none'
      parentContainer.style.display = 'none'

      // Limpiar padre (regla válida)
      if (parentInputHidden) parentInputHidden.value = ''
      if (parentInputText) parentInputText.value = ''

      // Asegurar que type SIEMPRE tenga valor
      ensureTypeSelected()
    } else {
      typeContainer.style.display = 'block'
      parentContainer.style.display = 'block'
    }
  }

  if (checkbox) {
    checkbox.addEventListener('change', toggleParentMode)
    toggleParentMode()
  }

  // ============================
  // Autocomplete
  // ============================
  document.querySelectorAll('[data-autocomplete]').forEach(container => {
    const input = container.querySelector('[data-autocomplete-input]')
    const hidden = container.querySelector('[data-autocomplete-hidden]')
    const list = container.querySelector('[data-autocomplete-list]')

    if (!input || !hidden || !list) return

    input.addEventListener('focus', () => list.classList.remove('hidden'))

    input.addEventListener('input', () => {
      const value = input.value.toLowerCase()
      let visibleCount = 0

      list.querySelectorAll('[data-autocomplete-item]').forEach(item => {
        const match = item.dataset.label.toLowerCase().includes(value)
        item.style.display = match ? '' : 'none'
        if (match) visibleCount++
      })

      list.style.display = visibleCount ? '' : 'none'
    })

    list.querySelectorAll('[data-autocomplete-item]').forEach(item => {
      item.addEventListener('click', () => {
        input.value = item.dataset.label
        hidden.value = item.dataset.id
        list.classList.add('hidden')
      })
    })

    document.addEventListener('click', e => {
      if (!container.contains(e.target)) list.classList.add('hidden')
    })
  })
})
