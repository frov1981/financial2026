(() => {
  const API_BASE = '/suppliers/list'
  const FILTERS_KEY = `ssrfinan:v1:user:${window.USER_ID}:suppliers:filters`
  const STATUS_KEY = `ssrfinan:v1:user:${window.USER_ID}:suppliers:status-filter`
  const SCROLL_KEY = `ssrfinan:v1:user:${window.USER_ID}:suppliers:scroll-position`
  const SELECTED_KEY = `ssrfinan:v1:user:${window.USER_ID}:suppliers:selected-row`
  const COLLAPSE_KEY = `ssrfinan:v1:user:${window.USER_ID}:suppliers:collapsed-groups`
  const STATUS_FILTERS = ['all', 'active', 'inactive']

  let allSuppliers = []
  let allGroups = []

  const searchInput = document.getElementById('search-input')
  const clearBtn = document.getElementById('clear-search-btn')
  const searchBtn = document.getElementById('search-btn')
  const tableBody = document.getElementById('suppliers-table')
  const mobileContainer = document.getElementById('suppliers-mobile')
  const scrollContainer = document.querySelector('.ui-scroll-area')
  const statusToggleBtn = document.querySelector('.js-status-filter-toggle')
  const newBtn = document.querySelector('[data-btn="new"]')
  const insertModal = document.getElementById('insert-supplier-modal')
  const insertModalContent = document.getElementById('insert-supplier-modal-content')
  const insertGroupBtn = document.getElementById('insert-supplier-group')
  const insertChildBtn = document.getElementById('insert-supplier-child')
  const closeInsertModalBtn = document.getElementById('close-supplier-modal')

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

  function isGroupCollapsed(groupId) {
    return Boolean(loadFilters(COLLAPSE_KEY)?.[groupId])
  }

  function toggleGroupCollapse(groupId) {
    const state = loadFilters(COLLAPSE_KEY) || {}
    state[groupId] = !state[groupId]
    saveFilters(COLLAPSE_KEY, state)
    render()
  }

  function getGroupBackgroundColor(index, total) {
    if (total <= 1) return 'hsl(var(--ui-group-hue), var(--ui-group-saturation), 96%)'
    const lightness = 96 - ((8 / (total - 1)) * index)
    return `hsl(var(--ui-group-hue), var(--ui-group-saturation), ${lightness}%)`
  }

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
    const selected = loadFilters(SELECTED_KEY)?.id === supplier.id
    return `
      <tr id="supplier-${supplier.id}" class="supplier-data-row ${supplier.is_active ? '' : 'bg-red-50'} ${selected ? 'tr-selected' : ''}">
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
    const email = primaryEmail(supplier)
    const whatsapp = primaryWhatsapp(supplier)
    const renderAdditionalContact = (label, value, primaryValue) =>
      value && value !== primaryValue
        ? `<div><dt>${label}</dt><dd>${displayValue(value)}</dd></div>`
        : ''

    return `
      <dl class="supplier-details-grid">
        <div><dt>RUC</dt><dd>${displayValue(supplier.tax_id)}</dd></div>
        <div><dt>Móvil 1</dt><dd>${displayValue(supplier.mobile_1)}</dd></div>
        <div><dt>Móvil 2</dt><dd>${displayValue(supplier.mobile_2)}</dd></div>
        ${renderAdditionalContact('WhatsApp 2', supplier.whatsapp_2, whatsapp)}
        ${renderAdditionalContact('Correo 2', supplier.email_2, email)}
        <div class="supplier-address"><dt>Dirección 1</dt><dd>${displayValue(supplier.address_1)}</dd></div>
        <div class="supplier-address"><dt>Dirección 2</dt><dd>${displayValue(supplier.address_2)}</dd></div>
        <div><dt>Estado</dt><dd>${statusTag(supplier.is_active)}</dd></div>
      </dl>
    `
  }

  function renderCard(supplier) {
    const selected = loadFilters(SELECTED_KEY)?.id === supplier.id
    return `
      <article class="supplier-card ${supplier.is_active ? '' : 'inactive'} ${selected ? 'card-selected' : ''}" data-id="${supplier.id}"
        onclick="selectSupplierCard(event, ${supplier.id})">
        <div class="supplier-card-main">
          <button type="button" class="supplier-expand" aria-expanded="false"
            aria-label="Mostrar más información de ${escapeHtml(supplier.business_name)}">
            <span class="supplier-chevron" aria-hidden="true"></span>
          </button>
          <div class="supplier-primary">
            <div class="supplier-card-heading">
              <h2 class="supplier-card-title">${displayValue(supplier.business_name)}</h2>
              <div class="supplier-card-actions">
                <button type="button" class="icon-btn edit" aria-label="Editar proveedor"
                  onclick="goToSupplierUpdate(${supplier.id})">${iconEdit()}</button>
                <button type="button" class="icon-btn delete" aria-label="Eliminar proveedor"
                  onclick="goToSupplierDelete(${supplier.id})">${iconDelete()}</button>
              </div>
            </div>
            <div class="supplier-primary-line"><span class="supplier-line-label">Correo</span>${displayValue(primaryEmail(supplier))}</div>
            <div class="supplier-primary-line"><span class="supplier-line-label">WhatsApp</span>${displayValue(primaryWhatsapp(supplier))}</div>
          </div>
        </div>
        <div class="supplier-card-details" hidden>
          ${renderSupplierDetails(supplier)}
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
    const suppliersByGroup = new Map(allGroups.map(group => [group.id, []]))
    suppliers.forEach(supplier => {
      const group_id = supplier.supplier_group?.id
      if (!suppliersByGroup.has(group_id)) suppliersByGroup.set(group_id, [])
      suppliersByGroup.get(group_id).push(supplier)
    })
    const term = loadFilters(FILTERS_KEY)?.term || ''
    const groups = allGroups.filter(group => {
      const hasVisibleSuppliers = (suppliersByGroup.get(group.id) || []).length > 0
      const hasSuppliers = allSuppliers.some(supplier => supplier.supplier_group?.id === group.id)
      return hasVisibleSuppliers || (!term && !hasSuppliers)
    })
    const emptyMessage = allSuppliers.length
      ? 'No se encontraron proveedores con esos filtros'
      : 'Aún no tienes proveedores registrados'
    const tableRows = groups.map(group => {
      const collapsed = isGroupCollapsed(group.id)
      const children = suppliersByGroup.get(group.id) || []
      return `
        <tr class="supplier-parent-row">
          <td class="ui-td col-left">
            <div class="supplier-group-cell">
              <button type="button" class="group-toggle" aria-expanded="${!collapsed}"
                aria-label="${collapsed ? 'Expandir' : 'Contraer'} grupo ${escapeHtml(group.name)}"
                onclick="toggleSupplierGroup(${group.id})">
                ${collapsed ? iconChevronOpen() : iconChevronClose()}
              </button>
              <span class="group-name">${escapeHtml(group.name)}</span>
            </div>
          </td>
          <td class="ui-td col-right" colspan="5">
            <div class="icon-actions">
              <button type="button" class="icon-btn edit" aria-label="Editar grupo"
                onclick="goToSupplierGroupUpdate(${group.id})">${iconEdit()}</button>
              <button type="button" class="icon-btn delete" aria-label="Eliminar grupo"
                onclick="goToSupplierGroupDelete(${group.id})">${iconDelete()}</button>
            </div>
          </td>
        </tr>
        ${collapsed ? '' : children.length ? children.map(renderRow).join('') : `
          <tr><td class="ui-td supplier-group-empty" colspan="6">${allSuppliers.length ? 'No hay proveedores en este grupo.' : 'Aún no tienes proveedores registrados.'}</td></tr>
        `}
      `
    }).join('')
    tableBody.innerHTML = tableRows || `<tr><td colspan="6" class="ui-td col-center text-gray-500">${emptyMessage}</td></tr>`

    const mobileGroups = groups.map((group, index) => {
      const collapsed = isGroupCollapsed(group.id)
      const children = suppliersByGroup.get(group.id) || []
      const background = getGroupBackgroundColor(index, groups.length)
      return `
        <section class="supplier-group ${collapsed ? 'collapsed' : ''}" style="background: ${background};">
          <header class="supplier-group-header">
            <div class="supplier-group-heading">
              <button type="button" class="supplier-expand supplier-group-toggle" aria-expanded="${!collapsed}"
                aria-label="${collapsed ? 'Expandir' : 'Contraer'} grupo ${escapeHtml(group.name)}"
                onclick="toggleSupplierGroup(${group.id})">
                <span class="supplier-chevron"></span>
              </button>
              <span>${escapeHtml(group.name)}</span>
            </div>
            <div class="supplier-group-actions">
              <button type="button" class="icon-btn edit" aria-label="Editar grupo"
                onclick="goToSupplierGroupUpdate(${group.id})">${iconEdit()}</button>
              <button type="button" class="icon-btn delete" aria-label="Eliminar grupo"
                onclick="goToSupplierGroupDelete(${group.id})">${iconDelete()}</button>
            </div>
          </header>
          <div class="supplier-group-body">
            ${children.length ? children.map(renderCard).join('') : `<div class="supplier-group-empty">${allSuppliers.length ? 'No hay proveedores en este grupo.' : 'Aún no tienes proveedores registrados.'}</div>`}
          </div>
        </section>
      `
    }).join('')
    mobileContainer.innerHTML = mobileGroups || `<div class="ui-empty">${emptyMessage}</div>`
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
      const groupsResponse = await fetch('/supplier-groups/list', { headers: { Accept: 'application/json' } })
      if (!groupsResponse.ok) throw new Error(`Error HTTP ${groupsResponse.status} al listar grupos`)
      allGroups = await groupsResponse.json()
      if (!Array.isArray(allGroups)) throw new Error('La respuesta de grupos no tiene el formato esperado')

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

  function goToSupplierGroupInsert() {
    location.href = '/supplier-groups/insert'
  }

  function goToSupplierGroupUpdate(id) {
    location.href = `/supplier-groups/update/${id}`
  }

  function goToSupplierGroupDelete(id) {
    location.href = `/supplier-groups/delete/${id}`
  }

  function selectSupplierCard(event, id) {
    if (event.target.closest('button')) return
    saveFilters(SELECTED_KEY, { id })
    document.querySelectorAll('.supplier-card').forEach(card => card.classList.remove('card-selected'))
    tableBody.querySelectorAll('.supplier-data-row').forEach(row => row.classList.remove('tr-selected'))
    event.currentTarget.classList.add('card-selected')
    document.getElementById(`supplier-${id}`)?.classList.add('tr-selected')
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
    if (!card) return
    const details = card.querySelector('.supplier-card-details')
    const expanded = toggle.getAttribute('aria-expanded') === 'true'
    toggle.setAttribute('aria-expanded', String(!expanded))
    details.hidden = expanded
    card.classList.toggle('expanded', !expanded)
  })
  tableBody?.addEventListener('click', event => {
    const toggle = event.target.closest('.supplier-row-expand')
    if (toggle) {
      const details = document.getElementById(toggle.getAttribute('aria-controls'))
      const expanded = toggle.getAttribute('aria-expanded') === 'true'
      toggle.setAttribute('aria-expanded', String(!expanded))
      if (details) details.hidden = expanded
      return
    }
    const row = event.target.closest('.supplier-data-row')
    if (!row || event.target.closest('button')) return
    const supplier_id = Number(row.id.replace('supplier-', ''))
    saveFilters(SELECTED_KEY, { id: supplier_id })
    tableBody.querySelectorAll('.supplier-data-row').forEach(supplier_row => supplier_row.classList.remove('tr-selected'))
    mobileContainer.querySelectorAll('.supplier-card').forEach(card => card.classList.remove('card-selected'))
    row.classList.add('tr-selected')
    mobileContainer.querySelector(`[data-id="${supplier_id}"]`)?.classList.add('card-selected')
  })
  scrollContainer?.addEventListener('scroll', () => {
    saveFilters(SCROLL_KEY, { y: scrollContainer.scrollTop })
  })

  newBtn?.addEventListener('click', event => {
    event.preventDefault()
    insertModal?.classList.remove('hidden')
  })
  closeInsertModalBtn?.addEventListener('click', () => insertModal?.classList.add('hidden'))
  insertGroupBtn?.addEventListener('click', goToSupplierGroupInsert)
  insertChildBtn?.addEventListener('click', () => { location.href = '/suppliers/insert' })
  insertModal?.addEventListener('click', event => {
    if (!insertModalContent?.contains(event.target)) insertModal.classList.add('hidden')
  })
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') insertModal?.classList.add('hidden')
  })

  document.addEventListener('DOMContentLoaded', loadSuppliers)

  window.goToSupplierUpdate = goToSupplierUpdate
  window.goToSupplierDelete = goToSupplierDelete
  window.goToSupplierGroupUpdate = goToSupplierGroupUpdate
  window.goToSupplierGroupDelete = goToSupplierGroupDelete
  window.toggleSupplierGroup = toggleGroupCollapse
  window.selectSupplierCard = selectSupplierCard
  window.applyStatusFilter = applyStatusFilter
})()
