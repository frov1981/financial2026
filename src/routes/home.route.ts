import { Router } from 'express'
import {
    apiForGettingKpis,
    apiForValidatingLogin,
    routeToPageHome,
    routeToPageLogin,
    routeToPageRoot
} from '../controllers/home/home.controller'

const router = Router()

/*Eventos de acción */
router.post('/login', apiForValidatingLogin)
router.get('/kpis', apiForGettingKpis)

/*Eventos de enrutamiento */
router.get('/', routeToPageRoot)
router.get('/login', routeToPageLogin)
router.get('/home', routeToPageHome)

export default router
