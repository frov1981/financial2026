(() => {
/*
  category-form.js

  Archivo intencionalmente vacío de lógica.
  Este formulario es procesado completamente por el backend.

  Responsabilidades del backend:
  - Validación de campos
  - Control de modos (insert / update / status)
  - Persistencia en base de datos
  - Manejo de errores y mensajes

  Este archivo existe solo para:
  - Mantener coherencia estructural del proyecto
  - Facilitar futuras extensiones (si fueran necesarias)
*/

document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.querySelector('input[name="name"][aria-controls="account-name-suggestions"]')
  const suggestions = document.getElementById('account-name-suggestions')

  if (nameInput && suggestions) {
    const currentAccountId = document.querySelector('input[name="id"]')?.value || ''
    const suggestionItems = Array.from(suggestions.querySelectorAll('[data-account-name]'))
    const noResults = suggestions.querySelector('.account-name-no-results')
    const duplicateMessage = document.querySelector('.account-name-duplicate')
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
        item.dataset.accountName.toLowerCase() === name &&
        item.dataset.accountId !== currentAccountId
      )

      duplicateMessage.hidden = !duplicateExists
      duplicateMessage.textContent = duplicateExists
        ? 'Ya existe una cuenta con este nombre.'
        : ''
    }
    const filterSuggestions = () => {
      const query = nameInput.value.trim().toLowerCase()
      let visibleCount = 0

      suggestionItems.forEach(item => {
        const matches = item.dataset.accountName.toLowerCase().includes(query)
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
      nameInput.value = item.dataset.accountName
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
      const item = event.target.closest('[data-account-name]')
      if (item) selectSuggestion(item)
    })
    document.addEventListener('click', event => {
      if (!nameInput.closest('.account-name-autocomplete').contains(event.target)) {
        closeSuggestions()
      }
    })

    updateDuplicateMessage()
  }

  /* 
    No se requiere lógica de frontend para este formulario.
    El submit es tradicional (POST) y el backend controla el flujo.
  */
})
})()
