(() => {
  const API_BASE = '/suppliers/list'
  const FILTERS_KEY = `ssrfinan:v1:user:${window.USER_ID}:suppliers:filters`
  const STATUS_KEY = `ssrfinan:v1:user:${window.USER_ID}:suppliers:status-filter`
  const SCROLL_KEY = `ssrfinan:v1:user:${window.USER_ID}:suppliers:scroll-position`
  const STATUS_FILTERS = ['all', 'active', 'inactive']

  let allSuppliers = []

  const searchInput = document.getElementById('search-input')
  const clearBtn = document.getElementById('clear-search-btn')
  const searchBtn = document.getElementById('search-btn')
  const tableBody = document.getElementById('suppliers-table')
  const mobileContainer = document.getElementById('suppliers-mobile')
  const scrollContainer = document.querySelector('.ui-scroll-area')
  const statusToggleBtn = document.querySelector('.js-status-filter-toggle')

  window.STATUS_FILTER_KEY = STATUS_KEY

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character])

  const displayValue = value => value ? escapeHtml(value) : '<span class="supplier-muted">—</span>'
  const primaryEmail = supplier => supplier.email_1 || supplier.email_2 || ''
  const primaryWhatsapp = supplier => supplier.whatsapp_1 || supplier.whatsapp_2 || ''
  const statusTag = active => `<span class="supplier-status ${active ? 'is-active' : 'is-inactive'}">${active ? 'Activo' : 'Inactivo'}</span>`

  function getFilteredSuppliers() {
    const filters = loadFilters(FILTERS_KEY)
    const statusFilters = loadFilters(STATUS_KEY)
    const term = filters?.term?.toLowerCase() || ''
    const status = statusFilters?.status || 'all'

    return allSuppliers.filter(supplier => {
      const searchable = [
        supplier.business_name, supplier.tax_id, supplier.address_1, supplier.address_2,
        supplier.mobile_1, supplier.mobile_2, supplier.whatsapp_1, supplier.whatsapp_2,
        supplier.email_1, supplier.email_2
      ].filter(Boolean).join(' ').toLowerCase()
      const matchText = !term || searchable.includes(term)
      const matchStatus = status === 'all' ||
        (status === 'active' && supplier.is_active) ||
        (status === 'inactive' && !supplier.is_active)
      return matchText && matchStatus
    })
  }

  function renderRow(supplier) {
    return `
      <tr id="supplier-${supplier.id}" class="${supplier.is_active ? '' : 'bg-red-50'}">
        <td class="ui-td col-left supplier-name-cell">
          <div class="supplier-table-name">
            <button type="button" class="supplier-expand supplier-row-expand" aria-expanded="false"
              aria-controls="supplier-details-${supplier.id}"
              aria-label="Mostrar más información de ${escapeHtml(supplier.business_name)}">
              <span class="supplier-chevron" aria-hidden="true"></span>
            </button>
            ${displayValue(supplier.business_name)}
          </div>
        </td>
        <td class="ui-td col-left">${displayValue(primaryEmail(supplier))}</td>
        <td class="ui-td col-left">${displayValue(primaryWhatsapp(supplier))}</td>
        <td class="ui-td col-left">${displayValue(supplier.tax_id)}</td>
        <td class="ui-td col-left">${statusTag(supplier.is_active)}</td>
        <td class="ui-td col-center">
          <div class="icon-actions">
            <button type="button" class="icon-btn edit" aria-label="Editar proveedor"
              onclick="goToSupplierUpdate(${supplier.id})">${iconEdit()}</button>
            <button type="button" class="icon-btn delete" aria-label="Eliminar proveedor"
              onclick="goToSupplierDelete(${supplier.id})">${iconDelete()}</button>
          </div>
        </td>
      </tr>
      <tr id="supplier-details-${supplier.id}" class="supplier-table-details" hidden>
        <td class="ui-td" colspan="6">
          ${renderSupplierDetails(supplier)}
        </td>
      </tr>
    `
  }

  function renderSupplierDetails(supplier) {
    return `
      <dl class="supplier-details-grid">
        <div><dt>RUC</dt><dd>${displayValue(supplier.tax_id)}</dd></div>
        <div><dt>Móvil 1</dt><dd>${displayValue(supplier.mobile_1)}</dd></div>
        <div><dt>Móvil 2</dt><dd>${displayValue(supplier.mobile_2)}</dd></div>
        <div><dt>WhatsApp 1</dt><dd>${displayValue(supplier.whatsapp_1)}</dd></div>
        <div><dt>WhatsApp 2</dt><dd>${displayValue(supplier.whatsapp_2)}</dd></div>
        <div><dt>Correo 1</dt><dd>${displayValue(supplier.email_1)}</dd></div>
        <div><dt>Correo 2</dt><dd>${displayValue(supplier.email_2)}</dd></div>
        <div class="supplier-address"><dt>Dirección 1</dt><dd>${displayValue(supplier.address_1)}</dd></div>
        <div class="supplier-address"><dt>Dirección 2</dt><dd>${displayValue(supplier.address_2)}</dd></div>
        <div><dt>Estado</dt><dd>${statusTag(supplier.is_active)}</dd></div>
        <div><dt>Creado</dt><dd>${displayValue(formatDate(supplier.created_at))}</dd></div>
        <div><dt>Actualizado</dt><dd>${displayValue(formatDate(supplier.updated_at))}</dd></div>
      </dl>
    `
  }

  function formatDate(value) {
    if (!value) return ''
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString()
  }

  function renderCard(supplier) {
    return `
      <article class="supplier-card ${supplier.is_active ? '' : 'inactive'}" data-id="${supplier.id}">
        <div class="supplier-card-main">
          <button type="button" class="supplier-expand" aria-expanded="false"
            aria-label="Mostrar más información de ${escapeHtml(supplier.business_name)}">
            <span class="supplier-chevron" aria-hidden="true"></span>
          </button>
          <div class="supplier-primary">
            <h2 class="supplier-card-title">${displayValue(supplier.business_name)}</h2>
            <div class="supplier-primary-line"><span class="supplier-line-label">Correo</span>${displayValue(primaryEmail(supplier))}</div>
            <div class="supplier-primary-line"><span class="supplier-line-label">WhatsApp</span>${displayValue(primaryWhatsapp(supplier))}</div>
          </div>
        </div>
        <div class="supplier-card-details" hidden>
          ${renderSupplierDetails(supplier)}
          <div class="supplier-card-actions">
            <button type="button" class="icon-btn edit" onclick="goToSupplierUpdate(${supplier.id})">
              ${iconEdit()}<span>Editar</span>
            </button>
            <button type="button" class="icon-btn delete" onclick="goToSupplierDelete(${supplier.id})">
              ${iconDelete()}<span>Eliminar</span>
            </button>
          </div>
        </div>
      </article>
    `
  }

  function restoreScroll() {
    const saved = loadFilters(SCROLL_KEY)
    if (typeof saved?.y !== 'number' || !scrollContainer) return
    requestAnimationFrame(() => { scrollContainer.scrollTop = saved.y })
  }

  function render() {
    const suppliers = getFilteredSuppliers()
    const emptyMessage = allSuppliers.length
      ? 'No se encontraron proveedores con esos filtros'
      : 'Aún no tienes proveedores registrados'

    tableBody.innerHTML = suppliers.length
      ? suppliers.map(renderRow).join('')
      : `<tr><td colspan="6" class="ui-td col-center text-gray-500">${emptyMessage}</td></tr>`
    mobileContainer.innerHTML = suppliers.length
      ? suppliers.map(renderCard).join('')
      : `<div class="ui-empty">${emptyMessage}</div>`
    restoreScroll()
  }

  function syncStatusFilterButton(status) {
    if (!statusToggleBtn) return
    const icon = statusToggleBtn.querySelector('.ui-btn-icon')
    const text = statusToggleBtn.querySelector('.ui-btn-text')
    if (icon) icon.innerHTML = status === 'active' ? iconView() : status === 'inactive' ? iconViewOff() : iconList()
    if (text) text.textContent = status === 'active' ? 'Activos' : status === 'inactive' ? 'Inactivos' : 'Todos'
    statusToggleBtn.dataset.status = status
  }

  async function loadSuppliers() {
    try {
      const response = await fetch(API_BASE, { headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`Error HTTP ${response.status}`)
      const suppliers = await response.json()
      if (!Array.isArray(suppliers)) throw new Error('La respuesta de proveedores no tiene el formato esperado')
      allSuppliers = suppliers

      const filters = loadFilters(FILTERS_KEY)
      if (filters?.term && searchInput) {
        searchInput.value = filters.term
        clearBtn?.classList.remove('hidden')
      }
      const status = loadFilters(STATUS_KEY)?.status
      syncStatusFilterButton(STATUS_FILTERS.includes(status) ? status : 'all')
      render()
    } catch (error) {
      console.error('No se pudieron cargar los proveedores', error)
      const message = 'No fue posible cargar los proveedores. Intenta nuevamente.'
      tableBody.innerHTML = `<tr><td colspan="6" class="ui-td col-center text-red-600">${message}</td></tr>`
      mobileContainer.innerHTML = `<div class="ui-empty text-red-600">${message}</div>`
    }
  }

  function applySearch() {
    saveFilters(FILTERS_KEY, { term: searchInput?.value.trim() || '' })
    saveFilters(SCROLL_KEY, { y: 0 })
    render()
  }

  function applyStatusFilter(status) {
    if (!STATUS_FILTERS.includes(status)) return
    saveFilters(STATUS_KEY, { status })
    syncStatusFilterButton(status)
    render()
  }

  function debounce(callback, delay) {
    let timeout
    return (...args) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => callback(...args), delay)
    }
  }

  function goToSupplierUpdate(id) {
    location.href = `/suppliers/update/${id}`
  }

  function goToSupplierDelete(id) {
    location.href = `/suppliers/delete/${id}`
  }

  const debouncedSearch = debounce(applySearch, 300)

  searchBtn?.addEventListener('click', applySearch)
  searchInput?.addEventListener('input', () => {
    clearBtn?.classList.toggle('hidden', !searchInput.value)
    debouncedSearch()
  })
  clearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = ''
    clearBtn.classList.add('hidden')
    clearFilters(FILTERS_KEY)
    render()
  })
  mobileContainer?.addEventListener('click', event => {
    const toggle = event.target.closest('.supplier-expand')
    if (!toggle) return
    const card = toggle.closest('.supplier-card')
    const details = card.querySelector('.supplier-card-details')
    const expanded = toggle.getAttribute('aria-expanded') === 'true'
    toggle.setAttribute('aria-expanded', String(!expanded))
    details.hidden = expanded
    card.classList.toggle('expanded', !expanded)
  })
  tableBody?.addEventListener('click', event => {
    const toggle = event.target.closest('.supplier-row-expand')
    if (!toggle) return
    const details = document.getElementById(toggle.getAttribute('aria-controls'))
    const expanded = toggle.getAttribute('aria-expanded') === 'true'
    toggle.setAttribute('aria-expanded', String(!expanded))
    if (details) details.hidden = expanded
  })
  scrollContainer?.addEventListener('scroll', () => {
    saveFilters(SCROLL_KEY, { y: scrollContainer.scrollTop })
  })

  document.addEventListener('DOMContentLoaded', loadSuppliers)

  window.goToSupplierUpdate = goToSupplierUpdate
  window.goToSupplierDelete = goToSupplierDelete
  window.applyStatusFilter = applyStatusFilter
})()
