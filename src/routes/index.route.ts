import { Router } from 'express'
import { root, showLogin, doLogin, home } from '../controllers/home.controller'

const router = Router()

router.get('/', root)
router.get('/login', showLogin)
router.post('/login', doLogin)
router.get('/home', home)

export default router
