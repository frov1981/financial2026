import 'dotenv/config'
import { formatDateForInputLocal, formatDateForSystemLocal } from './date.util'

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

const LEVELS: Record<LogLevel, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 }

// Colores ANSI
const COLORS: Record<LogLevel, string> = {
  DEBUG: '\x1b[34m', // azul
  INFO: '\x1b[32m',  // verde
  WARN: '\x1b[33m',  // amarillo
  ERROR: '\x1b[31m'  // rojo
}
const RESET_COLOR = '\x1b[0m'

class Logger {
  private currentLevel: number

  constructor() {
    const envLevel = (process.env.LOG_LEVEL || 'DEBUG').toUpperCase() as LogLevel
    this.currentLevel = LEVELS[envLevel] ?? 0
  }

  private shouldLog(level: LogLevel) {
    return LEVELS[level] >= this.currentLevel
  }

  private format(level: LogLevel, message: string, meta?: any) {
    const timestamp = formatDateForSystemLocal(new Date())
    const metaString = meta ? ` - ${JSON.stringify(meta)}` : ''
    return `[${timestamp}] [${level}] ${message}${metaString}`
  }

  private color(level: LogLevel, msg: string) {
    return `${COLORS[level]}${msg}${RESET_COLOR}`
  }

  debug(message: string, meta?: any) { if (this.shouldLog('DEBUG')) console.log(this.color('DEBUG', this.format('DEBUG', message, meta))) }
  info(message: string, meta?: any) { if (this.shouldLog('INFO')) console.log(this.color('INFO', this.format('INFO', message, meta))) }
  warn(message: string, meta?: any) { if (this.shouldLog('WARN')) console.warn(this.color('WARN', this.format('WARN', message, meta))) }
  error(message: string, meta?: any) { if (this.shouldLog('ERROR')) console.error(this.color('ERROR', this.format('ERROR', message, meta))) }
}

export const logger = new Logger()

/*
import 'dotenv/config'
import { formatDateForInputLocal, formatDateForSystemLocal } from './date.util'

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

const LEVELS: Record<LogLevel, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 }

class Logger {
  private currentLevel: number

  constructor() {
    const envLevel = (process.env.LOG_LEVEL || 'DEBUG').toUpperCase() as LogLevel
    this.currentLevel = LEVELS[envLevel] ?? 0
  }

  private shouldLog(level: LogLevel) {
    return LEVELS[level] >= this.currentLevel
  }

  private format(level: LogLevel, message: string, meta?: any) {
    const timestamp = formatDateForSystemLocal(new Date())
    const metaString = meta ? ` - ${JSON.stringify(meta)}` : ''
    return `[${timestamp}] [${level}] ${message}${metaString}`
  }

  debug(message: string, meta?: any) { if (this.shouldLog('DEBUG')) console.log(this.format('DEBUG', message, meta)) }
  info(message: string, meta?: any) { if (this.shouldLog('INFO')) console.log(this.format('INFO', message, meta)) }
  warn(message: string, meta?: any) { if (this.shouldLog('WARN')) console.warn(this.format('WARN', message, meta)) }
  error(message: string, meta?: any) { if (this.shouldLog('ERROR')) console.error(this.format('ERROR', message, meta)) }
}

export const logger = new Logger()
*/
