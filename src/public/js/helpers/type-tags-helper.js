function transactionTypeTag(type) {
  switch (type) {
    case 'income':
      return `
        <div class="tx-tag tx-income">
          Ingresos
        </div>
      `
    case 'expense':
      return `
        <div class="tx-tag tx-expense">
          Egresos
        </div>
      `
    case 'transfer':
      return `
        <div class="tx-tag tx-transfer">
          Transferencias
        </div>
      `
    default:
      return `<div class="tx-tag">-</div>`
  }
}

function statusTag(isActive) {
  if (isActive) {
    return `<div class="tag tag-active">Activo</div>`
  }

  return `<div class="tag tag-inactive">Inactivo</div>`
}

// type!: 'cash' | 'bank' | 'card' | 'saving'
function accountTypeTag(type) {
  switch (type) {
    case 'cash':
      return `<div class="acc-tag tag-cash">Efectivo</div>`
    case 'bank':
      return `<div class="acc-tag tag-bank">Banco</div>`
    case 'card':
      return `<div class="acc-tag tag-card">Tarjeta</div>`
    case 'saving':
      return `<div class="acc-tag tag-saving">Ahorros</div>`
    default:
      return `<div class="acc-tag">-</div>`
  }
}

function categoryTypeTag(type) {
  switch (type) {
    case 'income':
      return `
        <div class="tx-tag tx-income">
          Ingresos
        </div>
      `
    case 'expense':
      return `
        <div class="tx-tag tx-expense">
          Egresos
        </div>
      `
    default:
      return `<div class="tx-tag">-</div>`
  }
}

function categoryTypeForPayableTag(type) {
  switch (type) {
    case 'payable':
      return `
        <div class="tx-tag">
          Cuentas por Pagar
        </div>
      `
    case 'payment':
      return `
        <div class="tx-tag ">
          Pagos por Cuentas por Pagar
        </div>
      `
    default:
      return ``
  }
}

