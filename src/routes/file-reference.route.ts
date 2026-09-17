import { Router } from 'express'
import multer from 'multer'
import {
  apiForDeletingFile,
  apiForGettingFiles,
  apiForServingFile,
  apiForUploadingFiles
} from '../controllers/file-reference/file-reference.controller'

const router = Router()
const configuredSize = Number(process.env.MAX_IMAGE_SIZE_MB || 10) * 1024 * 1024
const maxImageSize = Number.isFinite(configuredSize) && configuredSize > 0 ? configuredSize : 10 * 1024 * 1024
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 10, fileSize: maxImageSize }
})

router.get('/item/:id/thumbnail', apiForServingFile)
router.get('/item/:id', apiForServingFile)
router.delete('/item/:id', apiForDeletingFile)
router.post('/:tableName/:recordId', upload.array('images', 10), apiForUploadingFiles)
router.get('/:tableName/:recordId', apiForGettingFiles)

export default router
