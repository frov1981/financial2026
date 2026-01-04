function amountBox(value) {
  const amount = Number(value || 0).toFixed(2)

  return `
    <div class="amount-box">
      <span class="amount-value">${amount}</span>
      <span class="amount-currency">$</span>
    </div>
  `
}
