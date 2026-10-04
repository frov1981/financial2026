import { Request, RequestHandler, Response } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { User } from '../../entities/User.entity'
import { AuthRequest } from '../../types/auth-request'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'
import { getAvailableYearsKpi, getBalanceKpi, getCashSummary, getChartDataLast6MonthsBalance, getChartDataLast6YearsBalance, getChartDataLast6YearsPayable, getKpisGlobalBalance, getKpisLast6MonthsBalance, getPayableSummary, getTrendKpi, getReceivableSummary, getCategoryKpi, getCategoryKpiDetail, getCategoryGroupKpi, getCategoryGroupKpiDetail } from './home.auxiliar'

export const routeToPageRoot = (req: Request, res: Response) => {
  if ((req.session as any)?.user_id != null) {
    return res.redirect('/home')
  }
  res.redirect('/login')
}

export const routeToPageLogin = (req: Request, res: Response) => {
  res.render('pages/login/form', { error: null })
}

export const routeToPageHome = async (req: Request, res: Response) => {
  const user_id = (req.session as any)?.user_id
  if (user_id == null) {
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
      view: 'pages/home/index',
      USER_ID: user?.id ?? 'guest',
      user,
    })
}

export const apiForGettingKpis: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const apiForGettingKpis_logger = logger.forMethod(apiForGettingKpis.name, 'HOME_KPIS', auth_req.user.id)
  const started_at = performance.now()
  try {
    const availableYearsKpi = await getAvailableYearsKpi(auth_req)
    const balanceKpi = await getBalanceKpi(auth_req)
    const trendKpi = await getTrendKpi(auth_req)
    res.json({
      availableYearsKpi,
      balanceKpi,
      trendKpi,
    })
  } catch (error) {
      apiForGettingKpis_logger.error('Error en apiForGettingKpis:', parseError(error))
      res.json({ message: 'Error' })
  } finally {
    const ended_at = performance.now()
    const elapsed_ms = ended_at - started_at
    apiForGettingKpis_logger.elapsedTime('Elapsed time', { elapsed_ms })
  }
}

export const apiForGettingCashSummary: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const apiForGettingCashSummary_logger = logger.forMethod(apiForGettingCashSummary.name, 'CASH_SUMMARY', auth_req.user.id)
  const started_at = performance.now()
  try {
    const availableYearsKpi = await getAvailableYearsKpi(auth_req)
    const cashSummary = await getCashSummary(auth_req)
    res.json({
      availableYearsKpi,
      cashSummary,
    })
  } catch (error) {
      apiForGettingCashSummary_logger.error('Error en apiForGettingCashSummary:', parseError(error))
      res.json({ message: 'Error' })
  } finally {
    const ended_at = performance.now()
    const elapsed_ms = ended_at - started_at
    apiForGettingCashSummary_logger.elapsedTime('Elapsed time', { elapsed_ms })
  }
}

export const apiForGettingPayableSummary: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const apiForGettingPayableSummary_logger = logger.forMethod(apiForGettingPayableSummary.name, 'PAYABLE_SUMMARY', auth_req.user.id)
  const started_at = performance.now()
  try {
    const availableYearsKpi = await getAvailableYearsKpi(auth_req)
    const payableSummary = await getPayableSummary(auth_req)
    res.json({
      availableYearsKpi,
      payableSummary,
    })
  } catch (error) {
      apiForGettingPayableSummary_logger.error('Error en apiForGettingPayableSummary:', parseError(error))
      res.json({ message: 'Error' })
  } finally {
    const ended_at = performance.now()
    const elapsed_ms = ended_at - started_at
    apiForGettingPayableSummary_logger.elapsedTime('Elapsed time', { elapsed_ms })
  }
}

export const apiForGettingReceivableSummary: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const apiForGettingReceivableSummary_logger = logger.forMethod(apiForGettingReceivableSummary.name, 'RECEIVABLE_SUMMARY', auth_req.user.id)
  const started_at = performance.now()
  try {
    const availableYearsKpi = await getAvailableYearsKpi(auth_req)
    const receivableSummary = await getReceivableSummary(auth_req)
    res.json({
      availableYearsKpi,
      receivableSummary,
    })
  } catch (error) {
    apiForGettingReceivableSummary_logger.error('Error en apiForGettingReceivableSummary:', parseError(error))
    res.json({ message: 'Error' })
  } finally {
    const ended_at = performance.now()
    const elapsed_ms = ended_at - started_at
    apiForGettingReceivableSummary_logger.elapsedTime('Elapsed time', { elapsed_ms })
  }
}

export const apiForGettingCategoryKpi: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const apiForGettingCategoryKpi_logger = logger.forMethod(apiForGettingCategoryKpi.name, 'CATEGORY_KPI', auth_req.user.id)
  const started_at = performance.now()
  try {
    const availableYearsKpi = await getAvailableYearsKpi(auth_req)
    const categoryKpi = await getCategoryKpi(auth_req)
    res.json({
      availableYearsKpi,
      categoryKpi,
    })
  } catch (error) {
      apiForGettingCategoryKpi_logger.error('Error en apiForGettingCategoryKpi:', parseError(error))
      res.json({ message: 'Error' })
  } finally {
    const ended_at = performance.now()
    const elapsed_ms = ended_at - started_at
    apiForGettingCategoryKpi_logger.elapsedTime('Elapsed time', { elapsed_ms })
  }
}

export const apiForGettingCategoryKpiDetail: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const apiForGettingCategoryKpiDetail_logger = logger.forMethod(apiForGettingCategoryKpiDetail.name, 'CATEGORY_KPI_DETAIL', auth_req.user.id)
  const started_at = performance.now()
  try {
    const categoryKpiDetail = await getCategoryKpiDetail(auth_req)
    res.json({ categoryKpiDetail })
  } catch (error) {
      apiForGettingCategoryKpiDetail_logger.error('Error en apiForGettingCategoryKpiDetail:', parseError(error))
      res.json({ message: 'Error' })
  } finally {
    const ended_at = performance.now()
    const elapsed_ms = ended_at - started_at
    apiForGettingCategoryKpiDetail_logger.elapsedTime('Elapsed time', { elapsed_ms })
  }
}

export const apiForGettingCategoryGroupKpi: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const apiForGettingCategoryGroupKpi_logger = logger.forMethod(apiForGettingCategoryGroupKpi.name, 'CATEGORY_GROUP_KPI', auth_req.user.id)
  const started_at = performance.now()
  try {
    const categoryGroupKpi = await getCategoryGroupKpi(auth_req)
    res.json({ categoryGroupKpi })
  } catch (error) {
      apiForGettingCategoryGroupKpi_logger.error('Error en apiForGettingCategoryGroupKpi:', parseError(error))
      res.json({ message: 'Error' })
  } finally {
    const ended_at = performance.now()
    const elapsed_ms = ended_at - started_at
    apiForGettingCategoryGroupKpi_logger.elapsedTime('Elapsed time', { elapsed_ms })
  }
}

export const apiForGettingCategoryGroupKpiDetail: RequestHandler = async (req: Request, res: Response) => {
  const auth_req = req as AuthRequest
  const apiForGettingCategoryGroupKpiDetail_logger = logger.forMethod(apiForGettingCategoryGroupKpiDetail.name, 'CATEGORY_GROUP_KPI_DETAIL', auth_req.user.id)
  const started_at = performance.now()
  try {
    const categoryGroupKpiDetail = await getCategoryGroupKpiDetail(auth_req)
    res.json({ categoryGroupKpiDetail })
  } catch (error) {
      apiForGettingCategoryGroupKpiDetail_logger.error('Error en apiForGettingCategoryGroupKpiDetail:', parseError(error))
      res.json({ message: 'Error' })
  } finally {
    const ended_at = performance.now()
    const elapsed_ms = ended_at - started_at
    apiForGettingCategoryGroupKpiDetail_logger.elapsedTime('Elapsed time', { elapsed_ms })
  }
}
