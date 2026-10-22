(() => {
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.supplier-identity-autocomplete').forEach(container => {
      const input = container.querySelector('[data-supplier-autocomplete]')
      const suggestions = container.querySelector('.supplier-identity-suggestions')
      const items = Array.from(container.querySelectorAll('[data-suggestion-value]'))
      const noResults = container.querySelector('.supplier-identity-no-results')
      const duplicateMessage = container.querySelector('.supplier-identity-duplicate')
      const field = container.dataset.supplierField
      const currentSupplierId = document.querySelector('input[name="id"]')?.value || ''
      let activeIndex = -1

      const getVisibleItems = () => items.filter(item => !item.hidden)
      const closeSuggestions = () => {
        suggestions.hidden = true
        activeIndex = -1
        items.forEach(item => item.classList.remove('active'))
      }
      const isDuplicateValue = value => items.some(item => {
        if (field !== 'business_name' || item.dataset.supplierId === currentSupplierId) return false
        const existingValue = item.dataset.suggestionValue.trim()
        return existingValue.toLowerCase() === value.toLowerCase()
      })
      const updateDuplicateMessage = () => {
        if (field !== 'business_name') return
        const value = input.value.trim()
        const duplicateExists = value !== '' && isDuplicateValue(value)
        duplicateMessage.hidden = !duplicateExists
        duplicateMessage.textContent = duplicateExists
          ? 'Ya existe un proveedor con esta razón social.'
          : ''
      }
      const filterSuggestions = () => {
        const query = input.value.trim().toLowerCase()
        let visibleCount = 0

        items.forEach(item => {
          const matches = item.dataset.suggestionValue.toLowerCase().includes(query)
          item.hidden = !matches
          item.classList.remove('active')
          if (matches) visibleCount++
        })

        noResults.hidden = visibleCount > 0
        suggestions.hidden = false
        activeIndex = -1
        updateDuplicateMessage()
      }

      input.addEventListener('focus', filterSuggestions)
      input.addEventListener('input', filterSuggestions)
      input.addEventListener('keydown', event => {
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
          items.forEach(item => item.classList.remove('active'))
          visibleItems[activeIndex].classList.add('active')
        } else if (event.key === 'Enter' && !suggestions.hidden && activeIndex >= 0) {
          event.preventDefault()
          input.value = visibleItems[activeIndex].dataset.suggestionValue
          closeSuggestions()
          updateDuplicateMessage()
        }
      })
      suggestions.addEventListener('click', event => {
        const item = event.target.closest('[data-suggestion-value]')
        if (!item) return
        input.value = item.dataset.suggestionValue
        closeSuggestions()
        updateDuplicateMessage()
      })
      document.addEventListener('click', event => {
        if (!container.contains(event.target)) closeSuggestions()
      })

      updateDuplicateMessage()
    })

    const form = document.querySelector('form[action="/suppliers/"]')
    const mode = form?.querySelector('[name="mode"]')?.value
    if (mode !== 'delete') return

    form.addEventListener('submit', event => {
      const confirmed = window.confirm('¿Estás seguro de que deseas eliminar este proveedor?')
      if (!confirmed) event.preventDefault()
    })
  })
})()
