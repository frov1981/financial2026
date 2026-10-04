(() => {
  const DEVICE_ID_KEY = 'app.device-id.v1'

  function getDeviceId() {
    let device_id = localStorage.getItem(DEVICE_ID_KEY)
    if (!device_id) {
      device_id = crypto.randomUUID()
      localStorage.setItem(DEVICE_ID_KEY, device_id)
    }
    return device_id
  }

  function getCsrfToken() {
    return window.CSRF_TOKEN || document.querySelector('meta[name="csrf-token"]')?.content || ''
  }

  function setCsrfToken(token) {
    if (!token) return
    window.CSRF_TOKEN = token
    const meta = document.querySelector('meta[name="csrf-token"]')
    if (meta) meta.content = token
  }

  async function saveDevicePreferences() {
    const response = await fetch('/device-preferences', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCsrfToken(),
      },
      body: JSON.stringify({
        device_id: getDeviceId(),
        state: window.getFilterSnapshot(),
      }),
    })

    if (!response.ok) throw new Error(`Error guardando preferencias (${response.status})`)
    const result = await response.json()
    setCsrfToken(result.csrfToken)
    return result.saved === true
  }

  async function restoreDevicePreferences() {
    const query = new URLSearchParams({ device_id: getDeviceId() })
    const response = await fetch(`/device-preferences?${query}`, { credentials: 'same-origin' })
    if (!response.ok) throw new Error(`Error cargando preferencias (${response.status})`)

    const result = await response.json()
    if (!result.state || typeof result.state !== 'object' || Array.isArray(result.state)) return false

    window.restoreFilterSnapshot(result.state)
    return true
  }

  window.saveDevicePreferences = saveDevicePreferences
  window.restoreDevicePreferences = restoreDevicePreferences
})()
