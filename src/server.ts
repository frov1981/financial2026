import 'reflect-metadata'
import 'dotenv/config'

import { app } from './app'
import { AppDataSource } from './config/typeorm.datasource'
import { logger } from './utils/logger.util'

const PORT = process.env.NODE_PORT ? parseInt(process.env.NODE_PORT, 10) : 3000

AppDataSource.initialize().then(() => {
  const ormLimit = process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT, 10) : 3
  const sessionLimit = process.env.SESSION_DB_CONNECTION_LIMIT ? parseInt(process.env.SESSION_DB_CONNECTION_LIMIT, 10) : 1
  logger.info('Configured connection limits', { ormLimit, sessionLimit, estimatedTotal: ormLimit + sessionLimit })

  app.listen(PORT, () => {
    logger.info('Server started on port', { port: PORT })
  })
}).catch(error => {
  logger.error('Error initializing backend', { error })
})
