const ADMIN_LOG_NUMBER_STORAGE_KEY = `ssrfinan:v1:user:${window.USER_ID}:admin:selected-log-number`
const LEGACY_ADMIN_LOG_FILE_STORAGE_KEY = `ssrfinan:v1:user:${window.USER_ID}:admin:selected-log-file`
const adminLogForm = document.querySelector('.admin-log-files')?.closest('form')
const logFileRadios = document.querySelectorAll('input[name="fileNumber"]')

if (adminLogForm && logFileRadios.length > 0) {
  window.clearFilters(LEGACY_ADMIN_LOG_FILE_STORAGE_KEY)
  const savedFileNumber = window.loadFilters(ADMIN_LOG_NUMBER_STORAGE_KEY)
  const savedRadio = Array.from(logFileRadios).find(radio => Number(radio.value) === savedFileNumber)

  if (savedRadio) {
    savedRadio.checked = true
  }

  const saveSelectedLogFile = () => {
    const selectedRadio = adminLogForm.querySelector('input[name="fileNumber"]:checked')
    if (selectedRadio) {
      window.saveFilters(ADMIN_LOG_NUMBER_STORAGE_KEY, Number(selectedRadio.value))
    }
  }

  logFileRadios.forEach(radio => radio.addEventListener('change', saveSelectedLogFile))
  adminLogForm.addEventListener('submit', saveSelectedLogFile)
  if (!savedRadio) {
    const firstRadio = logFileRadios[0]
    if (firstRadio) firstRadio.checked = true
  }
  saveSelectedLogFile()
}
