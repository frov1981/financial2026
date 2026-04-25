import { Router } from 'express'
import {
    apiForGettingCashSummary,
    apiForGettingKpis,
    apiForGettingLoanSummary,
    apiForLogout,
    apiForValidatingLogin,
    routeToPageHome,
    routeToPageLogin,
    routeToPageRoot
} from '../controllers/home/home.controller'
import { injectNetBalance } from '../middlewares/inject-net-balance.middleware'
import { sessionAuthMiddleware } from '../middlewares/session-auth.middleware'
import { loginLimiter } from '../config/rate-limiter'

const router = Router()

// Public routes
router.post('/login', loginLimiter, apiForValidatingLogin)
router.get('/login', routeToPageLogin)
router.get('/', routeToPageRoot)

// Protected routes
const protectedSubRouter = Router()
protectedSubRouter.use(sessionAuthMiddleware)
protectedSubRouter.use(injectNetBalance)

protectedSubRouter.get('/logout', apiForLogout)
protectedSubRouter.get('/kpis', apiForGettingKpis)
protectedSubRouter.get('/cash-summary', apiForGettingCashSummary)
protectedSubRouter.get('/loan-summary', apiForGettingLoanSummary)
protectedSubRouter.get('/home', routeToPageHome)

router.use(protectedSubRouter)

export default router
