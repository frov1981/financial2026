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
    JobQueueService.startProcessingLoop()
  }).catch(error => {
    server_startup_logger.error('Error inicializando las programaciones de la cola', parseError(error))
  })

  // Inicializar servidor express
  app.listen(PORT, () => { server_startup_logger.info('Sevidor iniciado', { port: PORT }) })
}).catch(error => {
  server_startup_logger.error('Error inicializando servidor', parseError(error))
})
