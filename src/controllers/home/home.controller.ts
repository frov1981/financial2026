import bcrypt from 'bcryptjs'
import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { User } from '../../entities/User.entity'
import { send2FACode } from '../../services/2fa.service'
import { AuthRequest } from '../../types/auth-request'
import { logger } from '../../utils/logger.util'
import { getChartDataLast6MonthsBalance, getChartDataLast6YearsBalance, getChartDataLast6YearsLoan, getKpisGlobalBalance, getKpisLast6MonthsBalance } from './home.auxiliar'

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
    /* ============================
       Modo desarrollo: login directo
    ============================ */
    if (process.env.NODE_ENV === 'development') {
      const userRepo = AppDataSource.getRepository(User)
      const devUser = await userRepo.findOneBy({ id: 1 })

      if (devUser) {
        (req.session as any).userId = devUser.id
          ; (req.session as any).timezone = 'America/Guayaquil'
        return res.redirect('/home')
      }
    }

    /* ============================
       Login normal
    ============================ */
    const { username, password } = req.body
    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOneBy({ name: username })

    if (!user) {
      return res.render(
        'pages/login',
        {
          error: 'Usuario no encontrado'
        }
      )
    }

    const validPassword = await bcrypt.compare(password, user.password_hash)

    if (!validPassword) {
      return res.render(
        'pages/login',
        {
          error: 'Contraseña incorrecta'
        }
      )
    }

    /* ============================
       Guardar timezone en sesión
    ============================ */
    const timezone = String(req.body.timezone || 'UTC')
      ; (req.session as any).timezone = timezone

    /* ============================
       Enviar código 2FA y guardar usuario pendiente
    ============================ */
    await send2FACode(user)
      ; (req.session as any).pending2FAUserId = user.id

    /* ============================
       Persistir sesión
    ============================ */
    await new Promise<void>((resolve, reject) => {
      req.session.save(err => {
        if (err) reject(err)
        else resolve()
      })
    })

    return res.redirect('/2fa')
  } catch (error) {
    logger.error('Error en doLogin:', error)
    return res.render(
      'pages/login',
      {
        error: 'Error interno, intenta de nuevo'
      }
    )
  }
}

export const apiForGettingKpis: RequestHandler = async (
  req: Request, res: Response
) => {
  const authReq = req as AuthRequest

  try {
    const kpisGlobalBalance = await getKpisGlobalBalance(authReq)
    const kpisLast6MonthsBalance = await getKpisLast6MonthsBalance(authReq)
    const chartDataLast6MonthsBalance = await getChartDataLast6MonthsBalance(authReq)
    const chartDataLast6YearsBalance = await getChartDataLast6YearsBalance(authReq)
    const chartDataLast6YearsLoan = await getChartDataLast6YearsLoan(authReq)

    res.json({
      kpisGlobalBalance,
      kpisLast6MonthsBalance,
      chartDataLast6MonthsBalance,
      chartDataLast6YearsBalance,
      chartDataLast6YearsLoan,
    })

  } catch (error) {
    logger.error('Error en apiForGettingKpis:', error)
    res.json({ message: 'Error' })
  }

}