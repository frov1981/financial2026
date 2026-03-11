document.addEventListener('DOMContentLoaded', () => {
  const originalType = document.getElementById('original-transaction-type')?.value || ''

  const radios = document.querySelectorAll('input[name="type"]')

  /* Bloque Cuenta destino */
  const toAccountHiddenInput = document.querySelector('input[name="to_account"]')
  const toAccountBlock = toAccountHiddenInput?.closest('.mb-4')

  /* Bloque Categoría */
  const categoryHiddenInput = document.querySelector('input[name="category"]')
  const categoryBlock = categoryHiddenInput?.closest('.mb-4')

  /* Bloque Cuenta origen */
  /* Bloque Cuenta origen */
  const accountHiddenInput = document.querySelector('input[name="account"]')
  const accountAutocomplete = accountHiddenInput?.closest('.autocomplete')

  const transferAccountItems =
    document.querySelector('input[name="to_account"]')
      ?.closest('.autocomplete')
      ?.dataset.items

  const originalAccountItems = accountAutocomplete?.dataset.items


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

  function updateAccountSource(type) {
    if (!accountAutocomplete) return

    if (type === 'transfer') {
      accountAutocomplete.dataset.items = transferAccountItems
    } else {
      accountAutocomplete.dataset.items = originalAccountItems
    }

    reloadAccountAutocomplete()
  }

  function updateVisibility(type) {
    updateAccountSource(type)

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

    if (!input_el || !hidden_el || !panel_el) return

    input_el.value = ''
    hidden_el.value = ''
    panel_el.innerHTML = ''

    // volver a inicializar SOLO este autocomplete
    // revisar la invocación global de setupAutocomplete en "src/public/js/forms/autocomplete-form.js" para evitar conflictos
    setupAutocomplete(categoryAutocomplete)
  }

  function reloadAccountAutocomplete() {
    if (!accountAutocomplete) return

    const input_el = accountAutocomplete.querySelector('.autocomplete-input')
    const hidden_el = accountAutocomplete.querySelector('.autocomplete-hidden')
    const panel_el = accountAutocomplete.querySelector('.autocomplete-panel')

    if (!input_el || !hidden_el || !panel_el) return

    input_el.value = ''
    hidden_el.value = ''
    panel_el.innerHTML = ''

    setupAutocomplete(accountAutocomplete)
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
