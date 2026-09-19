import { Request, Response, NextFunction, RequestHandler } from 'express'
import { logger } from '../utils/logger.util'

const mustLogger = process.env.NODE_LOG_REQUESTS === 'true'

export const httpLogger: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const httpLogger_logger = logger.forMethod(httpLogger.name, 'HTTP_REQUEST')
  const start = Date.now()
  if (!mustLogger) return next()
  httpLogger_logger.debug(`${req.method} ${req.originalUrl}`, { headers: req.headers, query: req.query, body: req.body })

  res.on('finish', () => {
    const duration = Date.now() - start
    httpLogger_logger.debug(`${req.method} ${req.originalUrl} - Status: ${res.statusCode} - ${duration}ms`)
  })

  res.on('close', () => {
    const duration = Date.now() - start
    httpLogger_logger.debug(`${req.method} ${req.originalUrl} - Connection closed - ${duration}ms`)
  })

  next()
}