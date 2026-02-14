import { Request, Response, NextFunction, RequestHandler } from 'express'
import { logger } from '../utils/logger.util'

const mustLogger = process.env.NODE_LOG_REQUESTS === 'true'

export const httpLogger: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now()
  if (!mustLogger) return next()
  logger.debug(`${req.method} ${req.originalUrl}`, { headers: req.headers, query: req.query, body: req.body })

  res.on('finish', () => {
    const duration = Date.now() - start
    logger.debug(`${req.method} ${req.originalUrl} - Status: ${res.statusCode} - ${duration}ms`)
  })

  res.on('close', () => {
    const duration = Date.now() - start
    logger.debug(`${req.method} ${req.originalUrl} - Connection closed - ${duration}ms`)
  })

  next()
}