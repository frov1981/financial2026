function saveFilters(key, data) {
  localStorage.setItem(key, JSON.stringify(data))
}

function loadFilters(key) {
  const raw = localStorage.getItem(key)
  return raw ? JSON.parse(raw) : null
}

function clearFilters(key) {
  localStorage.removeItem(key)
}

/* Exponer globalmente */
window.saveFilters = saveFilters
window.loadFilters = loadFilters
window.clearFilters = clearFilters
