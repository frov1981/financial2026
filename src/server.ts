import 'reflect-metadata'
import 'dotenv/config'

import { app } from './app'
import { AppDataSource } from './config/typeorm.datasource'
import { logger } from './utils/logger.util'
import { parseError } from './utils/error.util'
import { LogEvent } from './entities/LogEvent.entity'
import { JobQueueService } from './services/job-queue.service'

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
      user_id: event.user_id,
      message: event.message,
      context: event.context as any,
    })))
  })

  const ormLimit = process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT, 10) : 3
  const sessionLimit = process.env.DB_SESSION_CONNECTION_LIMIT ? parseInt(process.env.DB_SESSION_CONNECTION_LIMIT, 10) : 1
  const estimatedTotal = ormLimit + sessionLimit

  server_startup_logger.info('Limites de conexion configurado', { ormLimit, sessionLimit, estimatedTotal })

  // Inicializar la cola de trabajos y validar el job del sistema
  void JobQueueService.migrateLegacyWeeklyBalanceSchedules().then(async migrated_count => {
    if (migrated_count) server_startup_logger.info('Programaciones semanales migradas a la cola', { migrated_count })
    await Promise.all([
      JobQueueService.ensureDailyLogRetentionJob(),
      JobQueueService.ensureDailyAuthCodeCleanupJob(),
    ])
    JobQueueService.startProcessingLoop(30_000)
  }).catch(error => {
    server_startup_logger.error('Error inicializando las programaciones de la cola', parseError(error))
  })

  // Inicializar servidor express
  app.listen(PORT, () => { server_startup_logger.info('Sevidor iniciado', { port: PORT }) })
}).catch(error => {
  server_startup_logger.error('Error inicializando servidor', parseError(error))
})
