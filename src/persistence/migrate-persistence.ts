import { createHash } from 'crypto'
import { PersistenceAdapter } from './persistence.adapter'

export interface MigrationSummary {
  files: { total: number, copied: number, alreadyPresent: number, verified: number }
  logs: { total: number, copied: number, alreadyPresent: number, verified: number }
  errors: string[]
}

function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex')
}

function sameContent(source: Buffer, target: Buffer): boolean {
  return source.length === target.length && sha256(source) === sha256(target)
}

async function migrateFiles(
  source: PersistenceAdapter,
  target: PersistenceAdapter,
  summary: MigrationSummary
): Promise<void> {
  const [sourceFiles, targetFiles] = await Promise.all([
    source.files.list('images/'),
    target.files.list('images/')
  ])
  summary.files.total = sourceFiles.length
  const targetByKey = new Map(targetFiles.map(file => [file.key, file]))

  for (const sourceFile of sourceFiles) {
    try {
      const content = await source.files.read(sourceFile.key)
      if (content.length !== sourceFile.sizeBytes) {
        throw new Error('el tamaño del origen cambió durante la migración')
      }

      const targetFile = targetByKey.get(sourceFile.key)
      if (targetFile) {
        const targetContent = await target.files.read(sourceFile.key)
        if (!sameContent(content, targetContent)) {
          throw new Error('ya existe un objeto distinto con la misma clave en el destino')
        }
        summary.files.alreadyPresent += 1
      } else {
        await target.files.save(sourceFile.key, content, sourceFile.contentType)
        summary.files.copied += 1
      }

      const verifiedContent = await target.files.read(sourceFile.key)
      if (!sameContent(content, verifiedContent)) {
        throw new Error('la verificación SHA-256 del destino falló')
      }
      summary.files.verified += 1
    } catch (error) {
      summary.errors.push(`Archivo ${sourceFile.key}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

async function migrateLogs(
  source: PersistenceAdapter,
  target: PersistenceAdapter,
  summary: MigrationSummary
): Promise<void> {
  const [sourceLogs, targetLogs] = await Promise.all([
    source.logs.list(),
    target.logs.list()
  ])
  summary.logs.total = sourceLogs.length
  const targetByKey = new Map(targetLogs.map(log => [log.key, log]))

  for (const sourceLog of sourceLogs) {
    try {
      const sourceContent = Buffer.from(await source.logs.read(sourceLog.key), 'utf8')
      if (sourceContent.length !== sourceLog.sizeBytes) {
        throw new Error('el tamaño del origen cambió durante la migración')
      }

      const targetLog = targetByKey.get(sourceLog.key)
      if (targetLog) {
        const targetContent = Buffer.from(await target.logs.read(sourceLog.key), 'utf8')
        if (!sameContent(sourceContent, targetContent)) {
          throw new Error('ya existe un objeto distinto con la misma clave en el destino')
        }
        summary.logs.alreadyPresent += 1
      } else {
        await target.logs.save(sourceLog.key, sourceContent.toString('utf8'), sourceLog.updatedAt)
        summary.logs.copied += 1
      }

      const verifiedContent = Buffer.from(await target.logs.read(sourceLog.key), 'utf8')
      if (!sameContent(sourceContent, verifiedContent)) {
        throw new Error('la verificación SHA-256 del destino falló')
      }
      summary.logs.verified += 1
    } catch (error) {
      summary.errors.push(`Log ${sourceLog.key}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

export async function migratePersistence(
  source: PersistenceAdapter,
  target: PersistenceAdapter
): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
    files: { total: 0, copied: 0, alreadyPresent: 0, verified: 0 },
    logs: { total: 0, copied: 0, alreadyPresent: 0, verified: 0 },
    errors: []
  }

  await migrateFiles(source, target, summary)
  await migrateLogs(source, target, summary)
  return summary
}
