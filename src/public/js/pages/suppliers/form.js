(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.querySelector('form[action="/suppliers/"]')
    const mode = form?.querySelector('[name="mode"]')?.value
    if (mode !== 'delete') return

    form.addEventListener('submit', event => {
      const confirmed = window.confirm('¿Estás seguro de que deseas eliminar este proveedor?')
      if (!confirmed) event.preventDefault()
    })
  })
})()
