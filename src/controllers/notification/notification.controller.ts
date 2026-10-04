import { LOGGER_EVENTS } from '../../utils/logger-events'
import { RequestHandler, Response } from 'express'
import { DateTime } from 'luxon'
import { In } from 'typeorm'
import { AppDataSource } from '../../config/typeorm.datasource'
import { JobSchedule } from '../../entities/JobSchedule.entity'
import { JobQueueService } from '../../services/job-queue.service'
import { AuthRequest } from '../../types/auth-request'
import { parseError } from '../../utils/error.util'
import { logger } from '../../utils/logger.util'

const job_type = 'weekly_balance_email'
const day_names = [
  { value: 1, name: 'monday', label: 'Lunes' },
  { value: 2, name: 'tuesday', label: 'Martes' },
  { value: 3, name: 'wednesday', label: 'Miércoles' },
  { value: 4, name: 'thursday', label: 'Jueves' },
  { value: 5, name: 'friday', label: 'Viernes' },
  { value: 6, name: 'saturday', label: 'Sábado' },
  { value: 7, name: 'sunday', label: 'Domingo' },
]
const schedule_logger = logger.forMethod('weeklyBalanceSchedule', LOGGER_EVENTS.JOB)

const logRequestLifecycle = (res: Response, request_name: string, user_id: number): void => {
  const request_logger = logger.forMethod(request_name, LOGGER_EVENTS.JOB, user_id)
  request_logger.debug('Inicio de ejecución de pantalla')
  res.once('finish', () => {
    request_logger.debug('Fin de ejecución de pantalla', { status_code: res.statusCode })
  })
}

const getSchedule = async (user_id: number) => AppDataSource.getRepository(JobSchedule).findOne({
  where: {
    user: { id: user_id },
    scope: 'user',
    job_type,
    status: In(['active', 'paused']),
  },
  order: { updated_at: 'DESC' },
})

const viewSchedule = (schedule: JobSchedule | null, default_timezone = 'UTC') => {
  const rule = schedule?.recurrence_rule ?? {}
  const weekday = Number(rule.weekday ?? 1)
  const hour = String(Number(rule.hour ?? 8)).padStart(2, '0')
  const minute = String(Number(rule.minute ?? 0)).padStart(2, '0')

  return {
    title: 'Notificar balances semanalmente',
    send_day: day_names.find(day => day.value === weekday)?.name ?? 'monday',
    send_time: `${hour}:${minute}`,
    enabled: schedule?.status === 'active',
    exists: schedule !== null,
    timezone: schedule?.timezone ?? default_timezone,
  }
}

export const routeToNotificationsPage: RequestHandler = async (req, res, next) => {
  const auth_req = req as AuthRequest
  logRequestLifecycle(res, routeToNotificationsPage.name, auth_req.user.id)
  try {
    const schedule = await getSchedule(auth_req.user.id)
    res.render('layouts/main', {
      title: 'Programación semanal',
      view: 'pages/notifications/index',
      USER_ID: auth_req.user.id,
      notification: viewSchedule(schedule, auth_req.timezone),
      days: day_names,
    })
  } catch (error) {
    logger.forMethod(routeToNotificationsPage.name, LOGGER_EVENTS.JOB, auth_req.user.id)
      .error('Error cargando pantalla de programación semanal', parseError(error))
    next(error)
  }
}

export const routeToNotificationScheduleForm: RequestHandler = async (req, res, next) => {
  const auth_req = req as AuthRequest
  logRequestLifecycle(res, routeToNotificationScheduleForm.name, auth_req.user.id)
  try {
    const schedule = await getSchedule(auth_req.user.id)
    res.render('layouts/main', {
      title: 'Programar balances',
      view: 'pages/notifications/form',
      USER_ID: auth_req.user.id,
      notification: viewSchedule(schedule, auth_req.timezone),
      days: day_names,
      errors: {},
    })
  } catch (error) {
    logger.forMethod(routeToNotificationScheduleForm.name, LOGGER_EVENTS.JOB, auth_req.user.id)
      .error('Error cargando formulario de programación semanal', parseError(error))
    next(error)
  }
}

export const apiForSavingNotificationSchedule: RequestHandler = async (req, res, next) => {
  const auth_req = req as AuthRequest
  logRequestLifecycle(res, apiForSavingNotificationSchedule.name, auth_req.user.id)
  try {
    const schedule = await getSchedule(auth_req.user.id)
    const send_day = Number(req.body.send_day)
    const send_time = String(req.body.send_time || '')
    const [hour, minute] = send_time.split(':').map(Number)
    const requested_timezone = String(req.body.timezone || auth_req.timezone || schedule?.timezone || 'UTC')
    const timezone = DateTime.now().setZone(requested_timezone).isValid ? requested_timezone : 'UTC'
    const mode = String(req.body.mode || '')
    const valid_mode = ['save', 'enable', 'disable'].includes(mode)

    if (!day_names.some(day => day.value === send_day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(send_time) || !valid_mode) {
      return res.status(400).render('layouts/main', {
        title: 'Programar balances',
        view: 'pages/notifications/form',
        USER_ID: auth_req.user.id,
        notification: { ...viewSchedule(schedule), send_day: String(send_day), send_time, timezone },
        days: day_names,
        errors: { schedule: 'Selecciona un día y una hora válidos' },
      })
    }

    const enabled = mode === 'enable' || (mode === 'save' && schedule?.status === 'active')
    const updated_schedule = await JobQueueService.configureWeeklyBalanceSchedule(auth_req.user.id, {
      weekday: send_day,
      hour,
      minute,
      timezone,
      enabled,
    })

    const action = mode === 'enable' ? 'habilitada' : mode === 'disable' ? 'deshabilitada' : 'ajustada'
    schedule_logger.info(`Programación semanal de balances ${action}`, {
      user_id: auth_req.user.id,
      schedule_id: updated_schedule?.id ?? schedule?.id ?? null,
      weekday: send_day,
      hour,
      minute,
      timezone,
      enabled,
      next_run_at: updated_schedule?.next_run_at?.toISOString() ?? null,
    })

    res.redirect('/notifications')
  } catch (error) {
    logger.forMethod(apiForSavingNotificationSchedule.name, LOGGER_EVENTS.JOB, auth_req.user.id)
      .error('Error actualizando la programación semanal de balances', parseError(error))
    next(error)
  }
}