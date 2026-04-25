import { Router } from 'express'
import { show2FA, verify2FA } from '../controllers/home/2fa.controller'
import { twoFALimiter } from '../config/rate-limiter'

const router = Router()

router.get('/2fa', show2FA)
router.post('/2fa', twoFALimiter, verify2FA)

export default router
