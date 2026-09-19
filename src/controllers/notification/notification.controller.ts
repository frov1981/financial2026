import { RequestHandler } from 'express'
import { AppDataSource } from '../../config/typeorm.datasource'
import { NotificationSchedule } from '../../entities/NotificationSchedule.entity'
import { NotificationType } from '../../entities/NotificationType.entity'
import { AuthRequest } from '../../types/auth-request'

const notification_key = 'weekly_balance'
const default_schedule = { send_day: 'monday', send_time: '08:00', enabled: true }
const days = [
  { value: 'monday', label: 'Lunes' },
  { value: 'tuesday', label: 'Martes' },
  { value: 'wednesday', label: 'Miércoles' },
  { value: 'thursday', label: 'Jueves' },
  { value: 'friday', label: 'Viernes' },
  { value: 'saturday', label: 'Sábado' },
  { value: 'sunday', label: 'Domingo' },
]

const getSchedule = async (user_id: number) => {
  return AppDataSource.getRepository(NotificationSchedule).findOne({
    where: { user: { id: user_id }, notification_type: { key: notification_key } },
    relations: { notification_type: true },
  })
}

const getNotificationType = async () => {
  return AppDataSource.getRepository(NotificationType).findOneBy({ key: notification_key, enabled: true })
}

const viewSchedule = (notification_type: NotificationType, schedule: NotificationSchedule | null) => ({
  notification_key: notification_type.key,
  notification_title: notification_type.name,
  send_day: schedule?.send_day || default_schedule.send_day,
  send_time: schedule?.send_time?.slice(0, 5) || default_schedule.send_time,
  enabled: schedule?.enabled ?? default_schedule.enabled,
})

export const routeToNotificationsPage: RequestHandler = async (req, res) => {
  const auth_req = req as AuthRequest
  const notification_type = await getNotificationType()
  if (!notification_type) return res.status(500).send('Tipo de notificación no configurado')
  const schedule = await getSchedule(auth_req.user.id)
  res.render('layouts/main', {
    title: 'Notificaciones',
    view: 'pages/notifications/index',
    USER_ID: auth_req.user.id,
    notification: viewSchedule(notification_type, schedule),
    days,
  })
}

export const routeToNotificationScheduleForm: RequestHandler = async (req, res) => {
  const auth_req = req as AuthRequest
  const notification_type = await getNotificationType()
  if (!notification_type) return res.status(500).send('Tipo de notificación no configurado')
  const schedule = await getSchedule(auth_req.user.id)
  res.render('layouts/main', {
    title: 'Configurar notificación',
    view: 'pages/notifications/form',
    USER_ID: auth_req.user.id,
    notification: viewSchedule(notification_type, schedule),
    days,
    errors: {},
  })
}

export const apiForSavingNotificationSchedule: RequestHandler = async (req, res) => {
  const auth_req = req as AuthRequest
  const notification_type = await getNotificationType()
  if (!notification_type) return res.status(500).send('Tipo de notificación no configurado')
  const send_day = String(req.body.send_day || '')
  const send_time = String(req.body.send_time || '')
  const timezone = String(req.body.timezone || 'UTC')

  if (!days.some(day => day.value === send_day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(send_time)) {
    return res.status(400).render('layouts/main', {
      title: 'Configurar notificación',
      view: 'pages/notifications/form',
      USER_ID: auth_req.user.id,
      notification: { ...viewSchedule(notification_type, null), send_day, send_time, timezone },
      days,
      errors: { schedule: 'Selecciona un día y una hora válidos' },
    })
  }

  const repository = AppDataSource.getRepository(NotificationSchedule)
  let schedule = await getSchedule(auth_req.user.id)
  if (!schedule) {
    schedule = repository.create({
      user: auth_req.user,
      notification_type,
      send_day,
      send_time,
      timezone,
      enabled: true,
    })
  } else {
    schedule.send_day = send_day
    schedule.send_time = send_time
    schedule.timezone = timezone
  }
  await repository.save(schedule)
  res.redirect('/notifications')
}