import { Request, Response } from 'express'
import { AppDataSource } from '../config/datasource'
import { User } from '../entities/User.entity'
import bcrypt from 'bcryptjs'
import { logger } from '../utils/logger.util'
import { send2FACode } from '../services/2fa.service'

// GET /
export const root = (req: Request, res: Response) => {
  if ((req.session as any)?.userId) return res.redirect('/home')
  res.redirect('/login')
}

// GET /login
export const showLogin = (req: Request, res: Response) => {
  // Solo renderiza login limpio, sin navbar
  res.render('pages/login', { error: null })
}

// POST /login
/*export const doLogin = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body   
    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOneBy({ name: username })
    logger.info(`Usuario encontrado: ${user ? 'sí' : 'no'}`)

    if (!user) return res.render('pages/login', { error: 'Usuario no encontrado' })

    const validPassword = await bcrypt.compare(password, user.password_hash)
    if (!validPassword) return res.render('pages/login', { error: 'Contraseña incorrecta' })

    // Guardar en session
    ;(req.session as any).userId = user.id
    res.redirect('/home')
  } catch (error) {
    console.error(error)
    res.render('pages/login', { error: 'Error interno, intenta de nuevo' })
  }
}*/

// POST /login
export const doLogin = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body

    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOneBy({ name: username })

    if (!user) return res.render('pages/login', { error: 'Usuario no encontrado' })

    const validPassword = await bcrypt.compare(password, user.password_hash)
    if (!validPassword) return res.render('pages/login', { error: 'Contraseña incorrecta' })

    // NUEVO: 2FA pendiente
    await send2FACode(user)
      ; (req.session as any).pending2FAUserId = user.id

    res.redirect('/2fa')
  } catch (error) {
    logger.error('Error en doLogin:', error)
    res.render('pages/login', { error: 'Error interno, intenta de nuevo' })
  }
}


// GET /home
export const home = async (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId
  if (!userId) return res.redirect('/login')

  const userRepo = AppDataSource.getRepository(User)
  const user = await userRepo.findOneBy({ id: userId })
  if (!user) return res.redirect('/login')

  // Renderiza main.ejs con navbar y el contenido de home
  res.render('layouts/main', {
    title: 'Inicio',
    view: 'pages/home',
    user
  })
}
