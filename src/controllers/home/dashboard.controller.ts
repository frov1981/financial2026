import { Request, RequestHandler, Response } from 'express'
import { AuthRequest } from '../../types/AuthRequest'
import { getGlobalKPIs, getLastSixMonthsChartData, getLastSixMonthsKPIs } from './dashboard.controller.auxiliar'

export const listLastSixMonthsKPIsAPI: RequestHandler = async (
    req: Request, res: Response
) => {
    const authReq = req as AuthRequest
    const userId = authReq.user.id

    try {
        const lastSixMonthsChartData = await getLastSixMonthsChartData(authReq)
        const kpis = await getLastSixMonthsKPIs(authReq)
        const globalKpis = await getGlobalKPIs(authReq)
        res.json({ lastSixMonthsChartData, kpis, globalKpis })

    } catch (error) {
        console.log(error)
        res.json({ message: 'Error' })
    }

}
