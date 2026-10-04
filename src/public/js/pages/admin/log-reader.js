const logReaderForm = document.querySelector('.admin-log-filter')
const logFilterInput = document.getElementById('log-filter')
const logEventFilter = document.getElementById('log-event-filter')
const logContent = document.getElementById('log-content')
const logRecords = document.getElementById('admin-log-records')
const logReaderStatus = document.getElementById('log-reader-status')
const logTypeFilterModal = document.getElementById('log-type-filter-modal')
const logTypeFilterButton = document.getElementById('log-type-filter-button')
const logTypeFilterApply = document.getElementById('log-type-filter-apply')
const logTypeFilterCancel = document.getElementById('log-type-filter-cancel')
const logUserFilter = document.getElementById('log-user-filter')
const logRefreshButton = document.getElementById('log-refresh-button')
const logPageSize = 100
const LEGACY_ADMIN_LOG_FILE_STORAGE_KEY = `ssrfinan:v1:user:${window.USER_ID}:admin:selected-log-file`
const logReaderFiltersStorageKey = `ssrfinan:v1:user:${window.USER_ID}:admin:log-reader-filters`
const logReaderPositionStorageKey = `ssrfinan:v1:user:${window.USER_ID}:admin:log-number:${window.ADMIN_LOG_FILE_NUMBER}:position`
const legacyLogReaderStorageKey = `ssrfinan:v1:user:${window.USER_ID}:admin:log-number:${window.ADMIN_LOG_FILE_NUMBER}:state`
let displayedLines = logRecords?.querySelectorAll('.admin-log-row').length || 0
let totalLines = Number(logReaderStatus?.textContent.match(/\d+\s+de\s+(\d+)/)?.[1] || 0)
let requestSequence = 0
let isLoading = false
let activeRequestController = null

function debounce(fn, delay) {
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

function getSelectedLogTypes() {
  return Array.from(document.querySelectorAll('input[name="log-type"]:checked'))
    .map(input => input.value)
}

function saveLogReaderState() {
  window.saveFilters(logReaderFiltersStorageKey, {
    filter: logFilterInput?.value || '',
    eventFilter: logEventFilter?.value || 'all',
    levels: getSelectedLogTypes(),
    userId: logUserFilter?.value || 'all',
  })
  window.saveFilters(logReaderPositionStorageKey, {
    displayedLines,
    scrollTop: logContent?.scrollTop || 0,
  })
}

function formatLocalTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  const pad = number => String(number).padStart(2, '0')
  const milliseconds = String(date.getMilliseconds()).padStart(3, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}:${milliseconds}`
}

function appendLogRecords(records) {
  if (!logRecords) return
  records.forEach(record => {
    const index = logRecords.querySelectorAll('.admin-log-row').length
    const detailId = `admin-log-detail-${index}`
    const row = document.createElement('tr')
    row.className = 'admin-log-row'
    if (record.level) {
      row.classList.add(`admin-log-level-${record.level.toLowerCase()}`)
    }

    const expandCell = document.createElement('td')
    const expandButton = document.createElement('button')
    expandButton.className = 'admin-log-expand'
    expandButton.type = 'button'
    expandButton.setAttribute('aria-expanded', 'false')
    expandButton.setAttribute('aria-controls', detailId)
    expandButton.setAttribute('aria-label', 'Expandir propiedades del registro')
    const icon = document.createElement('span')
    icon.setAttribute('aria-hidden', 'true')
    icon.innerHTML = iconChevronOpen()
    expandButton.append(icon)
    expandCell.append(expandButton)

    const timeCell = document.createElement('td')
    timeCell.className = 'admin-log-time'
    timeCell.dataset.time = record.time || ''
    timeCell.textContent = formatLocalTime(record.time)

    const levelCell = document.createElement('td')
    levelCell.className = 'admin-log-level-name'
    levelCell.textContent = record.levelName || '—'

    const eventCell = document.createElement('td')
    eventCell.className = 'admin-log-event-name'
    eventCell.textContent = record.eventName || '—'

    const methodCell = document.createElement('td')
    methodCell.className = 'admin-log-method'
    methodCell.textContent = record.method || '—'
    row.dataset.detailId = detailId
    row.append(expandCell, timeCell, levelCell, eventCell, methodCell)

    const detailRow = document.createElement('tr')
    detailRow.id = detailId
    detailRow.className = 'admin-log-detail-row'
    detailRow.hidden = true
    const detailCell = document.createElement('td')
    detailCell.colSpan = 5
    const detailContent = document.createElement('div')
    detailContent.className = 'admin-log-detail-content'
    const propertiesTable = document.createElement('table')
    propertiesTable.className = 'admin-log-properties'
    const propertiesBody = document.createElement('tbody')
    record.properties.forEach(property => {
      const propertyRow = document.createElement('tr')
      if (property.name === 'Evento') {
        propertyRow.className = 'admin-log-event-property'
      }
      const nameCell = document.createElement('th')
      nameCell.scope = 'row'
      nameCell.textContent = property.name
      const valueCell = document.createElement('td')
      valueCell.textContent = property.value
      propertyRow.append(nameCell, valueCell)
      propertiesBody.append(propertyRow)
    })
    propertiesTable.append(propertiesBody)
    detailContent.append(propertiesTable)
    detailCell.append(detailContent)
    detailRow.append(detailCell)
    logRecords.append(row, detailRow)
  })
}

logRecords?.querySelectorAll('.admin-log-time').forEach(cell => {
  cell.textContent = formatLocalTime(cell.dataset.time)
})

logRecords?.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return
  const row = event.target.closest('.admin-log-row')
  if (!row) return
  const button = row.querySelector('.admin-log-expand')
  const detailId = row.dataset.detailId
  const detailRow = detailId ? document.getElementById(detailId) : null
  if (!detailRow) return
  const expanded = button.getAttribute('aria-expanded') === 'true'
  button.setAttribute('aria-expanded', String(!expanded))
  button.setAttribute('aria-label', expanded ? 'Expandir propiedades del registro' : 'Contraer propiedades del registro')
  button.querySelector('span').innerHTML = expanded ? iconChevronOpen() : iconChevronClose()
  detailRow.hidden = expanded
})

logRecords?.addEventListener('keydown', event => {
  if (!(event.target instanceof Element) || !['Enter', ' '].includes(event.key)) return
  const row = event.target.closest('.admin-log-row')
  if (!row || event.target.closest('.admin-log-expand')) return
  event.preventDefault()
  row.querySelector('.admin-log-expand')?.click()
})

function getRequestParams() {
  const params = new URLSearchParams(new FormData(logReaderForm))
  getSelectedLogTypes().forEach(level => params.append('level', level))
  return params
}

async function updateLogReader({ reset = false } = {}) {
  if (!logReaderForm || !logFilterInput || !logContent || !logReaderStatus) return
  if (reset) {
    activeRequestController?.abort()
    isLoading = false
    displayedLines = 0
    totalLines = 0
    logRecords.replaceChildren()
    logContent.scrollTop = 0
    saveLogReaderState()
  } else if (displayedLines >= totalLines) {
    return
  }
  if (isLoading) return

  const sequence = ++requestSequence
  const displayParams = getRequestParams()
  const requestParams = new URLSearchParams(displayParams)
  requestParams.set('offset', String(displayedLines))
  const url = `${logReaderForm.action}?${requestParams.toString()}`
  activeRequestController = new AbortController()

  try {
    isLoading = true
    const response = await fetch(url, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
      signal: activeRequestController.signal,
    })
    if (!response.ok) {
      const message = await response.text()
      throw new Error(message || `Error al filtrar los registros (${response.status})`)
    }

    const result = await response.json()
    if (sequence !== requestSequence) return
    appendLogRecords(result.records)
    displayedLines = result.displayedLines
    totalLines = result.totalLines
    logReaderStatus.textContent = `${displayedLines} de ${totalLines} líneas`
    history.replaceState(null, '', `${logReaderForm.action}?${displayParams.toString()}`)
    saveLogReaderState()
  } catch (error) {
    if (sequence === requestSequence && !(error instanceof DOMException && error.name === 'AbortError')) {
      logReaderStatus.textContent = error instanceof Error
        ? error.message
        : 'No se pudieron filtrar los registros.'
    }
  } finally {
    if (sequence === requestSequence) {
      isLoading = false
      activeRequestController = null
    }
  }
}

async function refreshLogReader() {
  if (!logContent || !logRefreshButton || isLoading) return

  const previousDisplayedLines = displayedLines
  const previousScrollTop = logContent.scrollTop
  logRefreshButton.disabled = true
  logRefreshButton.setAttribute('aria-busy', 'true')

  try {
    await updateLogReader({ reset: true })
    while (displayedLines < previousDisplayedLines && displayedLines < totalLines) {
      const previousCount = displayedLines
      await updateLogReader()
      if (displayedLines === previousCount) break
    }
    logContent.scrollTop = previousScrollTop
    saveLogReaderState()
  } finally {
    logRefreshButton.disabled = false
    logRefreshButton.removeAttribute('aria-busy')
  }
}

const debouncedFilterLogReader = debounce(() => updateLogReader({ reset: true }), 300)
const debouncedSavePosition = debounce(saveLogReaderState, 150)

logFilterInput?.addEventListener('input', () => {
  saveLogReaderState()
  debouncedFilterLogReader()
})
logReaderForm?.addEventListener('submit', event => {
  event.preventDefault()
  debouncedFilterLogReader()
})

logContent?.addEventListener('scroll', () => {
  debouncedSavePosition()
  const nearBottom = logContent.scrollTop + logContent.clientHeight >= logContent.scrollHeight - 40
  if (nearBottom && !isLoading && displayedLines < totalLines) updateLogReader()
})

logTypeFilterButton?.addEventListener('click', () => logTypeFilterModal?.showModal())
logTypeFilterCancel?.addEventListener('click', () => logTypeFilterModal?.close())
logTypeFilterApply?.addEventListener('click', () => {
  if (getSelectedLogTypes().length === 0) return
  logTypeFilterModal?.close()
  saveLogReaderState()
  debouncedFilterLogReader()
})
logRefreshButton?.addEventListener('click', refreshLogReader)

const savedLogReaderPosition = window.loadFilters(logReaderPositionStorageKey)
const savedLogReaderFilters = window.loadFilters(logReaderFiltersStorageKey)
const legacyLogReaderState = window.loadFilters(legacyLogReaderStorageKey)
const savedLogReaderState = savedLogReaderFilters || legacyLogReaderState
if (savedLogReaderState && typeof savedLogReaderState === 'object') {
  if (typeof savedLogReaderState.filter === 'string') {
    logFilterInput.value = savedLogReaderState.filter
  }
  if (typeof savedLogReaderState.eventFilter === 'string' && logEventFilter) {
    const eventFilterContainer = logEventFilter.closest('.autocomplete')
    if (eventFilterContainer) {
      const eventOptions = JSON.parse(eventFilterContainer.dataset.items || '[]')
      const savedEventFilter = eventOptions.some(option => String(option.id) === savedLogReaderState.eventFilter)
        ? savedLogReaderState.eventFilter
        : 'all'
      logEventFilter.value = savedEventFilter
      eventFilterContainer.dataset.defaultId = savedEventFilter
    }
  }
  if (Array.isArray(savedLogReaderState.levels) && savedLogReaderState.levels.length > 0) {
    document.querySelectorAll('input[name="log-type"]').forEach(input => {
      input.checked = savedLogReaderState.levels.includes(input.value)
    })
  }
  if (
    typeof savedLogReaderState.userId === 'string'
    && (savedLogReaderState.userId === 'all'
      || savedLogReaderState.userId === 'null'
      || /^(0|[1-9]\d*)$/.test(savedLogReaderState.userId))
  ) {
    const userFilterContainer = logUserFilter?.closest('.autocomplete')
    if (logUserFilter && userFilterContainer) {
      const userOptions = JSON.parse(userFilterContainer.dataset.items || '[]')
      if (!userOptions.some(option => String(option.id) === savedLogReaderState.userId)) {
        userOptions.push({
          id: savedLogReaderState.userId,
          name: `Usuario ${savedLogReaderState.userId}`,
        })
        userFilterContainer.dataset.items = JSON.stringify(userOptions)
      }
      logUserFilter.value = savedLogReaderState.userId
      userFilterContainer.dataset.defaultId = savedLogReaderState.userId
    }
  }

  const queryParams = new URLSearchParams(window.location.search)
  const queryLevels = queryParams.getAll('level')
  const effectiveQueryLevels = queryLevels.length > 0
    ? queryLevels
    : ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']
  const selectedLevels = getSelectedLogTypes()
  const selectedUserId = logUserFilter?.value || 'all'
  const selectedEvent = logEventFilter?.value || 'all'
  const stateMatchesUrl = savedLogReaderState.filter === (queryParams.get('filter') || '')
    && selectedEvent === (queryParams.get('eventFilter') || 'all')
    && effectiveQueryLevels.length === selectedLevels.length
    && effectiveQueryLevels.every(level => selectedLevels.includes(level))
    && selectedUserId === (queryParams.get('userId') || 'all')
  const targetLines = Number.isSafeInteger(savedLogReaderPosition?.displayedLines)
    ? savedLogReaderPosition.displayedLines
    : Number.isSafeInteger(legacyLogReaderState?.displayedLines)
      ? legacyLogReaderState.displayedLines
      : displayedLines
  const targetScrollTop = Number.isFinite(savedLogReaderPosition?.scrollTop)
    ? savedLogReaderPosition.scrollTop
    : Number.isFinite(legacyLogReaderState?.scrollTop)
      ? legacyLogReaderState.scrollTop
      : 0

  const restorePosition = async () => {
    if (!stateMatchesUrl) {
      await updateLogReader({ reset: true })
    }
    while (displayedLines < targetLines && displayedLines < totalLines) {
      const previousDisplayedLines = displayedLines
      await updateLogReader()
      if (displayedLines === previousDisplayedLines) break
    }
    logContent.scrollTop = targetScrollTop
    saveLogReaderState()
  }
  restorePosition()
}

window.clearFilters(LEGACY_ADMIN_LOG_FILE_STORAGE_KEY)
