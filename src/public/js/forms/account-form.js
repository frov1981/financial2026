document.addEventListener('DOMContentLoaded', () => {

  console.log('DOM ready')

  const btnRecalculate = document.getElementById('btnRecalculate')
  const overlay = document.getElementById('overlay')

  if (!btnRecalculate) {
    console.error('btnRecalculate not found')
    return
  } 

  btnRecalculate.addEventListener('click', async () => {

    overlay.classList.remove('hidden')
    btnRecalculate.disabled = true

    try {
      const response = await fetch('/api/accounts/recalculate-balances', {
        method: 'POST'
      })

      const result = await response.json()

      if (result.success) {
        MessageBox.success(result.message)
        await loadAccounts()
      } else {
        MessageBox.error(result.message)
      }

    } catch (error) {
      console.error(error)
      MessageBox.error('Error inesperado')
    } finally {
      overlay.classList.add('hidden')
      btnRecalculate.disabled = false
    }
  })
})
