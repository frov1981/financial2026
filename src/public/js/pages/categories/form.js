(() => {
document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.querySelector('input[name="name"][aria-controls="category-name-suggestions"]')
  const suggestions = document.getElementById('category-name-suggestions')

  if (nameInput && suggestions) {
    const currentCategoryId = document.querySelector('input[name="id"]')?.value || ''
    const suggestionItems = Array.from(suggestions.querySelectorAll('[data-category-name]'))
    const noResults = suggestions.querySelector('.category-name-no-results')
    const duplicateMessage = document.querySelector('.category-name-duplicate')
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
        item.dataset.categoryName.toLowerCase() === name &&
        item.dataset.categoryId !== currentCategoryId
      )

      duplicateMessage.hidden = !duplicateExists
      duplicateMessage.textContent = duplicateExists
        ? 'Ya existe una categoría con este nombre.'
        : ''
    }
    const filterSuggestions = () => {
      const query = nameInput.value.trim().toLowerCase()
      let visibleCount = 0

      suggestionItems.forEach(item => {
        const matches = item.dataset.categoryName.toLowerCase().includes(query)
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
      nameInput.value = item.dataset.categoryName
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
      const item = event.target.closest('[data-category-name]')
      if (item) selectSuggestion(item)
    })
    document.addEventListener('click', event => {
      if (!nameInput.closest('.category-name-autocomplete').contains(event.target)) {
        closeSuggestions()
      }
    })

    updateDuplicateMessage()
  }

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
      typeContainer.style.display = 'none'
      parentContainer.style.display = 'none'
      if (parentInputHidden) parentInputHidden.value = ''
      if (parentInputText) parentInputText.value = ''
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
})()
