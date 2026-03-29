import bcrypt from 'bcryptjs'
import { Request, RequestHandler, Response } from 'express'
import { deleteAll } from '../../cache/cache-key.service'
import { AppDataSource } from '../../config/typeorm.datasource'
import { User } from '../../entities/User.entity'
import { send2FACode } from '../../services/send-2fa.service'
import { AuthRequest } from '../../types/auth-request'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'
import { getAvailableYearsKpi, getBalanceKpi, getCashSummary, getChartDataLast6MonthsBalance, getChartDataLast6YearsBalance, getChartDataLast6YearsLoan, getKpisGlobalBalance, getKpisLast6MonthsBalance, getTrendKpi } from './home.auxiliar'

export const routeToPageRoot = (req: Request, res: Response) => {
  if ((req.session as any)?.user_id) {
    return res.redirect('/home')
  }
  res.redirect('/login')
}

export const routeToPageLogin = (req: Request, res: Response) => {
  res.render('pages/login', { error: null })
}

export const routeToPageHome = async (req: Request, res: Response) => {
  const skip_login = process.env.NODE_SKIP_LOGIN === 'true'
  const user_id = skip_login ? 1 : (req.session as any)?.user_id
  if (!user_id) {
    return res.redirect('/login')
  }
  const user_repo = AppDataSource.getRepository(User)
  const user = await user_repo.findOneBy({ id: user_id })
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
    const selected_fields: (keyof User)[] = ['id', 'email', 'password_hash', 'name', 'created_at']
    const timezone = String(req.body.timezone || 'UTC')
    /* ============================
       Modo Skip Login (Desarrollo)
       Si existe la variable de entorno NODE_SKIP_LOGIN=true, se omite la validación de usuario y contraseña.
       Se busca un usuario de desarrollo por ID (definido en DEV_USER_ID) y se inicia sesión con ese usuario.
       Esto permite a los desarrolladores saltarse el proceso de login durante el desarrollo.
    ============================ */
    if (process.env.NODE_SKIP_LOGIN === 'true') {
      const user_repo = AppDataSource.getRepository(User)
      const dev_user = await user_repo.findOne({
        where: { id: Number(process.env.DEV_USER_ID) || 1 },
        select: selected_fields
      })
      if (dev_user) {
        (req.session as any).user_id = dev_user.id;
        (req.session as any).timezone = timezone
        return res.redirect('/home')
      }
    }
    /* ============================
       Login Produccion
    ============================ */
    const { username, password } = req.body
    const user_repo = AppDataSource.getRepository(User)
    const user = await user_repo.findOne({
      where: { name: username },
      select: selected_fields
    })
    if (!user) {
      return res.render('pages/login', { error: 'Usuario no encontrado' })
    }
    const valid_password = await bcrypt.compare(password, user.password_hash)
    if (!valid_password) {
      return res.render('pages/login', { error: 'Contraseña incorrecta' })
    }
    /* ============================
       Guardar timezone en sesión
    ============================ */
    (req.session as any).timezone = timezone
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
  } catch (error: any) {
    logger.error(`${apiForValidatingLogin.name}-Error.`, parseError(error))
    return res.render('pages/login', { error: 'Error interno, intenta de nuevo' })
  } finally {
  }
}

export const apiForGettingKpis: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  try {
    const availableYearsKpi = await getAvailableYearsKpi(auth_req)
    const balanceKpi = await getBalanceKpi(auth_req)
    const trendKpi = await getTrendKpi(auth_req)
    const chartDataLast6MonthsBalance = await getChartDataLast6MonthsBalance(auth_req)
    const chartDataLast6YearsBalance = await getChartDataLast6YearsBalance(auth_req)
    const chartDataLast6YearsLoan = await getChartDataLast6YearsLoan(auth_req)
    res.json({
      availableYearsKpi,
      balanceKpi,
      trendKpi,
      /*Deprecated*/
      chartDataLast6MonthsBalance,
      chartDataLast6YearsBalance,
      chartDataLast6YearsLoan,
    })
  } catch (error) {
    logger.error('Error en apiForGettingKpis:', parseError(error))
    res.json({ message: 'Error' })
  }
}

export const apiForGettingCashSummary: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  try {
    const availableYearsKpi = await getAvailableYearsKpi(auth_req)
    const cashSummary = await getCashSummary(auth_req)
    res.json({
      availableYearsKpi,
      cashSummary,
    })
  } catch (error) {
    logger.error('Error en apiForGettingCashSummary:', parseError(error))
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

      deleteAll(req as AuthRequest, 'home')
      res.clearCookie('connect.sid')
      return res.redirect('/login')
    })
  } catch (error) {
    logger.error('Logout error:', parseError(error))
    return res.redirect('/login')
  }
}
