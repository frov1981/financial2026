(() => {
  const DEVICE_ID_KEY = 'app.device-id.v1'
  const RESTORED_SESSION_KEY = 'app.device-preferences-restored'
  const SYNC_INTERVAL_MS = 30 * 60 * 1000

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

  function hasSameState(left, right) {
    const left_keys = Object.keys(left).sort()
    const right_keys = Object.keys(right).sort()
    return left_keys.length === right_keys.length
      && left_keys.every((key, index) => key === right_keys[index]
        && JSON.stringify(left[key]) === JSON.stringify(right[key]))
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
  }

  async function restoreDevicePreferences() {
    const user_id = String(window.USER_ID || '')
    const restored_key = `${RESTORED_SESSION_KEY}.${user_id}`
    if (sessionStorage.getItem(restored_key)) return

    const query = new URLSearchParams({ device_id: getDeviceId() })
    const response = await fetch(`/device-preferences?${query}`, { credentials: 'same-origin' })
    if (!response.ok) throw new Error(`Error cargando preferencias (${response.status})`)

    const result = await response.json()
    if (result.state) {
      const local_state = window.getFilterSnapshot()
      const remote_state = result.state
      const changed = !hasSameState(local_state, remote_state)
      window.restoreFilterSnapshot(remote_state)
      sessionStorage.setItem(restored_key, 'true')
      if (changed) {
        window.location.reload()
        return
      }
    } else {
      sessionStorage.setItem(restored_key, 'true')
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    restoreDevicePreferences().catch(error => {
      console.error('No se pudieron restaurar las preferencias del dispositivo', error)
    })

    window.setInterval(() => {
      saveDevicePreferences().catch(error => {
        console.error('No se pudieron guardar las preferencias del dispositivo', error)
      })
    }, SYNC_INTERVAL_MS)

    document.querySelectorAll('a[href="/logout"]').forEach(link => {
      link.addEventListener('click', async event => {
        event.preventDefault()
        try {
          await saveDevicePreferences()
        } catch (error) {
          console.error('No se pudieron guardar las preferencias antes de cerrar sesión', error)
        }
        sessionStorage.removeItem(`${RESTORED_SESSION_KEY}.${String(window.USER_ID || '')}`)
        window.location.assign(link.href)
      })
    })
  })
})()
