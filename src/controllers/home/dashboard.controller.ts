import { Request, RequestHandler, Response } from 'express'
import { AuthRequest } from '../../types/AuthRequest'
import { getLastSixMonthsChartData, getLastSixMonthsKPIs } from './dashboard.controller.auxiliar'

export const listLastSixMonthsKPIsAPI: RequestHandler = async (
    req: Request, res: Response
) => {
    const authReq = req as AuthRequest
    const userId = authReq.user.id

    const lastSixMonthsChartData = await getLastSixMonthsChartData(authReq)
    const kpis = await getLastSixMonthsKPIs(authReq)

    res.json({ lastSixMonthsChartData, kpis })
}
