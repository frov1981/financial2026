class MessageBox {
  static modalQueue = []
  static activeModal = null

  static info(message) {
    return this.showModal(message, 'info')
  }

  static warn(message) {
    return this.showModal(message, 'warn')
  }

  static error(message) {
    return this.showModal(message, 'error')
  }

  static success(message, options) {
    this.show(message, 'bg-green-600', options)
  }

  static showModal(message, type) {
    if (!['info', 'warn', 'error'].includes(type)) {
      throw new TypeError(`Tipo de mensaje no válido: ${type}`)
    }

    return new Promise(resolve => {
      this.modalQueue.push({ kind: 'message', message: String(message), type, resolve })
      this.showNextModal()
    })
  }

  static showQuestion(message) {
    return new Promise(resolve => {
      this.modalQueue.push({ kind: 'question', message: String(message), resolve })
      this.showNextModal()
    })
  }

  static showNextModal() {
    if (this.activeModal || !this.modalQueue.length) return

    this.activeModal = this.modalQueue.shift()
    const currentModal = this.activeModal
    const isQuestion = currentModal.kind === 'question'
    const modal = document.getElementById(isQuestion ? 'question-box-modal' : 'message-box-modal')
    const messageElement = document.getElementById(isQuestion ? 'question-box-message' : 'message-box-message')

    if (!modal || !messageElement) {
      this.activeModal = null
      throw new Error(`No se encontró el modal global de ${isQuestion ? 'preguntas' : 'mensajes'}`)
    }

    messageElement.textContent = currentModal.message

    if (isQuestion) {
      const yesButton = document.getElementById('question-box-yes')
      const noButton = document.getElementById('question-box-no')
      if (!yesButton || !noButton) {
        this.activeModal = null
        throw new Error('No se encontraron los botones del modal de preguntas')
      }

      modal.classList.remove('hidden')
      noButton.focus()
      yesButton.onclick = () => this.closeActiveModal(true)
      noButton.onclick = () => this.closeActiveModal(false)
      return
    }

    const acceptButton = document.getElementById('message-box-accept')
    const icons = modal.querySelectorAll('[data-message-box-icon]')
    if (!acceptButton || !icons.length) {
      this.activeModal = null
      throw new Error('No se encontraron los controles del modal de mensajes')
    }

    icons.forEach(icon => {
      icon.classList.toggle('hidden', icon.dataset.messageBoxIcon !== currentModal.type)
    })
    modal.classList.remove('hidden')
    acceptButton.focus()
    acceptButton.onclick = () => this.closeActiveModal()
  }

  static closeActiveModal(result) {
    const currentModal = this.activeModal
    if (!currentModal) return

    const modalId = currentModal.kind === 'question' ? 'question-box-modal' : 'message-box-modal'
    document.getElementById(modalId).classList.add('hidden')
    this.activeModal = null
    currentModal.resolve(result)
    this.showNextModal()
  }

  static show(message, bgClass, { duration = 10000, showCountdown = true, compact = false } = {}) {
    const container = document.getElementById('message-container')

    const box = document.createElement('div')
    box.className = `${bgClass} text-white rounded shadow mb-2 ${compact ? 'px-2 py-1 text-xs' : 'px-4 py-3'}`
    if (!compact) box.style.minWidth = '260px'

    let seconds = Math.ceil(duration / 1000)

    const text = document.createElement('div')
    text.textContent = showCountdown ? `${message} (${seconds}s)` : message
    box.appendChild(text)

    container.appendChild(box)

    if (!showCountdown) {
      setTimeout(() => box.remove(), duration)
      return
    }

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

class QuestionBox {
  static ask(message) {
    return MessageBox.showQuestion(message)
  }
}

window.MessageBox = MessageBox
window.QuestionBox = QuestionBox
