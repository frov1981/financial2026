import { DateTime } from 'luxon'
import { AppDataSource } from '../config/typeorm.datasource'
import { AuthCode } from '../entities/AuthCode.entity'
import { JobQueue } from '../entities/JobQueue.entity'
import { LogEvent } from '../entities/LogEvent.entity'
import { sendWeeklyBalanceMail } from './send-weekly-balance-mail.service'
import { parseError } from '../utils/error.util'
import { logger } from '../utils/logger.util'

const job_dispatcher_logger = logger.forMethod('dispatchJob', 'JOB_DISPATCHER')

type JobHandler = (job: JobQueue) => Promise<void>

const executeLogRetentionJob = async (job: JobQueue): Promise<void> => {
  const repository = AppDataSource.getRepository(LogEvent)
  const retention_days = Number(job.payload?.retention_days ?? process.env.LOG_RETENTION_MAX_DAYS ?? 30)
  const cutoff = DateTime.utc().minus({ days: retention_days }).toJSDate()

  job_dispatcher_logger.debug('Inicio de limpieza de logs desde la cola', {
    job_id: job.id,
    retention_days,
    cutoff,
    table: 'log_events',
  })

  let deleted_count: number | null = null
  let status: 'succeeded' | 'failed' = 'failed'
  try {
    const delete_result = await repository.createQueryBuilder().delete().from(LogEvent)
      .where('occurred_at < :cutoff', { cutoff })
      .execute()

    deleted_count = Number(delete_result.affected ?? 0)
    await repository.query('OPTIMIZE TABLE log_events')
    status = 'succeeded'
  } finally {
    job_dispatcher_logger.info('Limpieza de logs finalizada', {
      job_id: job.id,
      table: 'log_events',
      deleted_count,
      retention_days,
      cutoff,
      from: new Date(cutoff).toISOString(),
      status,
    })

    job_dispatcher_logger.debug('Fin de limpieza de logs desde la cola', {
      job_id: job.id,
      deleted_count,
      table: 'log_events',
      status,
    })
  }
}

const executeAuthCodeCleanupJob = async (job: JobQueue): Promise<void> => {
  const repository = AppDataSource.getRepository(AuthCode)
  const cutoff = new Date()

  job_dispatcher_logger.debug('Inicio de limpieza de códigos de autenticación desde la cola', {
    job_id: job.id,
    cutoff,
    table: 'auth_codes',
  })

  let deleted_count: number | null = null
  let status: 'succeeded' | 'failed' = 'failed'
  try {
    const delete_result = await repository.createQueryBuilder().delete().from(AuthCode)
      .where('expires_at < :cutoff', { cutoff })
      .execute()

    deleted_count = Number(delete_result.affected ?? 0)
    await repository.query('OPTIMIZE TABLE auth_codes')
    status = 'succeeded'
  } finally {
    job_dispatcher_logger.info('Limpieza de códigos de autenticación finalizada', {
      job_id: job.id,
      table: 'auth_codes',
      deleted_count,
      cutoff,
      from: cutoff.toISOString(),
      status,
    })

    job_dispatcher_logger.debug('Fin de limpieza de códigos de autenticación desde la cola', {
      job_id: job.id,
      deleted_count,
      table: 'auth_codes',
      status,
    })
  }
}

const executeWeeklyBalanceEmailJob = async (job: JobQueue): Promise<void> => {
  const user = job.schedule?.user
  const weekly_balance_logger = logger.forMethod('executeWeeklyBalanceEmailJob', 'WEEKLY_BALANCE_SCHEDULER', user?.id ?? null)
  const context = {
    job_id: job.id,
    schedule_id: job.schedule?.id ?? null,
    user_id: user?.id ?? job.payload?.user_id ?? null,
    timezone: job.schedule?.timezone ?? 'UTC',
  }

  weekly_balance_logger.debug('Inicio de ejecución de notificación semanal', context)
  let status: 'succeeded' | 'failed' = 'failed'
  try {
    if (!user) throw new Error('Falta el usuario para enviar el resumen semanal de balances')

    await sendWeeklyBalanceMail(user, job.schedule?.timezone ?? 'UTC')
    status = 'succeeded'
  } catch (error) {
    weekly_balance_logger.error('Error enviando la notificación semanal de balances', {
      ...context,
      error: parseError(error),
    })
    throw error
  } finally {
    weekly_balance_logger.info('Notificación semanal de balances finalizada', { ...context, status })
    weekly_balance_logger.debug('Fin de ejecución de notificación semanal', { ...context, status })
  }
}

const executeTransactionJob = async (job: JobQueue): Promise<void> => {
  job_dispatcher_logger.debug('Transacción programada despachada desde la cola', {
    job_id: job.id,
    entity_type: job.entity_type,
    entity_id: job.entity_id,
  })
}

const handlers: Record<string, JobHandler> = {
  log_retention: executeLogRetentionJob,
  auth_code_cleanup: executeAuthCodeCleanupJob,
  weekly_balance_email: executeWeeklyBalanceEmailJob,
  transaction: executeTransactionJob,
}

export async function dispatchJob(job: JobQueue): Promise<void> {
  const handler = handlers[job.job_type]
  if (!handler) {
    throw new Error(`No existe handler para el job_type: ${job.job_type}`)
  }

  try {
    await handler(job)
  } catch (error) {
    job_dispatcher_logger.error('Error ejecutando job desde la cola', {
      job_id: job.id,
      job_type: job.job_type,
      error: parseError(error),
    })
    throw error
  }
}
