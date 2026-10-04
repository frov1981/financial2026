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
  await AppDataSource.query(
    `CREATE TABLE IF NOT EXISTS device_preferences (
      id BIGINT NOT NULL AUTO_INCREMENT,
      user_id INT NOT NULL,
      device_id VARCHAR(36) NOT NULL,
      state JSON NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_device_preferences_user_device (user_id, device_id),
      CONSTRAINT fk_device_preferences_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,
  )
  server_startup_logger.info('Tabla de preferencias por dispositivo verificada')

  const ormLimit = process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT, 10) : 3
  const sessionLimit = process.env.DB_SESSION_CONNECTION_LIMIT ? parseInt(process.env.DB_SESSION_CONNECTION_LIMIT, 10) : 1
  const estimatedTotal = ormLimit + sessionLimit

  server_startup_logger.info('Limites de conexion configurado', { ormLimit, sessionLimit, estimatedTotal })

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
  app.listen(PORT, () => { server_startup_logger.info('Sevidor iniciado', { port: PORT }) })
}).catch(error => {
  server_startup_logger.error('Error inicializando servidor', parseError(error))
})
