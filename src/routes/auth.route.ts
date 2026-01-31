import { Router } from 'express'
import { show2FA, verify2FA } from '../controllers/home/2fa.controller'

const router = Router()

router.get('/2fa', show2FA)
router.post('/2fa', verify2FA)

export default router
