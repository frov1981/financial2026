document.addEventListener('DOMContentLoaded', () => {

  // Estado en memoria
  let allLoans = []
  let filteredLoans = []

  const tableBody = document.getElementById('loans-table')
  const searchInput = document.getElementById('search-input')
  const clearBtn = document.getElementById('clear-search-btn')

  // ===============================
  // Carga de préstamos
  // ===============================
  const loadLoans = async () => {
    try {
      const res = await fetch('/api/loans')
      const data = await res.json()

      allLoans = Array.isArray(data) ? data : []
      filteredLoans = [...allLoans]

      renderTable()
    } catch (error) {
      console.error('Error al cargar préstamos', error)
    }
  }

  // ===============================
  // Render de tabla
  // ===============================
  const renderTable = () => {
    tableBody.innerHTML = ''

    if (filteredLoans.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="px-4 py-4 text-center text-gray-500 text-sm">
            No se encontraron préstamos
          </td>
        </tr>
      `
      return
    }

    filteredLoans.forEach(loan => {
      const tr = document.createElement('tr')

      tr.innerHTML = `
        <td class="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
          ${loan.name}
        </td>

        <td class="px-4 py-2 text-sm text-right whitespace-nowrap">
          ${formatAmount(loan.total_amount)}
        </td>

        <td class="px-4 py-2 text-sm text-right whitespace-nowrap font-semibold">
          ${formatAmount(loan.balance)}
        </td>

        <td class="px-4 py-2 text-sm text-right whitespace-nowrap ui-col-sm">
          ${loan.interest_rate ? loan.interest_rate + '%' : '-'}
        </td>

        <td class="px-4 py-2 text-sm hidden md:table-cell whitespace-nowrap">
          ${formatDate(loan.start_date)}
        </td>

        <td class="px-4 py-2 text-sm whitespace-nowrap">
          ${renderStatus(loan.status)}
        </td>

        <td class="px-4 py-2 whitespace-nowrap">
          <div class="icon-actions">
            <button
              class="icon-btn edit"
              title="Editar"
              onclick="location.href='/loans/update/${loan.id}'">
              ${iconEdit()}
              <span class="ui-btn-text">Editar</span>
            </button>

            <button
              class="icon-btn"
              title="Ver pagos"
              onclick="location.href='/loans/${loan.id}'">
              ${iconList()}
              <span class="ui-btn-text">Pagos</span>
            </button>
          </div>
        </td>
      `

      tableBody.appendChild(tr)
    })
  }

  // ===============================
  // Filtro en memoria
  // ===============================
  const applyFilter = () => {
    const term = searchInput.value.trim().toLowerCase()

    clearBtn.classList.toggle('hidden', !term)

    if (!term) {
      filteredLoans = [...allLoans]
      renderTable()
      return
    }

    filteredLoans = allLoans.filter(loan =>
      loan.name.toLowerCase().includes(term) ||
      (loan.loan_number && loan.loan_number.toLowerCase().includes(term)) ||
      loan.status.toLowerCase().includes(term)
    )

    renderTable()
  }

  // ===============================
  // Utilidades
  // ===============================
  const formatAmount = value =>
    Number(value).toLocaleString('es-EC', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })

  const formatDate = value => {
    if (!value) return '-'
    return new Date(value).toLocaleDateString('es-EC')
  }

  const renderStatus = status => {
    if (status === 'closed') {
      return '<span class="text-green-600 font-semibold">Cerrado</span>'
    }
    return '<span class="text-blue-600 font-semibold">Activo</span>'
  }

  // ===============================
  // Íconos SVG (consistentes)
  // ===============================
  const iconEdit = () => `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"
      viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4Z"/>
    </svg>
  `

  const iconList = () => `
    <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"
      viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
    </svg>
  `

  // ===============================
  // Eventos
  // ===============================
  searchInput.addEventListener('input', applyFilter)

  clearBtn.addEventListener('click', () => {
    searchInput.value = ''
    applyFilter()
  })

  // Init
  loadLoans()
})
