import 'reflect-metadata'
import 'dotenv/config'

import { app } from './app'
import { AppDataSource } from './config/typeorm.datasource'
import { logger } from './utils/logger.util'
import { parseError } from './utils/error.util'
import { startNotificationScheduler } from './schedulers/notification.scheduler'
import { LogEvent } from './entities/LogEvent.entity'

const PORT = process.env.NODE_PORT ? parseInt(process.env.NODE_PORT, 10) : 3000
const server_startup_logger = logger.forMethod('serverStartup', 'SERVER_STARTUP')

AppDataSource.initialize().then(() => {
  logger.setDatabaseSink(async events => {
    await AppDataSource.getRepository(LogEvent).insert(events.map(event => ({
      occurred_at: event.occurred_at,
      level: event.level,
      service: event.service,
      event_name: event.event_name,
      method_name: event.method_name,
      ex_event_type: event.ex_event_type,
      user_id: event.user_id,
      message: event.message,
      context: event.context as any,
    })))
  })

  const ormLimit = process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT, 10) : 3
  const sessionLimit = process.env.SESSION_DB_CONNECTION_LIMIT ? parseInt(process.env.SESSION_DB_CONNECTION_LIMIT, 10) : 1
  server_startup_logger.info('Configured connection limits', { ormLimit, sessionLimit, estimatedTotal: ormLimit + sessionLimit })
  startNotificationScheduler()

  app.listen(PORT, () => {
    server_startup_logger.info('Server started on port', { port: PORT })
  })
}).catch(error => {
  server_startup_logger.error('Error initializing backend', parseError(error))
})
