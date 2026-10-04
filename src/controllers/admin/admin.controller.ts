import { LOGGER_EVENTS, LoggerEventName } from '../../utils/logger-events'
import { RequestHandler } from 'express'
import { readdir, readFile, stat } from 'fs/promises'
import path from 'path'
import { AuthRequest } from '../../types/auth-request'
import { parseError } from '../../utils/error.util'
import { ConfigurableLogLevel, logger } from '../../utils/logger.util'
import { AppDataSource } from '../../config/typeorm.datasource'
import { User } from '../../entities/User.entity'

const configurableLevels: ConfigurableLogLevel[] = ['TRACE', 'DEBUG', 'INFO']
const logPageSize = 100
const logTypes = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as const
type LogType = typeof logTypes[number]

interface LogRecord {
  level: LogType | null
  time: string | null
  levelName: string | null
  eventName: string | null
  method: string | null
  properties: Array<{ name: string; value: string }>
}

interface LogFile {
  name: string
  modifiedAt: Date
}

interface LogUserOption {
  id: string
  name: string
}

interface LogEventOption {
  id: string
  name: string
}

function logDirectory(): string {
  const storagePath = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage')
  return path.resolve(storagePath, 'logs')
}

async function getRecentLogFiles(): Promise<LogFile[]> {
  const directory = logDirectory()
  const entries = await readdir(directory, { withFileTypes: true })
  const logFiles = await Promise.all(entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.log'))
    .map(async entry => {
      const filePath = path.join(directory, entry.name)
      const fileStats = await stat(filePath)
      return { name: entry.name, modifiedAt: fileStats.mtime }
    }))

  return logFiles
    .sort((first, second) => second.modifiedAt.getTime() - first.modifiedAt.getTime())
    .slice(0, 7)
}

function requestedString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function requestedLogTypes(value: unknown): LogType[] | null {
  if (value === undefined) return []
  const values = Array.isArray(value) ? value : [value]
  if (values.some(item => typeof item !== 'string' || !logTypes.includes(item as LogType))) {
    return null
  }
  return [...new Set(values as LogType[])]
}

function requestedLogUser(value: unknown): string | null {
  if (value === undefined || value === '') return 'all'
  if (typeof value !== 'string') return null
  if (value === 'all' || value === 'null') return value
  if (!/^(0|[1-9]\d*)$/.test(value) || !Number.isSafeInteger(Number(value))) return null
  return value
}

function requestedLogEvent(value: unknown): string | null {
  if (value === undefined || value === '' || value === 'all') return ''
  if (typeof value !== 'string' || !Object.values(LOGGER_EVENTS).includes(value as LoggerEventName)) return null
  return value
}

function getLogUserId(line: string): string | null {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>
    const userId = parsed.user_id
    if (typeof userId === 'number' && Number.isSafeInteger(userId) && userId >= 0) {
      return String(userId)
    }
    if (typeof userId === 'string' && /^(0|[1-9]\d*)$/.test(userId)) {
      return userId
    }
    return null
  } catch {
    return null
  }
}

function getLogType(line: string): LogType | null {
  try {
    const log = JSON.parse(line) as { level_name?: unknown; level?: unknown }
    if (typeof log.level_name === 'string' && logTypes.includes(log.level_name.toUpperCase() as LogType)) {
      return log.level_name.toUpperCase() as LogType
    }

    const numericLevels: Record<number, LogType> = {
      10: 'TRACE',
      20: 'DEBUG',
      30: 'INFO',
      40: 'WARN',
      50: 'ERROR',
      60: 'FATAL',
    }
    return typeof log.level === 'number' ? numericLevels[log.level] ?? null : null
  } catch {
    return null
  }
}

function parseLogRecord(line: string): LogRecord {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>
    const time = typeof parsed.time === 'string' || typeof parsed.time === 'number'
      ? String(parsed.time)
      : null
    const levelName = typeof parsed.level_name === 'string' ? parsed.level_name : null
    const eventName = typeof parsed.event_name === 'string' ? parsed.event_name : null
    const method = typeof parsed.method_name === 'string' ? parsed.method_name : null
    const hiddenProperties = new Set([
      'level',
      'level_name',
      'method_name',
      'service',
      'time',
    ])
    const propertyLabels: Record<string, string> = {
      user_id: 'Usuario',
      context: 'Contexto',
      msg: 'Mensaje',
      ex_event_type: 'Tipo de evento',
    }
    const properties = Object.entries(parsed)
      .filter(([name]) => !hiddenProperties.has(name))
      .map(([name, value]) => ({
        name: propertyLabels[name] ?? name,
        value: typeof value === 'string' ? value : JSON.stringify(value) ?? String(value),
      }))
    if (levelName) {
      properties.unshift({ name: 'Nivel', value: levelName })
    }
    properties.unshift({ name: 'Evento', value: eventName || '—' })

    return { level: getLogType(line), time, levelName, eventName, method, properties }
  } catch {
    return {
      level: null,
      time: null,
      levelName: null,
      eventName: null,
      method: null,
      properties: [{ name: 'raw', value: line }],
    }
  }
}

function renderReader(
  res: Parameters<RequestHandler>[1],
  userId: number,
  selectedFileNumber: number,
  selectedFile: string,
  filter: string,
  eventFilter: string,
  selectedLogTypes: LogType[],
  selectedLogUser: string,
  logUserOptions: LogUserOption[],
  logEventOptions: LogEventOption[],
  records: LogRecord[],
  totalLines: number,
  displayedLines: number
) {
  res.render('layouts/main', {
    title: `Registro: ${selectedFile}`,
    view: 'pages/admin/log-reader',
    USER_ID: userId,
    selectedFileNumber,
    selectedFile,
    filter,
    eventFilter,
    selectedLogTypes,
    selectedLogUser,
    logUserOptions,
    logEventOptions,
    records,
    totalLines,
    displayedLines,
  })
}

export const routeToAdminPage: RequestHandler = async (req, res, next) => {
  const auth_req = req as AuthRequest
  const admin_logger = logger.forMethod(routeToAdminPage.name, LOGGER_EVENTS.ADMIN, auth_req.user.id)

  try {
    const logFiles = await getRecentLogFiles()
    res.render('layouts/main', {
      title: 'Administración del servidor',
      view: 'pages/admin/index',
      USER_ID: auth_req.user.id,
      logLevel: logger.getLevel(),
      logFiles,
      levelUpdated: req.query.levelUpdated === '1',
    })
  } catch (error) {
    admin_logger.error('Error cargando la administración del servidor', parseError(error))
    next(error)
  }
}

export const apiForChangingLogLevel: RequestHandler = (req, res) => {
  const requestedLevel = requestedString(req.body?.level).toUpperCase()
  if (!configurableLevels.includes(requestedLevel as ConfigurableLogLevel)) {
    return res.status(400).send('Nivel de registro no válido.')
  }

  logger.setLevel(requestedLevel as ConfigurableLogLevel)
  return res.redirect('/admin?levelUpdated=1')
}

export const apiForOpeningLogFile: RequestHandler = async (req, res, next) => {
  const auth_req = req as AuthRequest
  const admin_logger = logger.forMethod(apiForOpeningLogFile.name, LOGGER_EVENTS.ADMIN, auth_req.user.id)
  const rawFileNumber = requestedString(req.body?.fileNumber)
  const fileNumber = Number(rawFileNumber)

  try {
    const logFiles = await getRecentLogFiles()
    if (!Number.isInteger(fileNumber) || fileNumber < 1 || fileNumber > logFiles.length) {
      return res.status(404).send('El archivo de registro ya no está disponible.')
    }
    return res.redirect(`/admin/logs?fileNumber=${fileNumber}`)
  } catch (error) {
    admin_logger.error('Error abriendo archivo de registro', parseError(error))
    next(error)
  }
}

export const routeToLogReader: RequestHandler = async (req, res, next) => {
  const auth_req = req as AuthRequest
  const admin_logger = logger.forMethod(routeToLogReader.name, LOGGER_EVENTS.ADMIN, auth_req.user.id)
  const rawFileNumber = requestedString(req.query.fileNumber)
  const selectedFileNumber = Number(rawFileNumber)
  const filter = requestedString(req.query.filter)
  const eventFilter = requestedLogEvent(req.query.eventFilter)
  const selectedLogTypes = requestedLogTypes(req.query.level)
  const selectedLogUser = requestedLogUser(req.query.userId)
  const rawOffset = requestedString(req.query.offset)
  const offset = rawOffset === '' ? 0 : Number(rawOffset)
  if (!selectedLogTypes) {
    return res.status(400).send('El tipo de registro seleccionado no es válido.')
  }
  if (!selectedLogUser) {
    return res.status(400).send('El usuario seleccionado no es válido.')
  }
  if (eventFilter === null) {
    return res.status(400).send('El evento seleccionado no es válido.')
  }
  if (!Number.isSafeInteger(offset) || offset < 0) {
    return res.status(400).send('El desplazamiento del registro no es válido.')
  }
  if (filter.length > 200) {
    return res.status(400).send('El filtro no puede superar los 200 caracteres.')
  }

  try {
    const logFiles = await getRecentLogFiles()
    if (!Number.isInteger(selectedFileNumber) || selectedFileNumber < 1 || selectedFileNumber > logFiles.length) {
      return res.status(404).send('El archivo de registro ya no está disponible.')
    }
    const selectedFile = logFiles[selectedFileNumber - 1].name

    const logPath = path.join(logDirectory(), selectedFile)
    const rawContent = await readFile(logPath, 'utf8')
    const allLines = rawContent.split(/\r?\n/)
    if (allLines[allLines.length - 1] === '') allLines.pop()

    const matchingLines = allLines
      .reverse()
      .filter(line => {
        if (filter && !line.toLocaleLowerCase().includes(filter.toLocaleLowerCase())) return false
        if (eventFilter) {
          try {
            const eventName = (JSON.parse(line) as Record<string, unknown>).event_name
            if (eventName !== eventFilter) return false
          } catch {
            return false
          }
        }
        if (selectedLogUser === 'null' && getLogUserId(line) !== null) return false
        if (selectedLogUser !== 'all' && selectedLogUser !== 'null' && getLogUserId(line) !== selectedLogUser) return false
        if (selectedLogTypes.length === 0) return true
        const lineType = getLogType(line)
        return lineType !== null && selectedLogTypes.includes(lineType)
      })

    const pageLines = matchingLines.slice(offset, offset + logPageSize)
    const records = pageLines.map(parseLogRecord)
    const displayedLines = Math.min(offset + records.length, matchingLines.length)
    if (req.get('X-Requested-With') === 'XMLHttpRequest') {
      return res.json({
        records,
        offset,
        displayedLines,
        totalLines: matchingLines.length,
        hasMore: displayedLines < matchingLines.length,
      })
    }
    const users = await AppDataSource.getRepository(User)
      .createQueryBuilder('user')
      .select(['user.id', 'user.name'])
      .orderBy('user.name', 'ASC')
      .getMany()
    const logUserOptions: LogUserOption[] = [
      { id: 'all', name: 'Todos' },
      { id: 'null', name: 'Nulos' },
      ...users.map(user => ({ id: String(user.id), name: user.name })),
    ]
    const logEventOptions: LogEventOption[] = [
      { id: 'all', name: 'Todos' },
      ...Object.values(LOGGER_EVENTS)
        .sort((first, second) => first.localeCompare(second))
        .map(eventName => ({ id: eventName, name: eventName })),
    ]
    if (
      selectedLogUser !== 'all'
      && selectedLogUser !== 'null'
      && !logUserOptions.some(option => option.id === selectedLogUser)
    ) {
      logUserOptions.push({ id: selectedLogUser, name: `Usuario ${selectedLogUser}` })
    }
    return renderReader(
      res,
      auth_req.user.id,
      selectedFileNumber,
      selectedFile,
      filter,
      eventFilter,
      selectedLogTypes,
      selectedLogUser,
      logUserOptions,
      logEventOptions,
      records,
      matchingLines.length,
      displayedLines
    )
  } catch (error) {
    admin_logger.error('Error leyendo archivo de registro', parseError(error))
    next(error)
  }
}
