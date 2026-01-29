import bcrypt from 'bcryptjs'
import { Request, Response } from 'express'
import { AppDataSource } from '../../config/datasource'
import { User } from '../../entities/User.entity'
import { send2FACode } from '../../services/2fa.service'
import { logger } from '../../utils/logger.util'

// GET /
export const root = (req: Request, res: Response) => {
  if ((req.session as any)?.userId) return res.redirect('/home')
  res.redirect('/login')
}

// GET /login
export const showLogin = (req: Request, res: Response) => {
  // Solo renderiza login limpio, sin navbar
  res.render(
    'pages/login',
    {
      error: null
    })
}

// POST /login
export const doLogin = async (req: Request, res: Response) => {
  try {
    // SALTAR login y 2FA en desarrollo
    if (process.env.NODE_ENV === 'development') {
      const userRepo = AppDataSource.getRepository(User)
      const devUser = await userRepo.findOneBy({ id: 1 }) // Usuario fijo de desarrollo
      if (devUser) {
        (req.session as any).userId = devUser.id
        return res.redirect('/home') // o la ruta principal de tu app
      }
    }

    const { username, password } = req.body

    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOneBy({ name: username })

    if (!user) {
      return res.render(
        'pages/login',
        {
          error: 'Usuario no encontrado'
        })
    }

    const validPassword = await bcrypt.compare(password, user.password_hash)
    if (!validPassword) {
      return res.render(
        'pages/login',
        {
          error: 'Contraseña incorrecta'
        })
    }

    // NUEVO: 2FA pendiente
    await send2FACode(user)
      ; (req.session as any).pending2FAUserId = user.id

    res.redirect('/2fa')
  } catch (error) {
    logger.error('Error en doLogin:', error)
    res.render(
      'pages/login',
      {
        error: 'Error interno, intenta de nuevo'
      })
  }
}

export const home = async (req: Request, res: Response) => {
  const isDev = process.env.NODE_ENV === 'development'
  const userId = isDev ? 1 : (req.session as any)?.userId
  if (!userId) return res.redirect('/login')

  const userRepo = AppDataSource.getRepository(User)
  const user = await userRepo.findOneBy({ id: userId })
  if (!user) return res.redirect('/login')

  // Renderiza main.ejs con navbar y el contenido de home
  res.render(
    'layouts/main',
    {
      title: 'Inicio',
      view: 'pages/home',
      USER_ID: user?.id || 'guest',
      user,
    })
}