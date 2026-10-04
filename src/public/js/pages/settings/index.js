(() => {
  const importButton = document.getElementById('import-user-preferences')
  const exportButton = document.getElementById('export-user-preferences')

  async function exportPreferences() {
    const startedAt = performance.now()
    window.log.debug('Inicio de exportación de preferencias de usuario')
    try {
      const saved = await window.saveDevicePreferences()
      if (!saved) throw new Error('El servidor no confirmó el guardado de preferencias')
      MessageBox.info('Se guardo las prefencias')
    } catch (error) {
      console.error('No se pudieron guardar las preferencias', error)
      MessageBox.error('No se pudieron guardar las preferencias')
    } finally {
      window.log.info('Tiempo de exportación de preferencias de usuario', {
        elapsed_ms: performance.now() - startedAt,
      })
      window.log.debug('Fin de exportación de preferencias de usuario')
    }
  }

  async function importPreferences() {
    const startedAt = performance.now()
    window.log.debug('Inicio de importación de preferencias de usuario')
    try {
      const restored = await window.restoreDevicePreferences()
      if (!restored) {
        MessageBox.warn('Nada que restaurar')
        return
      }
      await MessageBox.info('Restaurado con exito')
      window.location.reload()
    } catch (error) {
      console.error('No se pudieron restaurar las preferencias', error)
      MessageBox.error('Nada que restaurar')
    } finally {
      window.log.info('Tiempo de importación de preferencias de usuario', {
        elapsed_ms: performance.now() - startedAt,
      })
      window.log.debug('Fin de importación de preferencias de usuario')
    }
  }

  exportButton?.addEventListener('click', exportPreferences)
  importButton?.addEventListener('click', importPreferences)
})()
