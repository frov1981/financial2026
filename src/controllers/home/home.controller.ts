import bcrypt from 'bcryptjs'
import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { User } from '../../entities/User.entity'
import { send2FACode } from '../../services/send-2fa.service'
import { AuthRequest } from '../../types/auth-request'
import { logger } from '../../utils/logger.util'
import { getChartDataLast6MonthsBalance, getChartDataLast6YearsBalance, getChartDataLast6YearsLoan, getKpisCachelBalance, getKpisGlobalBalance, getKpisLast6MonthsBalance } from './home.auxiliar'

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
  const skipLogin = process.env.NODE_SKIP_LOGIN === 'true'
  const userId = skipLogin ? 1 : (req.session as any)?.userId
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

/*==============================================
  APIs para acciones desde el frontend
  Recibe los datos del usuario
  Recibe la zona horaria del cliente para guardarla en sesión
  Valida si NODE_SKIP_LOGIN=true para saltar login (desarrollo)
  Si no, valida usuario y contraseña
  Si es correcto, envía código 2FA y guarda usuario pendiente en sesión
  Redirige a página de 2FA
==============================================*/
export const apiForValidatingLogin = async (req: Request, res: Response) => {
  try {
    logger.debug(`${apiForValidatingLogin.name}-Start`)
    const selectedFields: (keyof User)[] = ['id', 'email', 'password_hash', 'name', 'created_at']
    const timezone = String(req.body.timezone || 'UTC')
    /* ============================
       Modo Skip Login (Desarrollo)
       Si existe la variable de entorno NODE_SKIP_LOGIN=true, se omite la validación de usuario y contraseña.
       Se busca un usuario de desarrollo por ID (definido en DEV_USER_ID) y se inicia sesión con ese usuario.
       Esto permite a los desarrolladores saltarse el proceso de login durante el desarrollo.
    ============================ */
    if (process.env.NODE_SKIP_LOGIN === 'true') {
      const userRepo = AppDataSource.getRepository(User)
      const devUser = await userRepo.findOne({
        where: { id: Number(process.env.DEV_USER_ID) || 1 },
        select: selectedFields
      })

      if (devUser) {
        (req.session as any).userId = devUser.id;
        (req.session as any).timezone = timezone
        return res.redirect('/home')
      }
    }

    /* ============================
       Login Produccion
    ============================ */
    const { username, password } = req.body
    const userRepo = AppDataSource.getRepository(User)
    const user = await userRepo.findOne({
      where: { name: username },
      select: selectedFields
    })

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
    (req.session as any).timezone = timezone
    logger.debug(`${apiForValidatingLogin.name}-Timezone from request: [${timezone}]`)

    /* ============================
       Enviar código 2FA y guardar usuario pendiente
    ============================ */
    await send2FACode(user);
    (req.session as any).pending2FAUserId = user.id

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
    logger.error(`${apiForValidatingLogin.name}-Error. `, error)
    return res.render(
      'pages/login',
      {
        error: 'Error interno, intenta de nuevo'
      }
    )
  } finally {
    logger.debug(`${apiForValidatingLogin.name}-End`)
  }
}

export const apiForGettingKpis: RequestHandler = async (
  req: Request, res: Response
) => {
  const authReq = req as AuthRequest

  try {
    //const kpisGlobalBalance = await getKpisGlobalBalance(authReq)
    //const kpisLast6MonthsBalance = await getKpisLast6MonthsBalance(authReq)
    const kpisCacheBalance = await getKpisCachelBalance(authReq)
    const chartDataLast6MonthsBalance = await getChartDataLast6MonthsBalance(authReq)
    const chartDataLast6YearsBalance = await getChartDataLast6YearsBalance(authReq)
    const chartDataLast6YearsLoan = await getChartDataLast6YearsLoan(authReq)

    res.json({
      kpisCacheBalance,
      //kpisGlobalBalance,
      //kpisLast6MonthsBalance,
      chartDataLast6MonthsBalance,
      chartDataLast6YearsBalance,
      chartDataLast6YearsLoan,
    })

  } catch (error) {
    logger.error('Error en apiForGettingKpis:', error)
    res.json({ message: 'Error' })
  }

}

export const apiForLogout: RequestHandler = async (req: Request, res: Response) => {
  try {
    req.session.destroy(err => {
      if (err) {
        logger.error('Error destroying session:', err)
        return res.redirect('/home')
      }

      res.clearCookie('connect.sid')
      return res.redirect('/login')
    })
  } catch (error) {
    logger.error('Logout error:', error)
    return res.redirect('/login')
  }
}
