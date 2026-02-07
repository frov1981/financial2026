document.addEventListener('DOMContentLoaded', () => {
  const checkbox = document.getElementById('is-parent-checkbox')
  if (!checkbox) return

  const form = checkbox.closest('form')

  function toggleParentMode() {
    const isParent = checkbox.checked

    const fields = Array.from(form.querySelectorAll('.mb-4'))

    fields.forEach(field => {
      if (field.contains(checkbox)) return

      const nameInput = field.querySelector('input[name="name"]')

      if (isParent) {
        if (nameInput) {
          field.style.display = 'block'
        } else {
          field.style.display = 'none'
        }
      } else {
        field.style.display = 'block'
      }
    })

    const parentContainer = document.getElementById('parent-container')
    if (isParent && parentContainer) {
      const parentHidden = parentContainer.querySelector('input[name="parent_id"]')
      const parentText = parentContainer.querySelector('input[data-autocomplete-input]')
      if (parentHidden) parentHidden.value = ''
      if (parentText) parentText.value = ''
    }
  }

  checkbox.addEventListener('change', toggleParentMode)
  toggleParentMode()

  // ============================
  // Autocomplete (igual que Categories)
  // ============================
  document.querySelectorAll('[data-autocomplete]').forEach(container => {
    const input = container.querySelector('[data-autocomplete-input]')
    const hidden = container.querySelector('[data-autocomplete-hidden]')
    const list = container.querySelector('[data-autocomplete-list]')

    if (!input || !hidden || !list) return

    input.addEventListener('focus', () => {
      list.classList.remove('hidden')
    })

    input.addEventListener('input', () => {
      const value = input.value.toLowerCase()
      let visibleCount = 0

      hidden.value = ''

      list.querySelectorAll('[data-autocomplete-item]').forEach(item => {
        const label = (item.dataset.label || '').toLowerCase()
        const match = label.includes(value)
        item.style.display = match ? '' : 'none'
        if (match) visibleCount++
      })

      if (visibleCount) list.classList.remove('hidden')
      else list.classList.add('hidden')
    })

    list.querySelectorAll('[data-autocomplete-item]').forEach(item => {
      item.addEventListener('click', () => {
        input.value = item.dataset.label || ''
        hidden.value = item.dataset.id || ''
        list.classList.add('hidden')
      })
    })

    document.addEventListener('click', e => {
      if (!container.contains(e.target)) {
        list.classList.add('hidden')
      }
    })
  })
})
