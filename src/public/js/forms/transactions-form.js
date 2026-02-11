document.addEventListener('DOMContentLoaded', () => {
  const originalType = document.getElementById('original-transaction-type')?.value || ''

  const radios = document.querySelectorAll('input[name="type"]')

  /* Bloque Cuenta destino */
  const toAccountHiddenInput = document.querySelector('input[name="to_account"]')
  const toAccountBlock = toAccountHiddenInput?.closest('.mb-4')

  /* Bloque Categoría */
  const categoryHiddenInput = document.querySelector('input[name="category"]')
  const categoryBlock = categoryHiddenInput?.closest('.mb-4')

  const categoryAutocomplete = categoryBlock?.querySelector('.autocomplete')
  const categoryTextInput = categoryBlock?.querySelector('.autocomplete-input')
  const categoryHiddenInputReal = categoryBlock?.querySelector('.autocomplete-hidden')

  function lockRadiosByOriginalType() {
    if (!originalType) return

    radios.forEach(radio => {
      if (originalType === 'transfer' && radio.value !== 'transfer') {
        radio.disabled = true
      }

      if (
        (originalType === 'income' || originalType === 'expense') &&
        radio.value === 'transfer'
      ) {
        radio.disabled = true
      }
    })
  }

  function updateCategorySource(type) {
    if (!categoryAutocomplete) return

    if (type === 'income') {
      categoryAutocomplete.dataset.items = categoryAutocomplete.dataset.itemsIncome
    } else if (type === 'expense') {
      categoryAutocomplete.dataset.items = categoryAutocomplete.dataset.itemsExpense
    }

    reloadCategoryAutocomplete()
  }

  function clearCategory() {
    if (categoryTextInput) categoryTextInput.value = ''
    if (categoryHiddenInputReal) categoryHiddenInputReal.value = ''
  }

  function clearToAccount() {
    if (toAccountHiddenInput) toAccountHiddenInput.value = ''
  }

  function updateVisibility(type) {
    if (toAccountBlock) {
      if (type === 'transfer') {
        toAccountBlock.style.display = ''
      } else {
        toAccountBlock.style.display = 'none'
        clearToAccount()
      }
    }

    if (categoryBlock) {
      if (type === 'transfer') {
        categoryBlock.style.display = 'none'
        clearCategory()
      } else {
        categoryBlock.style.display = ''
        updateCategorySource(type)
      }
    }
  }

  function reloadCategoryAutocomplete() {
    if (!categoryAutocomplete) return

    const input_el = categoryAutocomplete.querySelector('.autocomplete-input')
    const hidden_el = categoryAutocomplete.querySelector('.autocomplete-hidden')
    const panel_el = categoryAutocomplete.querySelector('.autocomplete-panel')

    input_el.value = ''
    hidden_el.value = ''
    panel_el.innerHTML = ''

    // volver a inicializar SOLO este autocomplete
    setupAutocomplete(categoryAutocomplete)
  }


  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      updateVisibility(radio.value)
    })
  })

  lockRadiosByOriginalType()

  const checked = document.querySelector('input[name="type"]:checked')
  if (checked) {
    updateVisibility(checked.value)
  }
})
