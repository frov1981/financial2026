import { Router } from 'express'
import {
    apiForGettingKpis,
    apiForLogout,
    apiForValidatingLogin,
    routeToPageHome,
    routeToPageLogin,
    routeToPageRoot
} from '../controllers/home/home.controller'
import { injectNetBalance } from '../middlewares/inject-net-balance.middleware'
import { sessionAuthMiddleware } from '../middlewares/session-auth.middleware'

const router = Router()

// Public routes
router.post('/login', apiForValidatingLogin)
router.get('/login', routeToPageLogin)
router.get('/', routeToPageRoot)

// Protected routes
const protectedSubRouter = Router()
protectedSubRouter.use(sessionAuthMiddleware)
protectedSubRouter.use(injectNetBalance)

protectedSubRouter.get('/logout', apiForLogout)
protectedSubRouter.get('/kpis', apiForGettingKpis)
protectedSubRouter.get('/home', routeToPageHome)

router.use(protectedSubRouter)

export default router
