/* ============================
   Status Filter Toggle Button
============================ */

/* Ciclo de estados */
const STATUS_FILTER_CYCLE = ['all', 'active', 'inactive']

/* Configuración por estado */
const STATUS_FILTER_CONFIG = {
  all: {
    label: 'Todos',
    icon: iconList
  },
  active: {
    label: 'Activos',
    icon: iconView
  },
  inactive: {
    label: 'Inactivos',
    icon: iconViewOff
  }
}

/* Render del botón */
function renderStatusFilterToggle(button, status) {

  const config = STATUS_FILTER_CONFIG[status]
  if (!config) return

  button.dataset.status = status

  const iconContainer = button.querySelector('.ui-btn-icon')
  const textContainer = button.querySelector('.ui-btn-text')

  if (iconContainer) {
    iconContainer.innerHTML = config.icon()
  }

  if (textContainer) {
    textContainer.textContent = config.label
  }
}

/* Inicialización */
document.addEventListener('DOMContentLoaded', () => {

  document.querySelectorAll('.js-status-filter-toggle').forEach(button => {

    renderStatusFilterToggle(button, button.dataset.status)

    button.addEventListener('click', () => {

      const current = button.dataset.status
      const index = STATUS_FILTER_CYCLE.indexOf(current)
      const next = STATUS_FILTER_CYCLE[(index + 1) % STATUS_FILTER_CYCLE.length]

      renderStatusFilterToggle(button, next)

      saveFilters(STATUS_FILTER_KEY, { status: next })

      if (typeof applyStatusFilter === 'function') {
        applyStatusFilter(next)
      }
    })
  })
})

document.addEventListener('status-filter-change', (event) => {

  const { status } = event.detail

  document.querySelectorAll('.js-status-filter-toggle')
    .forEach(button => {
      renderStatusFilterToggle(button, status)
    })
})
