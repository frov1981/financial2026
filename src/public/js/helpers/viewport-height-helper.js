(function initializeViewportHeight() {
  const storageKey = 'ssrfinan.viewport.height.v1'
  const root = document.documentElement
  const currentHeight = Math.round(window.innerHeight)
  const isValidHeight = value => Number.isFinite(value) && value >= 320 && value <= 10000

  if (window.APP_VIEWPORT_RESET === true) {
    sessionStorage.removeItem(storageKey)
  }

  const storedHeight = Number(sessionStorage.getItem(storageKey))
  const viewportHeight = isValidHeight(storedHeight) ? storedHeight : currentHeight

  if (!isValidHeight(storedHeight)) {
    sessionStorage.setItem(storageKey, String(viewportHeight))
  }

  window.APP_VIEWPORT_HEIGHT = viewportHeight
  root.style.setProperty('--app-viewport-height', `${viewportHeight}px`)
})()
