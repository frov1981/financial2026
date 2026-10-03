import { Router } from 'express'
import { getDevicePreferences, saveDevicePreferences } from '../controllers/device-preferences/device-preferences.controller'

const router = Router()

router.get('/', getDevicePreferences)
router.post('/', saveDevicePreferences)

export default router
