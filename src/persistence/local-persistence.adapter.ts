import fs from 'fs/promises'
import path from 'path'
import {
  FileStorageAdapter,
  LogStorageAdapter,
  PersistenceAdapter,
  StoredFile,
  StoredLog
} from './persistence.adapter'

function storageRoot(): string {
  return path.resolve(process.env.STORAGE_PATH || path.join(process.cwd(), 'storage'))
}

function resolveStorageKey(key: string): string {
  if (!key || path.isAbsolute(key)) {
    throw new Error('Clave de almacenamiento inválida')
  }

  const root = storageRoot()
  const resolved = path.resolve(root, key)
  if (!resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Clave de almacenamiento inválida')
  }
  return resolved
}

function contentTypeFor(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.avif': return 'image/avif'
    case '.gif': return 'image/gif'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.png': return 'image/png'
    case '.webp': return 'image/webp'
    default: return 'application/octet-stream'
  }
}

class LocalFileStorageAdapter implements FileStorageAdapter {
  async save(key: string, content: Buffer, contentType: string): Promise<StoredFile> {
    const filePath = resolveStorageKey(key)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, content)
    return { key, contentType, sizeBytes: content.length }
  }

  read(key: string): Promise<Buffer> {
    return fs.readFile(resolveStorageKey(key))
  }

  async delete(key: string): Promise<void> {
    await fs.rm(resolveStorageKey(key), { force: true })
  }

  async list(prefix: string): Promise<StoredFile[]> {
    const directory = resolveStorageKey(prefix)
    const storedFiles: StoredFile[] = []

    const visit = async (currentDirectory: string): Promise<void> => {
      let entries
      try {
        entries = await fs.readdir(currentDirectory, { withFileTypes: true })
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT' && currentDirectory === directory) return
        throw error
      }

      for (const entry of entries) {
        const entryPath = path.join(currentDirectory, entry.name)
        if (entry.isDirectory()) {
          await visit(entryPath)
        } else if (entry.isFile()) {
          const fileStats = await fs.stat(entryPath)
          const key = path.relative(storageRoot(), entryPath).split(path.sep).join('/')
          storedFiles.push({
            key,
            contentType: contentTypeFor(entryPath),
            sizeBytes: fileStats.size
          })
        }
      }
    }

    await visit(directory)
    return storedFiles.sort((first, second) => first.key.localeCompare(second.key))
  }
}

class LocalLogStorageAdapter implements LogStorageAdapter {
  private logDirectory(): string {
    return resolveStorageKey('logs')
  }

  async list(): Promise<StoredLog[]> {
    const directory = this.logDirectory()
    let entries
    try {
      entries = await fs.readdir(directory, { withFileTypes: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
      throw error
    }
    const logs = await Promise.all(entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.log'))
      .map(async entry => {
        const filePath = path.join(directory, entry.name)
        const fileStats = await fs.stat(filePath)
        return {
          key: `logs/${entry.name}`,
          updatedAt: fileStats.mtime,
          sizeBytes: fileStats.size
        }
      }))

    return logs.sort((first, second) => second.updatedAt.getTime() - first.updatedAt.getTime())
  }

  read(key: string): Promise<string> {
    return fs.readFile(resolveStorageKey(key), 'utf8')
  }

  async save(key: string, content: string, updatedAt?: Date): Promise<void> {
    const filePath = resolveStorageKey(key)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, content, 'utf8')
    if (updatedAt) await fs.utimes(filePath, updatedAt, updatedAt)
  }

  async delete(key: string): Promise<void> {
    await fs.rm(resolveStorageKey(key), { force: true })
  }
}

export const localPersistenceAdapter: PersistenceAdapter = {
  files: new LocalFileStorageAdapter(),
  logs: new LocalLogStorageAdapter()
}
