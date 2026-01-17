function numberBox(value) {
  const number = Number(value || 0).toFixed(0)

  return `
    <div class="number-box">
      <span class="number-value">${number}</span>
    </div>
  `
}
