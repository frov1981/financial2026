class MessageBox {

  static success(message) {
    this.show(message, 'bg-green-600')
  }

  static error(message) {
    this.show(message, 'bg-red-600')
  }

  static show(message, bgClass) {
    const container = document.getElementById('message-container')

    const box = document.createElement('div')
    box.className = `${bgClass} text-white px-4 py-3 rounded shadow mb-2`
    box.style.minWidth = '260px'

    let seconds = 10

    const text = document.createElement('div')
    text.textContent = `${message} (${seconds}s)`
    box.appendChild(text)

    container.appendChild(box)

    const interval = setInterval(() => {
      seconds--
      text.textContent = `${message} (${seconds}s)`

      if (seconds <= 0) {
        clearInterval(interval)
        box.remove()
      }
    }, 1000)
  }
}

window.MessageBox = MessageBox
