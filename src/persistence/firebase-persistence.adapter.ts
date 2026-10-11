import { Storage } from '@google-cloud/storage'
import {
  FileStorageAdapter,
  LogStorageAdapter,
  PersistenceAdapter,
  StoredFile,
  StoredLog
} from './persistence.adapter'

function normalizeStorageKey(key: string): string {
  const normalizedKey = key.replace(/\\/g, '/')
  const segments = normalizedKey.split('/')
  if (
    !normalizedKey
    || normalizedKey.startsWith('/')
    || normalizedKey.includes('\0')
    || segments.some(segment => !segment || segment === '.' || segment === '..')
  ) {
    throw new Error('Clave de almacenamiento inválida')
  }
  return normalizedKey
}

class FirebaseFileStorageAdapter implements FileStorageAdapter {
  constructor(private readonly bucket: ReturnType<Storage['bucket']>) {}

  async save(key: string, content: Buffer, contentType: string): Promise<StoredFile> {
    const normalizedKey = normalizeStorageKey(key)
    await this.bucket.file(normalizedKey).save(content, {
      resumable: false,
      metadata: { contentType }
    })
    return { key: normalizedKey, contentType, sizeBytes: content.length }
  }

  async read(key: string): Promise<Buffer> {
    const normalizedKey = normalizeStorageKey(key)
    const [content] = await this.bucket.file(normalizedKey).download()
    return content
  }

  async delete(key: string): Promise<void> {
    const normalizedKey = normalizeStorageKey(key)
    await this.bucket.file(normalizedKey).delete({ ignoreNotFound: true })
  }

  async list(prefix: string): Promise<StoredFile[]> {
    const normalizedPrefix = `${normalizeStorageKey(prefix.replace(/\/+$/, ''))}/`
    const [files] = await this.bucket.getFiles({ prefix: normalizedPrefix })
    const storedFiles = await Promise.all(files
      .filter(file => !file.name.endsWith('/'))
      .map(async file => {
        const [metadata] = await file.getMetadata()
        return {
          key: file.name,
          contentType: metadata.contentType || 'application/octet-stream',
          sizeBytes: Number(metadata.size || 0)
        }
      }))
    return storedFiles.sort((first, second) => first.key.localeCompare(second.key))
  }
}

class FirebaseLogStorageAdapter implements LogStorageAdapter {
  constructor(private readonly bucket: ReturnType<Storage['bucket']>) {}

  async list(): Promise<StoredLog[]> {
    const [files] = await this.bucket.getFiles({ prefix: 'logs/' })
    const logs = files
      .filter(file => file.name.endsWith('.log'))
      .map(file => ({
        key: file.name,
        updatedAt: new Date(file.metadata.customTime || file.metadata.updated || 0),
        sizeBytes: Number(file.metadata.size || 0)
      }))

    return logs.sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime())
  }

  async read(key: string): Promise<string> {
    const normalizedKey = normalizeStorageKey(key)
    const [content] = await this.bucket.file(normalizedKey).download()
    return content.toString('utf8')
  }

  async save(key: string, content: string, updatedAt?: Date): Promise<void> {
    const normalizedKey = normalizeStorageKey(key)
    await this.bucket.file(normalizedKey).save(content, {
      resumable: false,
      metadata: {
        contentType: 'text/plain; charset=utf-8',
        ...(updatedAt ? { customTime: updatedAt.toISOString() } : {})
      }
    })
  }

  async delete(key: string): Promise<void> {
    const normalizedKey = normalizeStorageKey(key)
    await this.bucket.file(normalizedKey).delete({ ignoreNotFound: true })
  }
}

export class FirebasePersistenceAdapter implements PersistenceAdapter {
  readonly files: FileStorageAdapter
  readonly logs: LogStorageAdapter

  constructor(bucketName: string, storage = new Storage()) {
    if (!bucketName.trim()) {
      throw new Error('FIREBASE_STORAGE_BUCKET debe indicar el nombre del bucket')
    }

    const bucket = storage.bucket(bucketName)
    this.files = new FirebaseFileStorageAdapter(bucket)
    this.logs = new FirebaseLogStorageAdapter(bucket)
  }
}

export function createFirebasePersistenceAdapter(): FirebasePersistenceAdapter {
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET
  if (!bucketName) {
    throw new Error('FIREBASE_STORAGE_BUCKET debe indicar el nombre del bucket')
  }
  return new FirebasePersistenceAdapter(bucketName)
}
