import { Router } from 'express'
import { routeToSettingsPage } from '../controllers/settings/settings.controller'

const router = Router()

router.get('/', routeToSettingsPage)

export default router
