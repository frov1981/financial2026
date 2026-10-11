import { LOGGER_EVENTS } from './utils/logger-events'
import 'reflect-metadata'
import 'dotenv/config'

import { app } from './app'
import { AppDataSource } from './config/typeorm.datasource'
import { logger } from './utils/logger.util'
import { parseError } from './utils/error.util'
import { JobQueueService } from './services/job-queue.service'

const PORT = process.env.NODE_PORT ? parseInt(process.env.NODE_PORT, 10) : 3000
const server_startup_logger = logger.forMethod('serverStartup', LOGGER_EVENTS.SERVER_STARTUP)

AppDataSource.initialize().then(async () => {
  const ormLimit = process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT, 10) : 2
  const sessionLimit = process.env.DB_SESSION_CONNECTION_LIMIT ? parseInt(process.env.DB_SESSION_CONNECTION_LIMIT, 10) : 1
  const estimatedTotal = ormLimit + sessionLimit

  server_startup_logger.info(`Limites de conexion hacia la base de datos configurados a: ${estimatedTotal}`, { ormLimit, sessionLimit, estimatedTotal })

  // Inicializar la cola de trabajos y validar el job del sistema
  void JobQueueService.migrateLegacyWeeklyBalanceSchedules().then(async migrated_count => {
    if (migrated_count) server_startup_logger.info('Programaciones semanales migradas a la cola', { migrated_count })
    const cancelled_log_jobs = await JobQueueService.cancelLogRetentionJobs()
    if (cancelled_log_jobs.schedules || cancelled_log_jobs.jobs) {
      server_startup_logger.info('Jobs anteriores de retención de logs cancelados', cancelled_log_jobs)
    }
    await Promise.all([
      JobQueueService.ensureDailyAuthCodeCleanupJob(),
    ])
    JobQueueService.startProcessingLoop()
  }).catch(error => {
    server_startup_logger.error('Error inicializando las programaciones de la cola', parseError(error))
  })

  // Inicializar servidor express
  app.listen(PORT, () => { server_startup_logger.info(`Servidor iniciado en el puerto ${PORT}`, { port: PORT }) })
}).catch(error => {
  server_startup_logger.error('Error inicializando servidor', parseError(error))
})
