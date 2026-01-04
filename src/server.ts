import 'reflect-metadata'
import 'dotenv/config'

import { app } from './app'
import { AppDataSource } from './config/datasource'
import { logger } from './utils/logger.util'

const PORT = process.env.NODE_PORT ? parseInt(process.env.NODE_PORT, 10) : 3000

AppDataSource.initialize().then(() => {
  app.listen(PORT, () => {
    logger.info('Server started on port', { port: PORT })
  })
}).catch(error => {
  logger.error('Error initializing backend', { error })
})
