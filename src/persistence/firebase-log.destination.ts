import { Writable } from 'stream'
import { LogStorageAdapter } from './persistence.adapter'

const logFlushIntervalMs = 5000
const maximumLogFiles = 7

function dateSuffix(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date)
  const values = new Map(parts.map(part => [part.type, part.value]))
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`
}

export class FirebaseLogDestination extends Writable {
  private activeKey: string | null = null
  private activeContent = ''
  private flushTimer: NodeJS.Timeout | null = null
  private operationQueue: Promise<void> = Promise.resolve()
  private readonly loadingContent = new Map<string, Promise<string>>()

  constructor(
    private readonly logs: LogStorageAdapter,
    private readonly timeZone: string
  ) {
    super()
  }

  private keyFor(date: Date): string {
    return `logs/ssrfinan.${dateSuffix(date, this.timeZone)}.log`
  }

  private async readExistingContent(key: string): Promise<string> {
    const pending = this.loadingContent.get(key)
    if (pending) return pending

    const loading = this.logs.list().then(async logFiles => {
      if (!logFiles.some(logFile => logFile.key === key)) return ''
      return this.logs.read(key)
    })
    this.loadingContent.set(key, loading)
    try {
      return await loading
    } finally {
      this.loadingContent.delete(key)
    }
  }

  private async activate(key: string): Promise<void> {
    if (this.activeKey === key) return
    await this.saveActiveContent()
    this.activeContent = await this.readExistingContent(key)
    this.activeKey = key
  }

  private queue(operation: () => Promise<void>): Promise<void> {
    const result = this.operationQueue.then(operation)
    this.operationQueue = result.catch(error => {
      console.error('Error persistiendo logs en Firebase', error)
    })
    return result
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      void this.flush().catch(error => {
        console.error('Error persistiendo logs en Firebase', error)
        this.scheduleFlush()
      })
    }, logFlushIntervalMs)
    this.flushTimer.unref()
  }

  private async pruneOldLogs(): Promise<void> {
    const logFiles = await this.logs.list()
    const retained = logFiles
      .sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime())
      .slice(0, maximumLogFiles)
    const retainedKeys = new Set(retained.map(logFile => logFile.key))
    const expiredLogs = logFiles.filter(logFile => !retainedKeys.has(logFile.key))
    await Promise.all(expiredLogs.map(logFile => this.logs.delete(logFile.key)))
  }

  private async saveActiveContent(): Promise<void> {
    if (!this.activeKey || !this.activeContent) return
    await this.logs.save(this.activeKey, this.activeContent, new Date())
    await this.pruneOldLogs()
  }

  private flush(): Promise<void> {
    if (!this.activeKey || !this.activeContent) return this.operationQueue
    return this.queue(() => this.saveActiveContent())
  }

  override _write(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    const text = typeof chunk === 'string' ? chunk : chunk.toString('utf8')
    const key = this.keyFor(new Date())
    void this.queue(async () => {
      await this.activate(key)
      this.activeContent += text
    }).then(() => {
      this.scheduleFlush()
      callback()
    }, error => callback(error instanceof Error ? error : new Error(String(error))))
  }

  override _final(callback: (error?: Error | null) => void): void {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = null
    void this.flush().then(() => callback(), error => {
      callback(error instanceof Error ? error : new Error(String(error)))
    })
  }
}
