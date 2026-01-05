document.addEventListener('DOMContentLoaded', () => {

    // Estado en memoria
    let allLoans = []
    let filteredLoans = []

    const tableBody = document.getElementById('loans-table')
    const searchInput = document.getElementById('search-input')
    const searchBtn = document.getElementById('search-btn')
    const clearSearchBtn = document.getElementById('clear-search-btn')

    // Cargar préstamos desde API
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

    // Renderizar tabla
    const renderTable = () => {
        tableBody.innerHTML = ''

        if (filteredLoans.length === 0) {
            tableBody.innerHTML = `
        <tr>
          <td colspan="7" class="px-4 py-4 text-center text-gray-500">
            No se encontraron préstamos
          </td>
        </tr>
      `
            return
        }

        filteredLoans.forEach(loan => {
            const tr = document.createElement('tr')

            tr.innerHTML = `
        <td class="px-4 py-2 text-sm text-gray-700">
          ${loan.name}
        </td>

        <td class="px-4 py-2 text-sm text-right text-gray-700 whitespace-nowrap">
          ${formatAmount(loan.total_amount)}
        </td>

        <td class="px-4 py-2 text-sm text-right text-gray-700 whitespace-nowrap">
          ${formatAmount(loan.balance)}
        </td>

        <td class="px-4 py-2 text-sm text-right text-gray-700 hidden sm:table-cell">
          ${loan.interest_rate ? loan.interest_rate + '%' : '-'}
        </td>

        <td class="px-4 py-2 text-sm text-gray-700 hidden md:table-cell">
          ${formatDate(loan.start_date)}
        </td>

        <td class="px-4 py-2 text-sm">
          ${renderStatus(loan.status)}
        </td>

        <td class="px-4 py-2 text-sm text-gray-700 whitespace-nowrap">
          <button
            class="icon-btn bg-gray-200 hover:bg-gray-300"
            title="Editar"
            onclick="location.href='/loans/update/${loan.id}'">
            ✏️
          </button>

          <button
            class="icon-btn bg-gray-200 hover:bg-gray-300"
            title="Ver pagos"
            onclick="location.href='/loans/${loan.id}'">
            📄
          </button>
        </td>
      `

            tableBody.appendChild(tr)
        })
    }

    // Aplicar filtro en memoria
    const applyFilter = () => {
        const term = searchInput.value.trim().toLowerCase()

        if (!term) {
            filteredLoans = [...allLoans]
            clearSearchBtn.classList.add('hidden')
            renderTable()
            return
        }

        clearSearchBtn.classList.remove('hidden')

        filteredLoans = allLoans.filter(loan => {
            return (
                loan.name.toLowerCase().includes(term) ||
                (loan.loan_number && loan.loan_number.toLowerCase().includes(term)) ||
                loan.status.toLowerCase().includes(term)
            )
        })

        renderTable()
    }

    // Utilidades de formato
    const formatAmount = value => {
        return Number(value).toLocaleString('es-EC', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })
    }

    const formatDate = value => {
        if (!value) return '-'
        const d = new Date(value)
        return d.toLocaleDateString('es-EC')
    }

    const renderStatus = status => {
        if (status === 'closed') {
            return '<span class="text-green-600 font-semibold">Cerrado</span>'
        }
        return '<span class="text-blue-600 font-semibold">Activo</span>'
    }

    // Eventos
    searchBtn.addEventListener('click', applyFilter)

    searchInput.addEventListener('input', applyFilter)

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = ''
        applyFilter()
    })

    // Inicialización
    loadLoans()
})
