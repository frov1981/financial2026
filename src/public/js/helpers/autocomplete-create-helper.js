(() => {
  const storagePrefix = 'autocomplete-create:'
  const contextMeta = document.querySelector('meta[name="autocomplete-create-context"]')
  const resumeMeta = document.querySelector('meta[name="autocomplete-resume"]')

  const getFormState = () => Array.from(document.forms).map(form =>
    Array.from(form.elements).filter(control =>
      control.name &&
      control.name !== '_csrf' &&
      !['button', 'submit', 'reset', 'file', 'password'].includes(control.type)
    ).map(control => ({
      name: control.name,
      type: control.type,
      value: control.value,
      checked: control.type === 'checkbox' || control.type === 'radio' ? control.checked : undefined,
      selected: control instanceof HTMLSelectElement && control.multiple
        ? Array.from(control.selectedOptions).map(option => option.value)
        : undefined
    }))
  )

  const restoreFormState = state => {
    state.forEach((formState, formIndex) => {
      const form = document.forms[formIndex]
      if (!form) return

      const controls = Array.from(form.elements).filter(control =>
        control.name &&
        control.name !== '_csrf' &&
        !['button', 'submit', 'reset', 'file', 'password'].includes(control.type)
      )
      const controlsByName = new Map()
      controls.forEach(control => {
        const controlsForName = controlsByName.get(control.name) || []
        controlsForName.push(control)
        controlsByName.set(control.name, controlsForName)
      })
      const positions = new Map()

      formState.forEach(saved => {
        const position = positions.get(saved.name) || 0
        const control = controlsByName.get(saved.name)?.[position]
        positions.set(saved.name, position + 1)
        if (!control || control.type !== saved.type) return

        if (saved.type === 'checkbox' || saved.type === 'radio') {
          control.checked = saved.checked
        } else if (control instanceof HTMLSelectElement && control.multiple) {
          Array.from(control.options).forEach(option => {
            option.selected = saved.selected.includes(option.value)
          })
        } else {
          control.value = saved.value
        }
      })
    })
  }

  const setCreatedSelection = (field, label) => {
    if (!label) return
    const normalizedLabel = label.trim().toLocaleLowerCase()

    const select = Array.from(document.querySelectorAll('select')).find(element =>
      element.name === field
    )
    if (select) {
      const option = Array.from(select.options).find(candidate => {
        const text = candidate.textContent.trim().toLocaleLowerCase()
        return text === normalizedLabel || text.startsWith(`${normalizedLabel} (`)
      })
      if (option) select.value = option.value
    }

    const hidden = Array.from(document.querySelectorAll('.autocomplete-hidden')).find(element =>
      element.name === field
    )
    if (!hidden) return

    const autocomplete = hidden.closest('.autocomplete')
    const input = autocomplete?.querySelector('.autocomplete-input')
    if (!autocomplete || !input) return

    let items
    try {
      items = JSON.parse(autocomplete.dataset.items || '[]')
    } catch (error) {
      console.error('No se pudieron leer las opciones del autocomplete al restaurar el formulario.', error)
      return
    }

    const item = items.find(candidate =>
      String(candidate.name || '').trim().toLocaleLowerCase() === normalizedLabel
    )
    if (!item) return

    hidden.value = item.id
    input.value = item.name || ''
    hidden.dispatchEvent(new Event('change', { bubbles: true }))
    if (field === 'account' || field === 'to_account' || field === 'account_id' ||
      field === 'disbursement_account_id') {
      document.dispatchEvent(new CustomEvent('account:balance', {
        detail: { balance: Number(item.balance) || 0, field }
      }))
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-autocomplete-create-url]').forEach(container => {
      if (
        container.querySelector('.autocomplete-input[readonly]') ||
        container.querySelector('select:disabled')
      ) return

      const row = container.classList.contains('autocomplete-create-row')
        ? container
        : (() => {
            const wrapper = document.createElement('div')
            wrapper.className = 'autocomplete-create-row'
            container.before(wrapper)
            wrapper.appendChild(container)
            return wrapper
          })()
      const button = document.createElement('button')
      const label = container.dataset.autocompleteCreateLabel || 'Crear opción'
      button.type = 'button'
      button.className = 'autocomplete-create-button'
      button.textContent = '+'
      button.setAttribute('aria-label', label)
      button.title = label
      row.appendChild(button)

      button.addEventListener('click', () => {
        const form = document.forms[0]
        const field = container.dataset.autocompleteCreateField ||
          container.querySelector('.autocomplete-hidden')?.name ||
          container.querySelector('select')?.name
        const createUrl = container.dataset.autocompleteCreateUrl
        if (!form || !field || !createUrl) return

        const token = crypto.randomUUID()
        try {
          sessionStorage.setItem(`${storagePrefix}${token}`, JSON.stringify(getFormState()))
        } catch (error) {
          console.error('No se pudo conservar el formulario antes de crear la opción.', error)
          window.alert('No se pudo guardar temporalmente el formulario. Libera espacio del navegador e inténtalo nuevamente.')
          return
        }

        const destination = new URL(createUrl, window.location.origin)
        destination.searchParams.set('autocomplete_return_to', `${window.location.pathname}${window.location.search}`)
        destination.searchParams.set('autocomplete_return_token', token)
        destination.searchParams.set('autocomplete_return_field', field)
        if (destination.pathname === '/categories/insert') {
          const categoryType = container.dataset.autocompleteCreateType ||
            document.querySelector('input[name="type"]:checked')?.value
          if (categoryType === 'income' || categoryType === 'expense') {
            destination.searchParams.set('type', categoryType)
          }
          if (container.dataset.autocompleteCreateScope) {
            destination.searchParams.set(
              'type_for_payable_or_receivable',
              container.dataset.autocompleteCreateScope
            )
          }
        }
        window.location.assign(destination.href)
      })
    })

    if (contextMeta) {
      const context = contextMeta.dataset
      const cancelUrl = new URL(context.returnTo, window.location.origin)
      cancelUrl.searchParams.set('autocomplete_resume', context.returnToken)
      cancelUrl.searchParams.set('autocomplete_field', context.returnField)
      cancelUrl.searchParams.set('autocomplete_label', '')
      document.querySelectorAll('.crud-form-actions a').forEach(link => {
        if (link.textContent.trim().toLocaleLowerCase() === 'cancelar') {
          link.href = cancelUrl.pathname + cancelUrl.search
        }
      })

      document.querySelectorAll('form[method="post"], form:not([method])').forEach(form => {
        ;[
          ['autocomplete_return_to', context.returnTo],
          ['autocomplete_return_token', context.returnToken],
          ['autocomplete_return_field', context.returnField]
        ].forEach(([name, value]) => {
          if (!value || form.elements.namedItem(name)) return
          const input = document.createElement('input')
          input.type = 'hidden'
          input.name = name
          input.value = value
          form.appendChild(input)
        })
      })
    }

    if (!resumeMeta) return
    const { token, field, label } = resumeMeta.dataset
    const storageKey = `${storagePrefix}${token}`
    const savedState = sessionStorage.getItem(storageKey)
    if (!savedState) {
      console.error('No se encontró el estado del formulario que se debía restaurar.')
      return
    }

    try {
      restoreFormState(JSON.parse(savedState))
      setCreatedSelection(field, label)
      sessionStorage.removeItem(storageKey)
    } catch (error) {
      console.error('No se pudo restaurar el formulario después de crear la opción.', error)
      window.alert('No se pudo restaurar el formulario. Los datos guardados siguen disponibles en esta pestaña.')
      return
    }

    const url = new URL(window.location.href)
    ;['autocomplete_resume', 'autocomplete_field', 'autocomplete_label'].forEach(name =>
      url.searchParams.delete(name)
    )
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  })
})()
