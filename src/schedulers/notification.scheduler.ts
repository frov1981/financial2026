import { DateTime } from 'luxon'
import { AppDataSource } from '../config/typeorm.datasource'
import { NotificationDelivery } from '../entities/NotificationDelivery.entity'
import { NotificationSchedule } from '../entities/NotificationSchedule.entity'
import { sendWeeklyBalanceMail } from '../services/send-weekly-balance-mail.service'
import { logger } from '../utils/logger.util'
import { parseError } from '../utils/error.util'
import { LogEvent } from '../entities/LogEvent.entity'

const hour_in_ms = 60 * 60 * 1000
const notification_interval_in_hours = process.env.SCHEDULER_SEND_NOTIFICATIONS_INTERVAL_IN_HOURS
  ? parseInt(process.env.SCHEDULER_SEND_NOTIFICATIONS_INTERVAL_IN_HOURS, 10)
  : 1
const notification_interval_ms = notification_interval_in_hours * hour_in_ms
const scheduler_timezone = process.env.SCHEDULER_TIMEZONE || 'America/Guayaquil'
const log_retention_at = process.env.SCHEDULER_DELETE_LOGS_AT || '01:00'
const [log_retention_hour, log_retention_minute] = log_retention_at.split(':').map(Number)

let scheduler_running = false
let log_retention_running = false
let last_log_retention_day: string | null = null
let last_notification_check_at: Date | null = null
let log_retention_timer: NodeJS.Timeout | null = null

const process_schedule_logger = logger.forMethod('processSchedule', 'SCHEDULER_WEEKLY_NOTIFICATION')
const notification_scheduler_logger = logger.forMethod('processNotificationSchedules', 'SCHEDULER_WEEKLY_NOTIFICATION')
const log_retention_logger = logger.forMethod('processLogRetention', 'SCHEDULER_LOG_RETENTION')
const scheduler_start_logger = logger.forMethod('startNotificationScheduler', 'SCHEDULER_STARTUP')

const day_values: Record<number, string> = {
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
  7: 'sunday',
}

const isDue = (schedule: NotificationSchedule, checked_after: Date, now: DateTime): boolean => {
  const timezone = schedule.timezone || 'UTC'
  const local_checked_after = DateTime.fromJSDate(checked_after).setZone(timezone)
  const local_now = now.setZone(timezone)
  const [hour, minute] = schedule.send_time.slice(0, 5).split(':').map(Number)
  let scheduled_day = local_checked_after.startOf('day')
  const last_day = local_now.startOf('day')

  while (scheduled_day.toMillis() <= last_day.toMillis()) {
    if (day_values[scheduled_day.weekday] === schedule.send_day) {
      const scheduled_at = scheduled_day.set({ hour, minute, second: 0, millisecond: 0 })
      if (scheduled_at.toMillis() > local_checked_after.toMillis() && scheduled_at.toMillis() <= local_now.toMillis()) return true
    }
    scheduled_day = scheduled_day.plus({ days: 1 })
  }

  return false
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

const processSchedule = async (schedule: NotificationSchedule, checked_after: Date, now: DateTime): Promise<void> => {
  const period_key = getPeriodKey(schedule, now)
  const existing_delivery = await AppDataSource.getRepository(NotificationDelivery).findOne({
    where: { schedule: { id: schedule.id }, period_key },
  })

  if (!isDue(schedule, checked_after, now) && existing_delivery?.status !== 'failed') return

  const delivery = await claimDelivery(schedule, period_key)
  if (!delivery) return

  const repository = AppDataSource.getRepository(NotificationDelivery)
  let delivery_status = 'failed'
  process_schedule_logger.info('Inicio de envío de notificación semanal', {
    period_key,
    schedule_id: schedule.id,
    user_id: schedule.user.id,
  })
  try {
    await sendWeeklyBalanceMail(schedule.user, schedule.timezone)
    delivery.status = 'sent'
    delivery.sent_at = new Date()
    await repository.save(delivery)
    delivery_status = 'sent'
  } catch (error) {
    delivery.status = 'failed'
    delivery.error_message = parseError(error).message
    await repository.save(delivery)
    process_schedule_logger.error(`Error procesando ${period_key}`, parseError(error))
  } finally {
    process_schedule_logger.info('Fin de envío de notificación semanal', {
      period_key,
      schedule_id: schedule.id,
      user_id: schedule.user.id,
      status: delivery_status,
    })
  }
}

export async function processNotificationSchedules(): Promise<void> {
  if (scheduler_running || (last_notification_check_at && Date.now() - last_notification_check_at.getTime() < notification_interval_ms)) return
  scheduler_running = true
  const now = DateTime.utc()
  const checked_after = last_notification_check_at ?? now.minus({ milliseconds: notification_interval_ms }).toJSDate()
  let check_completed = false

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
    await Promise.all(schedules.map(schedule => processSchedule(schedule, checked_after, now)))
    check_completed = true
  } catch (error) {
    notification_scheduler_logger.error('Error consultando programaciones', parseError(error))
  } finally {
    if (check_completed) last_notification_check_at = now.toJSDate()
    scheduler_running = false
  }
}

export async function processLogRetention(): Promise<void> {
  const local_now = DateTime.now().setZone(scheduler_timezone)
  const retention_day = local_now.toISODate()
  if (log_retention_running || !retention_day || retention_day === last_log_retention_day) return
  if (local_now.hour < log_retention_hour || (local_now.hour === log_retention_hour && local_now.minute < log_retention_minute)) return

  log_retention_running = true
  last_log_retention_day = retention_day
  let retention_status = 'completed'
  try {
    log_retention_logger.info('Inicio de retención de logs')
    const repository = AppDataSource.getRepository(LogEvent)
    const retention_days = Number(process.env.LOG_RETENTION_MAX_DAYS || 30)
    const cutoff = DateTime.utc().minus({ days: retention_days }).toJSDate()

    const delete_result = await repository.createQueryBuilder().delete().from(LogEvent)
      .where('occurred_at < :cutoff', { cutoff })
      .execute()
    const deleted_count = delete_result.affected || 0
    if (deleted_count > 0) await repository.query('OPTIMIZE TABLE log_events')

    log_retention_logger.info('Retención de logs completada', {
      retention_days,
      deleted_count,
      cutoff,
    })
  } catch (error) {
    retention_status = 'failed'
    log_retention_logger.error('Error ejecutando retención', parseError(error))
  } finally {
    log_retention_logger.info('Fin de retención de logs', { status: retention_status })
    log_retention_running = false
  }
}

export function startNotificationScheduler(): NodeJS.Timeout {
  const interval = setInterval(() => {
    void processNotificationSchedules()
  }, notification_interval_ms)
  void processNotificationSchedules()
  const scheduleNextLogRetention = () => {
    const now = DateTime.now().setZone(scheduler_timezone)
    let next_run = now.set({ hour: log_retention_hour, minute: log_retention_minute, second: 0, millisecond: 0 })
    if (next_run.toMillis() <= now.toMillis()) next_run = next_run.plus({ days: 1 })

    log_retention_timer = setTimeout(() => {
      void processLogRetention().finally(scheduleNextLogRetention)
    }, Math.max(0, next_run.toMillis() - Date.now()))
  }
  scheduleNextLogRetention()
  scheduler_start_logger.info('Programador iniciado')
  return interval
}