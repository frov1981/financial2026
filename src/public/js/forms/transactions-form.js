document.addEventListener('DOMContentLoaded', () => {
  const originalType = document.getElementById('original-transaction-type')?.value || ''

  const radios = document.querySelectorAll('input[name="type"]')

  const accountField = document.querySelector('[data-field="account"]')
  const toAccountField = document.querySelector('[data-field="to_account"]')
  const categoryField = document.querySelector('[data-field="category"]')

  const categoryInput = categoryField?.querySelector('[data-autocomplete-input]')
  const categoryHidden = categoryField?.querySelector('[data-autocomplete-hidden]')
  const categoryLists = categoryField?.querySelectorAll(
    '[data-autocomplete-list][data-category-type]'
  )

  const amountInput = document.querySelector('#amount-input')
  const accountBalanceInput = document.querySelector('input[data-balance-target]')
  const toAccountBalanceInput = document.querySelector('input[data-balance-target-to]')
  const balanceFinal = document.querySelector('[data-balance-final]')

  /* ================================
     UTILIDADES
  ================================= */

  function format(n) {
    return (Number(n) || 0).toFixed(2)
  }

  function applyClass(el, value) {
    if (!el) return

    if (Number(value) > 0) {
      el.classList.add('amount-positive')
      el.classList.remove('amount-negative')
    } else {
      el.classList.add('amount-negative')
      el.classList.remove('amount-positive')
    }
  }

  /* ================================
     BLOQUEO DE RADIOS (UPDATE)
  ================================= */

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

  /* ================================
     CATEGORÍAS POR TIPO
  ================================= */

  function updateCategoryLists(type, reset = true) {
    if (!categoryLists) return

    categoryLists.forEach(list => {
      list.dataset.active = list.dataset.categoryType === type ? '1' : '0'
      list.classList.add('hidden')
    })

    if (reset && categoryInput && categoryHidden) {
      categoryInput.value = ''
      categoryHidden.value = ''
    }
  }



  /* ================================
     VISIBILIDAD DE CAMPOS
  ================================= */

  function updateVisibility(type, isInit = false) {
    if (type === 'transfer') {
      toAccountField?.classList.remove('hidden')
      categoryField?.classList.add('hidden')
    } else {
      toAccountField?.classList.add('hidden')
      categoryField?.classList.remove('hidden')
      updateCategoryLists(type, !isInit)
    }

    updateFinalBalance()
  }


  /* ================================
     BALANCE FINAL
  ================================= */

  function updateFinalBalance() {
    if (!balanceFinal) return

    const bal = parseFloat(accountBalanceInput?.value) || 0
    const amt = parseFloat(amountInput?.value) || 0

    const checked =
      document.querySelector('input[name="type"]:checked')?.value ||
      originalType ||
      'income'

    let final

    if (checked === 'income') {
      final = bal + amt
    } else {
      final = bal - amt
    }

    balanceFinal.value = format(final)
    applyClass(balanceFinal, final)
  }

  /* ================================
     EVENTOS
  ================================= */

  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      updateVisibility(radio.value)
    })
  })

  if (amountInput) {
    amountInput.addEventListener('input', updateFinalBalance)
  }

  document.addEventListener('account:balance', e => {
    const bal = e?.detail?.balance ?? null
    const field = e?.detail?.field || 'account'

    if (field === 'account' && accountBalanceInput) {
      accountBalanceInput.value = bal !== null ? format(bal) : ''
      applyClass(accountBalanceInput, bal)
    }

    if (field === 'to_account' && toAccountBalanceInput) {
      toAccountBalanceInput.value = bal !== null ? format(bal) : ''
      applyClass(toAccountBalanceInput, bal)
    }

    updateFinalBalance()
  })

  /* ================================
     INIT
  ================================= */

  lockRadiosByOriginalType()

  const checked = document.querySelector('input[name="type"]:checked')
  if (checked) {
    updateVisibility(checked.value, true)
  }


  setTimeout(updateFinalBalance, 50)
})
