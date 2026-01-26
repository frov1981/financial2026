/* ============================================================================
   Timezone helper
   Inyecta el timezone del navegador en todos los formularios
============================================================================ */

(function () {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  document.addEventListener('submit', function (e) {
    const form = e.target
    if (!(form instanceof HTMLFormElement)) return

    if (!form.querySelector('input[name="timezone"]')) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = 'timezone'
      input.value = timezone
      form.appendChild(input)
    }
  })
})()
