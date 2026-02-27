function amountBox(value) {
  const amount = Number(value || 0).toFixed(2)

  return `
    <div class="amount-box">
      <span class="amount-value">${amount}</span>
    </div>
  `
}

function numberBox(value) {
  const number = Number(value || 0).toFixed(0)

  return `
    <div class="number-box">
      <span class="number-value">${number}</span>
    </div>
  `
}
