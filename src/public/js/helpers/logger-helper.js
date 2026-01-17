// Logger para navegador
// Uso: log.info('mensaje'), log.error('mensaje', data)

(function (window) {

  const DEBUG = true

  function format(level, message, data) {
    const time = new Date().toISOString()
    return { time, level, message, data }
  }

  const log = {

    info(message, data = null) {
      if (!DEBUG) return
      console.log(format('INFO', message, data))
    },

    warn(message, data = null) {
      console.warn(format('WARN', message, data))
    },

    error(message, data = null) {
      console.error(format('ERROR', message, data))
    },

    debug(message, data = null) {
      if (!DEBUG) return
      console.debug(format('DEBUG', message, data))
    }

  }

  window.log = log

})(window)
