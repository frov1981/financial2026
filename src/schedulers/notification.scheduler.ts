import { DateTime } from 'luxon'
import { AppDataSource } from '../config/typeorm.datasource'
import { NotificationDelivery } from '../entities/NotificationDelivery.entity'
import { NotificationSchedule } from '../entities/NotificationSchedule.entity'
import { sendWeeklyBalanceMail } from '../services/send-weekly-balance-mail.service'
import { logger } from '../utils/logger.util'
import { parseError } from '../utils/error.util'
import { LogEvent } from '../entities/LogEvent.entity'

const scheduler_interval = process.env.SCHEDULER_INTERVAL_IN_SECONDS ? parseInt(process.env.SCHEDULER_INTERVAL_IN_SECONDS, 10) : 60
const scheduler_interval_ms = scheduler_interval * 1000

let scheduler_running = false
let log_retention_running = false
let last_log_retention_at = 0

const process_schedule_logger = logger.forMethod('processSchedule', 'NOTIFICATION_PROCESS')
const notification_scheduler_logger = logger.forMethod('processNotificationSchedules', 'NOTIFICATION_SCHEDULES')
const log_retention_logger = logger.forMethod('processLogRetention', 'LOG_PURGE')
const scheduler_start_logger = logger.forMethod('startNotificationScheduler', 'NOTIFICATION_SCHEDULER')

const log_retention_interval = process.env.LOG_RETENTION_INTERVAL_IN_DAYS ? parseInt(process.env.LOG_RETENTION_INTERVAL_IN_DAYS, 10) : 1
const log_retention_interval_ms =  log_retention_interval * 24 * 60 * 60 * 1000

const day_values: Record<number, string> = {
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
  7: 'sunday',
}

const isDue = (schedule: NotificationSchedule, now: DateTime): boolean => {
  const local_now = now.setZone(schedule.timezone || 'UTC')
  const [hour, minute] = schedule.send_time.slice(0, 5).split(':').map(Number)
  return day_values[local_now.weekday] === schedule.send_day && local_now.hour === hour && local_now.minute === minute
}

const getPeriodKey = (schedule: NotificationSchedule, now: DateTime): string => {
  const local_now = now.setZone(schedule.timezone || 'UTC')
  return `${schedule.notification_type.key}:${local_now.startOf('week').toISODate()}`
}

const claimDelivery = async (schedule: NotificationSchedule, period_key: string): Promise<NotificationDelivery | null> => {
  const repository = AppDataSource.getRepository(NotificationDelivery)
  const existing_delivery = await repository.findOne({ where: { schedule: { id: schedule.id }, period_key }, })

  if (existing_delivery?.status === 'sent' || existing_delivery?.status === 'processing') return null

  if (existing_delivery) {
    existing_delivery.status = 'processing'
    existing_delivery.error_message = null
    existing_delivery.sent_at = null
    return repository.save(existing_delivery)
  }

  const delivery = repository.create({
    schedule,
    user: schedule.user,
    notification_type: schedule.notification_type,
    period_key,
    status: 'processing',
    sent_at: null,
    error_message: null,
  })

  try {
    return await repository.save(delivery)
  } catch (error: any) {
    if (error?.code === 'ER_DUP_ENTRY') return null
    throw error
  }
}

const processSchedule = async (schedule: NotificationSchedule, now: DateTime): Promise<void> => {
  const period_key = getPeriodKey(schedule, now)
  const existing_delivery = await AppDataSource.getRepository(NotificationDelivery).findOne({
    where: { schedule: { id: schedule.id }, period_key },
  })

  if (!isDue(schedule, now) && existing_delivery?.status !== 'failed') return

  const delivery = await claimDelivery(schedule, period_key)
  if (!delivery) return

  const repository = AppDataSource.getRepository(NotificationDelivery)
  try {
    await sendWeeklyBalanceMail(schedule.user, schedule.timezone)
    delivery.status = 'sent'
    delivery.sent_at = new Date()
    await repository.save(delivery)
  } catch (error) {
    delivery.status = 'failed'
    delivery.error_message = parseError(error).message
    await repository.save(delivery)
    process_schedule_logger.error(`Error procesando ${period_key}`, parseError(error))
  }
}

export async function processNotificationSchedules(): Promise<void> {
  if (scheduler_running) return
  scheduler_running = true

  try {
    const schedules = await AppDataSource.getRepository(NotificationSchedule).find({
      where: {
        enabled: true,
        notification_type: { enabled: true },
      },
      relations: {
        user: true,
        notification_type: true,
      },
    })
    const now = DateTime.utc()
    await Promise.all(schedules.map(schedule => processSchedule(schedule, now)))
  } catch (error) {
    notification_scheduler_logger.error('Error consultando programaciones', parseError(error))
  } finally {
    scheduler_running = false
  }
}

export async function processLogRetention(): Promise<void> {
  if (log_retention_running || Date.now() - last_log_retention_at < log_retention_interval_ms) return
  log_retention_running = true
  try {
    const repository = AppDataSource.getRepository(LogEvent)
    const retention_days = Number(process.env.LOG_RETENTION_MAX_DAYS || 30)
    const max_size_mb = Number(process.env.LOG_RETENTION_MAX_SIZE_IN_MB || 10)
    const max_size_bytes = max_size_mb * 1024 * 1024
    const cutoff = DateTime.utc().minus({ days: retention_days }).toJSDate()

    const getTableSize = async (): Promise<number> => {
      const result = await repository.query(`
        SELECT COALESCE(data_length, 0) + COALESCE(index_length, 0) AS size_bytes
        FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = 'log_events'
      `) as Array<{ size_bytes: number | string }>
      return Number(result[0]?.size_bytes || 0)
    }

    const initial_size_bytes = await getTableSize()
    const oldest_result = await repository.query(
      'SELECT MIN(occurred_at) AS oldest_occurred_at FROM log_events'
    ) as Array<{ oldest_occurred_at: Date | string | null }>
    const oldest_occurred_at = oldest_result[0]?.oldest_occurred_at
      ? new Date(oldest_result[0].oldest_occurred_at)
      : null
    const purge_by_age = oldest_occurred_at !== null && oldest_occurred_at < cutoff
    const purge_by_size = initial_size_bytes >= max_size_bytes

    let deleted_by_age = 0
    if (purge_by_age || purge_by_size) {
      const delete_result = await repository.createQueryBuilder().delete().from(LogEvent)
        .where('occurred_at < :cutoff', { cutoff })
        .execute()
      deleted_by_age = delete_result.affected || 0
      if (deleted_by_age > 0) await repository.query('OPTIMIZE TABLE log_events')
    }

    const final_size_bytes = await getTableSize()

    last_log_retention_at = Date.now()
    if (purge_by_age || purge_by_size) {
      log_retention_logger.info('Logs purgados con exito', {
        purge_reason: purge_by_age && purge_by_size ? 'AGE_AND_SIZE' : purge_by_age ? 'AGE' : 'SIZE',
        retention_days,
        max_size_mb,
        initial_size_mb: Number((initial_size_bytes / 1024 / 1024).toFixed(4)),
        deleted_by_age,
        final_size_mb: Number((final_size_bytes / 1024 / 1024).toFixed(4)),
        oldest_occurred_at,
      })
    }
  } catch (error) {
    log_retention_logger.error('Error ejecutando retención', parseError(error))
  } finally {
    log_retention_running = false
  }
}

export function startNotificationScheduler(): NodeJS.Timeout {
  const interval = setInterval(() => {
    void processNotificationSchedules()
  }, scheduler_interval_ms)
  void processNotificationSchedules()
  void processLogRetention()
  scheduler_start_logger.info('Programador iniciado')
  return interval
}