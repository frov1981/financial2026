import 'dotenv/config'
import { formatDateForSystemLocal } from './date.util'

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
export interface LogDetails {
  event_name: string
  method_name?: string
  ex_event_type?: string
  user_id?: number | null
  message: string
  context?: unknown
}
export interface LogEventInput {
  occurred_at: Date
  level: LogLevel
  service: string
  event_name: string
  method_name: string
  ex_event_type: string | null
  user_id: number | null
  message: string
  context?: unknown
}

type LogEventSink = (events: LogEventInput[]) => Promise<void>

type ScopedLogger = {
  debug: (message: string, context?: unknown) => void
  info: (message: string, context?: unknown) => void
  warn: (message: string, context?: unknown) => void
  error: (message: string, context?: unknown) => void
  elapsedTime: (message: string, context?: unknown) => void
}

const LEVELS: Record<LogLevel, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 }
const COLORS: Record<LogLevel, string> = {
  DEBUG: '\x1b[34m',
  INFO: '\x1b[32m',
  WARN: '\x1b[33m',
  ERROR: '\x1b[31m',
}
const RESET_COLOR = '\x1b[0m'

class Logger {
  private currentLevel: number
  private readonly databaseLevel: number
  private readonly queue: LogEventInput[] = []
  private sink: LogEventSink | null = null
  private flush_timer: NodeJS.Timeout | null = null
  private flushing = false

  constructor() {
    const envLevel = (process.env.NODE_LOG_LEVEL || 'DEBUG').toUpperCase() as LogLevel
    this.currentLevel = LEVELS[envLevel] ?? 0
    const database_level = (process.env.NODE_LOG_DB_LEVEL || 'ERROR').toUpperCase() as LogLevel
    this.databaseLevel = LEVELS[database_level] ?? LEVELS.ERROR
  }

  private shouldLog(level: LogLevel) {
    return LEVELS[level] >= this.currentLevel
  }

  private serialize(value: unknown): unknown {
    if (value === undefined) return undefined
    try {
      return JSON.parse(JSON.stringify(value))
    } catch {
      return { message: 'Unserializable log metadata', value: String(value) }
    }
  }

  private extractUserId(details: LogDetails, context: unknown): number | null {
    const candidate = details.user_id ?? (context && typeof context === 'object' && 'user_id' in context
      ? (context as { user_id?: unknown }).user_id
      : undefined)
    if (typeof candidate === 'number' && Number.isInteger(candidate) && candidate > 0) return candidate
    if (typeof candidate === 'string' && /^\d+$/.test(candidate)) return Number(candidate)
    return null
  }

  private scheduleFlush() {
    if (this.flush_timer || this.flushing || !this.sink) return
    this.flush_timer = setTimeout(() => {
      this.flush_timer = null
      void this.flush()
    }, Number(process.env.NODE_LOG_FLUSH_INTERVAL_MS || 5000))
  }

  private normalizeDetails(message_or_details: string | LogDetails, meta?: unknown): LogDetails {
    if (typeof message_or_details !== 'string') return message_or_details

    const function_match = message_or_details.match(/^(?:method=\[([^\]]+)\]|([^\s.-]+))(?:(?:-Error| called|\s-\sError).*)?$/i)
    const tagged_match = message_or_details.match(/^\[([^\]]+)\]/)
    const event_name = function_match?.[1] || function_match?.[2] || tagged_match?.[1] || 'APPLICATION'
    return { event_name, message: message_or_details, context: meta }
  }

  private write(level: LogLevel, message_or_details: string | LogDetails, meta?: unknown, forceDatabase = false) {
    const details = this.normalizeDetails(message_or_details, meta)
    const timestamp = formatDateForSystemLocal(new Date())
    const serialized_meta = details.context === undefined ? undefined : this.serialize(details.context)
    const meta_string = serialized_meta === undefined ? '' : ` - ${JSON.stringify(serialized_meta)}`
    const output = `${COLORS[level]}[${timestamp}] [${level}] ${details.message}${meta_string}${RESET_COLOR}\n`
    if (level === 'WARN' || level === 'ERROR') process.stderr.write(output)
    else process.stdout.write(output)

    if (this.sink && (forceDatabase || LEVELS[level] >= this.databaseLevel)) {
      const max_queue = Number(process.env.NODE_LOG_MAX_QUEUE || 2000)
      if (this.queue.length < max_queue) {
        this.queue.push({
          occurred_at: new Date(),
          level,
          service: process.env.NODE_LOG_SERVICE || 'ssrfinan-api',
          event_name: details.event_name.slice(0, 150),
          method_name: details.method_name?.slice(0, 150) || 'unknown',
          ex_event_type: details.ex_event_type?.slice(0, 25) || null,
          user_id: this.extractUserId(details, serialized_meta),
          message: details.message,
          context: serialized_meta,
        })
        this.scheduleFlush()
      }
    }
  }

  setDatabaseSink(sink: LogEventSink) {
    this.sink = sink
    this.scheduleFlush()
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

  async flush() {
    if (!this.sink || this.flushing || this.queue.length === 0) return
    this.flushing = true
    const batch = this.queue.splice(0, Number(process.env.NODE_LOG_BATCH_SIZE || 50))
    try {
      await this.sink(batch)
    } catch {
      this.queue.unshift(...batch)
    } finally {
      this.flushing = false
      if (this.queue.length > 0) this.scheduleFlush()
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
    this.write('INFO', details, undefined, true)
  }
}

export const logger = new Logger()