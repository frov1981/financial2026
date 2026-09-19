import { DateTime } from 'luxon'
import { AppDataSource } from '../config/typeorm.datasource'
import { NotificationDelivery } from '../entities/NotificationDelivery.entity'
import { NotificationSchedule } from '../entities/NotificationSchedule.entity'
import { sendWeeklyBalanceMail } from '../services/send-weekly-balance-mail.service'
import { logger } from '../utils/logger.util'
import { parseError } from '../utils/error.util'

const scheduler_interval_ms = 60 * 1000
let scheduler_running = false

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

  return day_values[local_now.weekday] === schedule.send_day
    && local_now.hour === hour
    && local_now.minute === minute
}

const getPeriodKey = (schedule: NotificationSchedule, now: DateTime): string => {
  const local_now = now.setZone(schedule.timezone || 'UTC')
  return `${schedule.notification_type.key}:${local_now.startOf('week').toISODate()}`
}

const claimDelivery = async (schedule: NotificationSchedule, period_key: string): Promise<NotificationDelivery | null> => {
  const repository = AppDataSource.getRepository(NotificationDelivery)
  const existing_delivery = await repository.findOne({
    where: { schedule: { id: schedule.id }, period_key },
  })

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
    logger.error(`[NOTIFICATIONS] Error procesando ${period_key}`, parseError(error))
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
    logger.error('[NOTIFICATIONS] Error consultando programaciones', parseError(error))
  } finally {
    scheduler_running = false
  }
}

export function startNotificationScheduler(): NodeJS.Timeout {
  const interval = setInterval(() => {
    void processNotificationSchedules()
  }, scheduler_interval_ms)
  void processNotificationSchedules()
  logger.info('[NOTIFICATIONS] Scheduler iniciado; intervalo de 60 segundos')
  return interval
}