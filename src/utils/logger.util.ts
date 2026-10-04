import 'dotenv/config'
import pino from 'pino'
import path from 'path'

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
export type ConfigurableLogLevel = 'TRACE' | 'DEBUG' | 'INFO'
export interface LogDetails {
  event_name: string
  method_name?: string
  ex_event_type?: string
  user_id?: number | null
  message: string
  context?: unknown
}
type ScopedLogger = {
  debug: (message: string, context?: unknown) => void
  info: (message: string, context?: unknown) => void
  warn: (message: string, context?: unknown) => void
  error: (message: string, context?: unknown) => void
  elapsedTime: (message: string, context?: unknown) => void
}

const LEVELS: Record<LogLevel, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 }

class Logger {
  private readonly outputLogger: pino.Logger
  private currentLevel: number

  constructor() {
    const envLevel: LogLevel = process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG'
    this.currentLevel = LEVELS[envLevel]
    const storagePath = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage')
    const logDirectory = path.resolve(storagePath, 'logs')
    const transportTargets: pino.TransportTargetOptions[] = process.env.NODE_ENV === 'test'
      ? []
      : [{
        target: 'pino-roll',
        level: 'trace',
        options: {
          file: path.join(path.resolve(logDirectory), 'ssrfinan.log'),
          frequency: 'daily',
          dateFormat: 'yyyy-MM-dd',
          mkdir: true,
          limit: { count: 7, removeOtherLogFiles: true },
        },
      }]

    if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
      transportTargets.push({
        target: 'pino-pretty',
        level: 'trace',
        options: {
          colorize: true,
          singleLine: true,
          levelFirst: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname,level_name',
        },
      })
    }

    this.outputLogger = pino({
      level: envLevel.toLowerCase(),
      base: { service: process.env.NODE_LOG_SERVICE || 'ssrfinan-api' },
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label, number) => ({ level: number, level_name: label.toUpperCase() }),
      },
    }, transportTargets.length ? pino.transport({ targets: transportTargets }) : undefined)
  }

  private shouldLog(level: LogLevel) {
    return LEVELS[level] >= this.currentLevel
  }

  getLevel(): ConfigurableLogLevel {
    return this.outputLogger.level.toUpperCase() as ConfigurableLogLevel
  }

  setLevel(level: ConfigurableLogLevel) {
    this.outputLogger.level = level.toLowerCase()
    this.currentLevel = level === 'INFO' ? LEVELS.INFO : LEVELS.DEBUG
  }

  private serialize(value: unknown): unknown {
    if (value === undefined) return undefined
    try {
      return JSON.parse(JSON.stringify(value))
    } catch {
      return { message: 'Unserializable log metadata', value: String(value) }
    }
  }

  private normalizeDetails(message_or_details: string | LogDetails, meta?: unknown): LogDetails {
    if (typeof message_or_details !== 'string') return message_or_details

    const function_match = message_or_details.match(/^(?:method=\[([^\]]+)\]|([^\s.-]+))(?:(?:-Error| called|\s-\sError).*)?$/i)
    const tagged_match = message_or_details.match(/^\[([^\]]+)\]/)
    const event_name = function_match?.[1] || function_match?.[2] || tagged_match?.[1] || 'APPLICATION'
    return { event_name, message: message_or_details, context: meta }
  }

  private write(level: LogLevel, message_or_details: string | LogDetails, meta?: unknown) {
    const details = this.normalizeDetails(message_or_details, meta)
    const serialized_meta = details.context === undefined ? undefined : this.serialize(details.context)
    const fields = {
      event_name: details.event_name,
      method_name: details.method_name || 'unknown',
      ...(details.ex_event_type ? { ex_event_type: details.ex_event_type } : {}),
      ...(details.user_id !== undefined ? { user_id: details.user_id } : {}),
      ...(serialized_meta !== undefined ? { context: serialized_meta } : {}),
    }

    switch (level) {
      case 'DEBUG':
        this.outputLogger.debug(fields, details.message)
        break
      case 'INFO':
        this.outputLogger.info(fields, details.message)
        break
      case 'WARN':
        this.outputLogger.warn(fields, details.message)
        break
      case 'ERROR':
        this.outputLogger.error(fields, details.message)
        break
    }

  }

  forMethod(method_name: string, event_name = 'APPLICATION', user_id: number | null = null): ScopedLogger {
    return {
      debug: (message, context) => this.debug({ event_name, method_name, user_id, message, context }),
      info: (message, context) => this.info({ event_name, method_name, user_id, message, context }),
      warn: (message, context) => this.warn({ event_name, method_name, user_id, message, context }),
      error: (message, context) => this.error({ event_name, method_name, user_id, message, context }),
      elapsedTime: (message, context) => this.elapsedTime({ event_name, method_name, user_id, message, context }),
    }
  }

  debug(message: string | LogDetails, meta?: unknown) { if (this.shouldLog('DEBUG')) this.write('DEBUG', message, meta) }
  info(message: string | LogDetails, meta?: unknown) { if (this.shouldLog('INFO')) this.write('INFO', message, meta) }
  warn(message: string | LogDetails, meta?: unknown) { if (this.shouldLog('WARN')) this.write('WARN', message, meta) }
  error(message: string | LogDetails, meta?: unknown) { if (this.shouldLog('ERROR')) this.write('ERROR', message, meta) }
  elapsedTime(message: string | LogDetails, meta?: unknown) {
    const details = typeof message === 'string'
      ? { event_name: 'APPLICATION', message, context: meta, ex_event_type: 'ELAPSED_TIME' }
      : { ...message, ex_event_type: 'ELAPSED_TIME' }
    this.write('INFO', details)
  }
}

export const logger = new Logger()