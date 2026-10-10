document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.querySelector('input[name="name"][aria-controls="receivable-name-suggestions"]')
  const suggestions = document.getElementById('receivable-name-suggestions')

  if (!nameInput || !suggestions) return

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
})
