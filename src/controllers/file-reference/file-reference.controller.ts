import fs from 'fs/promises'
import path from 'path'
import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { FileReference } from '../../entities/FileReference.entity'
import {
  fileOwnerTables,
  FileOwnerTable,
  getFileReferences,
  saveFileReference,
  syncTransactionImageCount
} from '../../services/file-reference.service'
import { AuthRequest } from '../../types/auth-request'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'

const storagePath = () => process.env.STORAGE_PATH || path.join(process.cwd(), 'storage')

const directOwnershipTables = new Set<FileOwnerTable>([
  'accounts',
  'categories',
  'category_groups',
  'payables',
  'payable_groups',
  'receivables',
  'receivable_groups',
  'transactions'
])

function parseTableName(value: string): FileOwnerTable | null {
  return fileOwnerTables.includes(value as FileOwnerTable) ? value as FileOwnerTable : null
}

function parseRecordId(value: string): number | null {
  const recordId = Number(value)
  return Number.isInteger(recordId) && recordId > 0 ? recordId : null
}

async function userOwnsRecord(tableName: FileOwnerTable, recordId: number, userId: number): Promise<boolean> {
  if (directOwnershipTables.has(tableName)) {
    const rows = await AppDataSource.query(
      `SELECT id FROM ${tableName} WHERE id = ? AND user_id = ? LIMIT 1`,
      [recordId, userId]
    )
    return rows.length > 0
  }

  const relation = tableName === 'payable_payments'
    ? 'payable_payments item INNER JOIN payables owner ON owner.id = item.payable_id'
    : 'receivable_collections item INNER JOIN receivables owner ON owner.id = item.receivable_id'
  const rows = await AppDataSource.query(
    `SELECT item.id FROM ${relation} WHERE item.id = ? AND owner.user_id = ? LIMIT 1`,
    [recordId, userId]
  )
  return rows.length > 0
}

async function userOwnsFile(reference: FileReference, userId: number): Promise<boolean> {
  const tableName = parseTableName(reference.table_name)
  return tableName ? userOwnsRecord(tableName, reference.record_id, userId) : false
}

function absoluteStoragePath(relativePath: string): string {
  const root = path.resolve(storagePath())
  const resolved = path.resolve(root, relativePath)
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error('Ruta de archivo inválida')
  }
  return resolved
}

function imageUrls(reference: FileReference) {
  return {
    id: reference.id,
    original_name: reference.original_name,
    mime_type: reference.mime_type,
    size_bytes: reference.size_bytes,
    created_at: reference.created_at,
    url: `/files/item/${reference.id}`,
    thumbnail_url: reference.thumbnail_path ? `/files/item/${reference.id}/thumbnail` : null
  }
}

export const apiForUploadingFiles: RequestHandler = async (req: Request, res: Response) => {
  try {
    const authRequest = req as AuthRequest
    const tableName = parseTableName(req.params.tableName)
    const recordId = parseRecordId(req.params.recordId)
    if (tableName !== 'transactions' || !recordId) {
      return res.status(400).json({ error: 'Solo se permiten imágenes para transacciones' })
    }

    if (!await userOwnsRecord(tableName, recordId, authRequest.user.id)) {
      return res.status(404).json({ error: 'Registro no encontrado' })
    }

    const files = (req.files as Express.Multer.File[] | undefined) || []
    if (files.length === 0) return res.status(400).json({ error: 'Debe enviar al menos una imagen' })

    const references: FileReference[] = []
    for (const file of files) {
      references.push(await saveFileReference({
        tableName,
        recordId,
        buffer: file.buffer,
        originalName: file.originalname
      }))
    }
    const noImages = await syncTransactionImageCount(recordId)

    return res.status(201).json({
      files: references.map(imageUrls),
      no_images: noImages,
      csrfToken: res.locals.csrfToken
    })
  } catch (error) {
    logger.error(`${apiForUploadingFiles.name}-Error. `, parseError(error))
    return res.status(400).json({ error: error instanceof Error ? error.message : 'Error al guardar las imágenes' })
  }
}

export const apiForGettingFiles: RequestHandler = async (req: Request, res: Response) => {
  try {
    const authRequest = req as AuthRequest
    const tableName = parseTableName(req.params.tableName)
    const recordId = parseRecordId(req.params.recordId)
    if (tableName !== 'transactions' || !recordId) {
      return res.status(400).json({ error: 'Solo se permiten imágenes para transacciones' })
    }

    if (!await userOwnsRecord(tableName, recordId, authRequest.user.id)) {
      return res.status(404).json({ error: 'Registro no encontrado' })
    }

    const references = await getFileReferences(tableName, recordId)
    return res.json({ files: references.map(imageUrls) })
  } catch (error) {
    logger.error(`${apiForGettingFiles.name}-Error. `, parseError(error))
    return res.status(500).json({ error: 'Error al listar las imágenes' })
  }
}

async function findOwnedReference(req: Request): Promise<FileReference | null> {
  const authRequest = req as AuthRequest
  const id = parseRecordId(req.params.id)
  if (!id) return null

  const reference = await AppDataSource.getRepository(FileReference).findOneBy({ id })
  if (!reference || !await userOwnsFile(reference, authRequest.user.id)) return null
  return reference
}

export const apiForServingFile: RequestHandler = async (req: Request, res: Response) => {
  try {
    const reference = await findOwnedReference(req)
    if (!reference) return res.status(404).send('Archivo no encontrado')

    const relativePath = req.path.endsWith('/thumbnail')
      ? reference.thumbnail_path
      : reference.path
    if (!relativePath) return res.status(404).send('Archivo no encontrado')

    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable')
    return res.sendFile(absoluteStoragePath(relativePath))
  } catch (error) {
    logger.error(`${apiForServingFile.name}-Error. `, parseError(error))
    return res.status(404).send('Archivo no encontrado')
  }
}

export const apiForDeletingFile: RequestHandler = async (req: Request, res: Response) => {
  try {
    const reference = await findOwnedReference(req)
    if (!reference) return res.status(404).json({ error: 'Archivo no encontrado' })

    const paths = [reference.path, reference.thumbnail_path]
      .filter((filePath): filePath is string => Boolean(filePath))
      .map(absoluteStoragePath)
    await Promise.all(paths.map(filePath => fs.rm(filePath, { force: true })))
    await AppDataSource.getRepository(FileReference).delete(reference.id)
    const noImages = reference.table_name === 'transactions'
      ? await syncTransactionImageCount(reference.record_id)
      : null
    return res.json({ success: true, no_images: noImages, csrfToken: res.locals.csrfToken })
  } catch (error) {
    logger.error(`${apiForDeletingFile.name}-Error. `, parseError(error))
    return res.status(500).json({ error: 'Error al eliminar la imagen' })
  }
}
