import fs from 'fs/promises'
import path from 'path'
import sharp from 'sharp'
import { AppDataSource } from '../config/typeorm.datasource'
import { FileReference } from '../entities/FileReference.entity'
import { Transaction } from '../entities/Transaction.entity'

export const fileOwnerTables = [
  'accounts',
  'categories',
  'category_groups',
  'payables',
  'payable_groups',
  'payable_payments',
  'receivables',
  'receivable_groups',
  'receivable_collections',
  'transactions'
] as const

export type FileOwnerTable = typeof fileOwnerTables[number]

export interface SaveFileReferenceInput {
  tableName: FileOwnerTable
  recordId: number
  buffer: Buffer
  originalName: string
}

const storagePath = () => process.env.STORAGE_PATH || path.join(process.cwd(), 'storage')

const imageFormats = new Map([
  ['avif', { extension: '.avif', mimeType: 'image/avif' }],
  ['gif', { extension: '.gif', mimeType: 'image/gif' }],
  ['jpeg', { extension: '.jpg', mimeType: 'image/jpeg' }],
  ['png', { extension: '.png', mimeType: 'image/png' }],
  ['webp', { extension: '.webp', mimeType: 'image/webp' }]
])

function getMaximumImageSize(): number {
  const megabytes = Number(process.env.MAX_IMAGE_SIZE_MB || 10)
  return (Number.isFinite(megabytes) && megabytes > 0 ? megabytes : 10) * 1024 * 1024
}

function getSafeOriginalName(originalName: string): string {
  const safeName = path.basename(originalName).replace(/[^a-zA-Z0-9._ -]/g, '_')
  return (safeName || 'image').slice(0, 255)
}

async function inspectImage(buffer: Buffer): Promise<{ extension: string, mimeType: string, thumbnail: Buffer }> {
  if (buffer.length === 0) {
    throw new Error('El archivo de imagen está vacío')
  }

  if (buffer.length > getMaximumImageSize()) {
    throw new Error('La imagen supera el tamaño máximo permitido')
  }

  const metadata = await sharp(buffer).metadata()
  const format = metadata.format ? imageFormats.get(metadata.format) : undefined
  if (!format) {
    throw new Error('Solo se permiten imágenes AVIF, GIF, JPEG, PNG o WebP')
  }

  const thumbnail = await sharp(buffer)
    .resize({ width: 400, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()

  return { ...format, thumbnail }
}

export async function saveFileReference(input: SaveFileReferenceInput): Promise<FileReference> {
  if (!Number.isInteger(input.recordId) || input.recordId <= 0) {
    throw new Error('El id del registro debe ser un entero positivo')
  }

  const image = await inspectImage(input.buffer)
  const repository = AppDataSource.getRepository(FileReference)
  const reference = repository.create({
    table_name: input.tableName,
    record_id: input.recordId,
    path: '',
    thumbnail_path: null,
    original_name: getSafeOriginalName(input.originalName),
    mime_type: image.mimeType,
    size_bytes: input.buffer.length
  })
  const savedReference = await repository.save(reference)
  const fileName = `${savedReference.id}-${input.tableName}${image.extension}`
  const thumbnailFileName = `${savedReference.id}-${input.tableName}-thumb.webp`
  const relativePath = path.join(input.tableName, fileName)
  const relativeThumbnailPath = path.join(input.tableName, thumbnailFileName)
  const absolutePath = path.join(storagePath(), relativePath)
  const absoluteThumbnailPath = path.join(storagePath(), relativeThumbnailPath)

  try {
    await fs.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.writeFile(absolutePath, input.buffer)
    await fs.writeFile(absoluteThumbnailPath, image.thumbnail)
    savedReference.path = relativePath.split(path.sep).join('/')
    savedReference.thumbnail_path = relativeThumbnailPath.split(path.sep).join('/')
    const result = await repository.save(savedReference)
    if (input.tableName === 'transactions') {
      await syncTransactionImageCount(input.recordId)
    }
    return result
  } catch (error) {
    await Promise.allSettled([
      fs.rm(absolutePath, { force: true }),
      fs.rm(absoluteThumbnailPath, { force: true }),
      repository.delete(savedReference.id)
    ])
    throw error
  }
}

export async function getFileReferences(tableName: FileOwnerTable, recordId: number): Promise<FileReference[]> {
  return AppDataSource.getRepository(FileReference).find({
    where: { table_name: tableName, record_id: recordId },
    order: { created_at: 'ASC', id: 'ASC' }
  })
}

export async function syncTransactionImageCount(transactionId: number): Promise<number> {
  const count = await AppDataSource.getRepository(FileReference).count({
    where: { table_name: 'transactions', record_id: transactionId }
  })
  await AppDataSource.getRepository(Transaction).update(transactionId, { no_images: count })
  return count
}