export interface StoredFile {
  key: string
  contentType: string
  sizeBytes: number
}

export interface FileStorageAdapter {
  save(key: string, content: Buffer, contentType: string): Promise<StoredFile>
  read(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  list(prefix: string): Promise<StoredFile[]>
}

export interface StoredLog {
  key: string
  updatedAt: Date
  sizeBytes: number
}

export interface LogStorageAdapter {
  list(): Promise<StoredLog[]>
  read(key: string): Promise<string>
  save(key: string, content: string, updatedAt?: Date): Promise<void>
  delete(key: string): Promise<void>
}

export interface PersistenceAdapter {
  files: FileStorageAdapter
  logs: LogStorageAdapter
}
