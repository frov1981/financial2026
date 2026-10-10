(() => {
document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.querySelector('input[name="name"][aria-controls="payable-name-suggestions"]')
  const suggestions = document.getElementById('payable-name-suggestions')

  if (nameInput && suggestions) {
    const currentRecordId = document.querySelector('input[name="id"]')?.value || ''
    const suggestionItems = Array.from(suggestions.querySelectorAll('[data-record-name]'))
    const noResults = suggestions.querySelector('.record-name-no-results')
    const duplicateMessage = document.querySelector('.record-name-duplicate')
    let activeIndex = -1

    const getVisibleItems = () => suggestionItems.filter(item => !item.hidden)
    const closeSuggestions = () => {
      suggestions.hidden = true
      activeIndex = -1
      suggestionItems.forEach(item => item.classList.remove('active'))
    }
    const updateDuplicateMessage = () => {
      const name = nameInput.value.toLowerCase()
      const duplicateExists = name && suggestionItems.some(item =>
        item.dataset.recordName.toLowerCase() === name &&
        item.dataset.recordId !== currentRecordId
      )

      duplicateMessage.hidden = !duplicateExists
      duplicateMessage.textContent = duplicateExists
        ? 'Ya existe un compromiso con este nombre.'
        : ''
    }
    const filterSuggestions = () => {
      const query = nameInput.value.trim().toLowerCase()
      let visibleCount = 0

      suggestionItems.forEach(item => {
        const matches = item.dataset.recordName.toLowerCase().includes(query)
        item.hidden = !matches
        item.classList.remove('active')
        if (matches) visibleCount++
      })

      if (noResults) noResults.hidden = visibleCount > 0
      suggestions.hidden = false
      activeIndex = -1
      updateDuplicateMessage()
    }
    const selectSuggestion = item => {
      nameInput.value = item.dataset.recordName
      closeSuggestions()
      updateDuplicateMessage()
    }

    nameInput.addEventListener('focus', filterSuggestions)
    nameInput.addEventListener('input', filterSuggestions)
    nameInput.addEventListener('keydown', event => {
      const visibleItems = getVisibleItems()
      if (event.key === 'Escape') {
        closeSuggestions()
        return
      }
      if (!visibleItems.length) return

      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        activeIndex = event.key === 'ArrowDown'
          ? (activeIndex + 1) % visibleItems.length
          : (activeIndex <= 0 ? visibleItems.length - 1 : activeIndex - 1)
        suggestionItems.forEach(item => item.classList.remove('active'))
        visibleItems[activeIndex].classList.add('active')
      } else if (event.key === 'Enter' && !suggestions.hidden && activeIndex >= 0) {
        event.preventDefault()
        selectSuggestion(visibleItems[activeIndex])
      }
    })
    suggestions.addEventListener('click', event => {
      const item = event.target.closest('[data-record-name]')
      if (item) selectSuggestion(item)
    })
    document.addEventListener('click', event => {
      if (!nameInput.closest('.record-name-autocomplete').contains(event.target)) {
        closeSuggestions()
      }
    })

    updateDuplicateMessage()
  }

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
})()
