import { Router } from 'express'
import { adminOnlyMiddleware } from '../middlewares/admin-only.middleware'
import {
  apiForChangingLogLevel,
  apiForOpeningLogFile,
  routeToAdminPage,
  routeToLogReader,
} from '../controllers/admin/admin.controller'

const router = Router()

router.use(adminOnlyMiddleware)
router.get('/', routeToAdminPage)
router.post('/level', apiForChangingLogLevel)
router.post('/logs', apiForOpeningLogFile)
router.get('/logs', routeToLogReader)

export default router
