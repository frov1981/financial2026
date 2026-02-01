import { Router } from 'express'
import {
    apiForGettingKpis,
    apiForValidatingLogin,
    routeToPageHome,
    routeToPageLogin,
    routeToPageRoot
} from '../controllers/home/home.controller' 
import { sessionAuthMiddleware } from '../middlewares/sessionAuth.middleware'

const router = Router()

/*Eventos de acción */
router.post('/login', apiForValidatingLogin)
router.get('/kpis', sessionAuthMiddleware, apiForGettingKpis)

/*Eventos de enrutamiento */
router.get('/', routeToPageRoot)
router.get('/login', routeToPageLogin)
router.get('/home', routeToPageHome)

export default router
