const FILTER_KEYS_STORAGE_KEY = 'app.filter-keys.v1'

function getFilterKeys() {
  try {
    const keys = JSON.parse(localStorage.getItem(FILTER_KEYS_STORAGE_KEY) || '[]')
    return Array.isArray(keys) ? keys.filter(key => typeof key === 'string') : []
  } catch {
    return []
  }
}

function registerFilterKey(key) {
  if (typeof key !== 'string' || !key) return
  const keys = getFilterKeys()
  if (!keys.includes(key)) {
    keys.push(key)
    localStorage.setItem(FILTER_KEYS_STORAGE_KEY, JSON.stringify(keys))
  }
}

function saveFilters(key, data) {
  registerFilterKey(key)
  localStorage.setItem(key, JSON.stringify(data))
}

function loadFilters(key) {
  registerFilterKey(key)
  const raw = localStorage.getItem(key)
  return raw ? JSON.parse(raw) : null
}

function clearFilters(key) {
  registerFilterKey(key)
  localStorage.removeItem(key)
}

function getFilterSnapshot() {
  const state = {}
  for (const key of getFilterKeys()) {
    const raw = localStorage.getItem(key)
    if (raw !== null) state[key] = JSON.parse(raw)
  }
  return state
}

function restoreFilterSnapshot(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) {
    throw new Error('El estado remoto de filtros no tiene un formato válido')
  }

  const knownKeys = new Set([...getFilterKeys(), ...Object.keys(state)])
  for (const key of knownKeys) {
    if (Object.prototype.hasOwnProperty.call(state, key)) {
      localStorage.setItem(key, JSON.stringify(state[key]))
    } else {
      localStorage.removeItem(key)
    }
  }
  localStorage.setItem(FILTER_KEYS_STORAGE_KEY, JSON.stringify([...knownKeys]))
}

/* Exponer globalmente */
window.saveFilters = saveFilters
window.loadFilters = loadFilters
window.clearFilters = clearFilters
window.getFilterSnapshot = getFilterSnapshot
window.restoreFilterSnapshot = restoreFilterSnapshot
