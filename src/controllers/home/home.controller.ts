import bcrypt from 'bcryptjs'
import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/datasource'
import { User } from '../../entities/User.entity'
import { send2FACode } from '../../services/2fa.service'
import { AuthRequest } from '../../types/AuthRequest'
import { logger } from '../../utils/logger.util'
import { getGlobalKPIs, getLastSixMonthsChartData, getLastSixMonthsKPIs, getLastSixYearsChartData } from './home.controller.auxiliar'

export const routeToPageRoot = (req: Request, res: Response) => {
  if ((req.session as any)?.userId) {
    return res.redirect('/home')
  }
  res.redirect('/login')
}

export const routeToPageLogin = (req: Request, res: Response) => {
  res.render(
    'pages/login',
    {
      error: null
    })
}

export const routeToPageHome = async (req: Request, res: Response) => {
  const isDev = process.env.NODE_ENV === 'development'
  const userId = isDev ? 1 : (req.session as any)?.userId
  if (!userId) {
    return res.redirect('/login')
  }

  const userRepo = AppDataSource.getRepository(User)
  const user = await userRepo.findOneBy({ id: userId })
  if (!user) {
    return res.redirect('/login')
  }

  res.render(
    'layouts/main',
    {
      title: 'Inicio',
      view: 'pages/home',
      USER_ID: user?.id || 'guest',
      user,
    })
}

export const apiForValidatingLogin = async (req: Request, res: Response) => {
  try {
    if (process.env.NODE_ENV === 'development') {
      const userRepo = AppDataSource.getRepository(User)
      const devUser = await userRepo.findOneBy({ id: 1 })
      if (devUser) {
        (req.session as any).userId = devUser.id
        return res.redirect('/home')
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

    await send2FACode(user)
      ; (req.session as any).pending2FAUserId = user.id

    await new Promise<void>((resolve, reject) => {
      req.session.save(err => {
        if (err) reject(err)
        else resolve()
      })
    })

    return res.redirect('/2fa')

  } catch (error) {
    logger.error('Error en doLogin:', error)
    res.render(
      'pages/login',
      {
        error: 'Error interno, intenta de nuevo'
      })
  }
}

export const apiForGettingKpis: RequestHandler = async (
  req: Request, res: Response
) => {
  const authReq = req as AuthRequest

  try {
    const lastSixMonthsChartData = await getLastSixMonthsChartData(authReq)
    const lastSixYearsChartData = await getLastSixYearsChartData(authReq)
    const kpis = await getLastSixMonthsKPIs(authReq)
    const globalKpis = await getGlobalKPIs(authReq)
    res.json({ lastSixMonthsChartData, lastSixYearsChartData, kpis, globalKpis })

  } catch (error) {
    logger.error('Error en apiForGettingKpis:', error)
    res.json({ message: 'Error' })
  }

}