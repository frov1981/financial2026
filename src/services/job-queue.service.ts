import { In, LessThanOrEqual, Repository } from 'typeorm'
import { DateTime } from 'luxon'
import { AppDataSource } from '../config/typeorm.datasource'
import { JobQueue } from '../entities/JobQueue.entity'
import { JobRun } from '../entities/JobRun.entity'
import { JobSchedule } from '../entities/JobSchedule.entity'
import { User } from '../entities/User.entity'
import { logger } from '../utils/logger.util'
import { CreateJobScheduleInput, JobScope, JobStatus } from '../types/job-queue.types'
import { dispatchJob } from './job-dispatcher.service'

export class JobQueueService {
  private static readonly logger = logger.forMethod('JobQueueService', 'JOB_QUEUE_SERVICE')

  static async createSchedule(input: CreateJobScheduleInput): Promise<JobSchedule> {
    const schedule = AppDataSource.getRepository(JobSchedule).create({
      user: input.user ?? null,
      scope: input.scope ?? 'user',
      job_type: input.job_type,
      entity_type: input.entity_type,
      entity_id: input.entity_id ?? null,
      name: input.name,
      recurrence_type: input.recurrence_type,
      recurrence_rule: input.recurrence_rule ?? null,
      timezone: input.timezone ?? 'UTC',
      start_at: input.start_at ?? new Date(),
      next_run_at: input.next_run_at ?? (input.start_at ?? new Date()),
      last_run_at: null,
      status: 'active',
    })

    return AppDataSource.getRepository(JobSchedule).save(schedule)
  }

  static getNextDailyRunAt(now: Date, hour = 1, minute = 0, timezone = 'UTC'): Date {
    const local_now = DateTime.fromJSDate(now).setZone(timezone)
    let next_run = local_now.set({ hour, minute, second: 0, millisecond: 0 })

    if (next_run.toMillis() <= local_now.toMillis()) {
      next_run = next_run.plus({ days: 1 })
    }

    return next_run.toUTC().toJSDate()
  }

  static getNextWeeklyRunAt(now: Date, weekday: number, hour: number, minute: number, timezone = 'UTC'): Date {
    const local_now = DateTime.fromJSDate(now).setZone(timezone)
    let days_ahead = (weekday - local_now.weekday + 7) % 7
    let next_run = local_now.startOf('day').plus({ days: days_ahead }).set({ hour, minute, second: 0, millisecond: 0 })

    if (next_run.toMillis() <= local_now.toMillis()) {
      days_ahead = 7
      next_run = next_run.plus({ days: days_ahead })
    }

    return next_run.toUTC().toJSDate()
  }

  static async configureWeeklyBalanceSchedule(
    user_id: number,
    settings: { weekday: number, hour: number, minute: number, timezone: string, enabled: boolean },
  ): Promise<JobSchedule | null> {
    return AppDataSource.transaction(async manager => {
      const schedule_repository = manager.getRepository(JobSchedule)
      const queue_repository = manager.getRepository(JobQueue)
      let schedule = await schedule_repository.findOne({
        where: {
          user: { id: user_id },
          scope: 'user',
          job_type: 'weekly_balance_email',
          status: In(['active', 'paused']),
        },
        order: { updated_at: 'DESC' },
      })

      if (!schedule && !settings.enabled) return null

      const now = new Date()
      const next_run_at = this.getNextWeeklyRunAt(now, settings.weekday, settings.hour, settings.minute, settings.timezone)

      if (schedule) {
        const pending_jobs = await queue_repository.find({
          where: {
            schedule: { id: schedule.id },
            status: In(['scheduled', 'queued']),
          },
        })
        for (const pending_job of pending_jobs) {
          pending_job.status = 'cancelled'
          pending_job.finished_at = now
          pending_job.error_message = 'Programación modificada por el usuario'
        }
        if (pending_jobs.length) await queue_repository.save(pending_jobs)
      } else {
        schedule = schedule_repository.create({
          user: { id: user_id } as User,
          scope: 'user',
          job_type: 'weekly_balance_email',
          entity_type: 'weekly_balance',
          entity_id: null,
          name: 'Resumen semanal de balances',
          recurrence_type: 'weekly',
          recurrence_rule: {},
          timezone: settings.timezone,
          start_at: now,
          next_run_at,
          last_run_at: null,
          status: 'paused',
        })
      }

      schedule.recurrence_type = 'weekly'
      schedule.user = { id: user_id } as User
      schedule.recurrence_rule = {
        weekday: settings.weekday,
        hour: settings.hour,
        minute: settings.minute,
      }
      schedule.timezone = settings.timezone
      schedule.next_run_at = next_run_at
      schedule.status = settings.enabled ? 'active' : 'paused'
      const saved_schedule = await schedule_repository.save(schedule)

      if (settings.enabled) await this.enqueueSchedule(saved_schedule, queue_repository)

      return saved_schedule
    })
  }

  static async migrateLegacyWeeklyBalanceSchedules(): Promise<number> {
    const legacy_tables = await AppDataSource.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name IN ('notification_schedules', 'notification_types')`,
    ) as Array<{ table_name: string }>
    if (legacy_tables.length < 2) return 0

    const legacy_schedules = await AppDataSource.query(
      `SELECT ns.user_id, ns.send_day, ns.send_time, ns.timezone, ns.enabled
       FROM notification_schedules ns
       INNER JOIN notification_types nt ON nt.id = ns.notification_type_id
       WHERE nt.key = ?`,
      ['weekly_balance'],
    ) as Array<{ user_id: number, send_day: string, send_time: string, timezone: string, enabled: number | boolean }>
    const weekday_by_name: Record<string, number> = {
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      sunday: 7,
    }
    let migrated_count = 0

    for (const legacy of legacy_schedules) {
      const schedule_repository = AppDataSource.getRepository(JobSchedule)
      const existing = await schedule_repository.findOne({
        where: {
          user: { id: legacy.user_id },
          job_type: 'weekly_balance_email',
          status: In(['active', 'paused']),
        },
      })
      if (existing) continue

      const weekday = weekday_by_name[legacy.send_day] ?? 1
      const [raw_hour, raw_minute] = String(legacy.send_time).slice(0, 5).split(':').map(Number)
      const hour = Number.isInteger(raw_hour) ? raw_hour : 8
      const minute = Number.isInteger(raw_minute) ? raw_minute : 0
      const configured_timezone = legacy.timezone || 'UTC'
      const timezone = DateTime.now().setZone(configured_timezone).isValid ? configured_timezone : 'UTC'
      const now = new Date()
      const enabled = Number(legacy.enabled) === 1
      const schedule = schedule_repository.create({
        user: { id: legacy.user_id } as User,
        scope: 'user',
        job_type: 'weekly_balance_email',
        entity_type: 'weekly_balance',
        entity_id: null,
        name: 'Resumen semanal de balances',
        recurrence_type: 'weekly',
        recurrence_rule: { weekday, hour, minute },
        timezone,
        start_at: now,
        next_run_at: this.getNextWeeklyRunAt(now, weekday, hour, minute, timezone),
        last_run_at: null,
        status: enabled ? 'active' : 'paused',
      })
      const saved_schedule = await schedule_repository.save(schedule)
      if (enabled) await this.enqueueSchedule(saved_schedule, AppDataSource.getRepository(JobQueue))
      migrated_count += 1
    }

    return migrated_count
  }

  static getAuthCodeCleanupRunTime(timezone = 'UTC'): { hour: number, minute: number } {
    const raw = process.env.JOB_AUTH_CODES_CLEANUP_RUN_AT || '01:00'
    const [hour, minute] = raw.split(':').map(value => Number(value))

    if (Number.isFinite(hour) && Number.isFinite(minute)) {
      return { hour, minute }
    }

    return { hour: 1, minute: 0 }
  }

  static async cancelLogRetentionJobs(): Promise<{ schedules: number, jobs: number }> {
    const now = new Date()
    return AppDataSource.transaction(async manager => {
      const schedule_result = await manager.getRepository(JobSchedule).update(
        { scope: 'system', job_type: 'log_retention', status: In(['active', 'paused']) },
        { status: 'cancelled' },
      )
      const job_result = await manager.getRepository(JobQueue).update(
        { job_type: 'log_retention', status: In(['scheduled', 'queued']) },
        {
          status: 'cancelled',
          finished_at: now,
          error_message: 'Job de retención de logs retirado; los archivos se rotan por Pino.',
        },
      )

      return {
        schedules: schedule_result.affected ?? 0,
        jobs: job_result.affected ?? 0,
      }
    })
  }

  static async ensureDailyAuthCodeCleanupJob(): Promise<JobSchedule | null> {
    const repository = AppDataSource.getRepository(JobSchedule)
    const now = new Date()

    const existing = await repository.findOne({
      where: {
        scope: 'system',
        job_type: 'auth_code_cleanup',
        status: 'active',
      },
      order: { created_at: 'DESC' },
    })

    const run_time = this.getAuthCodeCleanupRunTime(existing?.timezone || 'UTC')

    if (existing) {
      const next_run = this.getNextDailyRunAt(now, run_time.hour, run_time.minute, existing.timezone || 'UTC')
      if (existing.next_run_at.getTime() !== next_run.getTime()) {
        existing.next_run_at = next_run
        await repository.save(existing)
      }
      return existing
    }

    const next_run_at = this.getNextDailyRunAt(now, run_time.hour, run_time.minute, 'UTC')
    const schedule = repository.create({
      user: null,
      scope: 'system' as JobScope,
      job_type: 'auth_code_cleanup',
      entity_type: 'auth_codes',
      entity_id: null,
      name: 'Limpieza diaria de códigos de autenticación',
      recurrence_type: 'daily',
      recurrence_rule: { hour: run_time.hour, minute: run_time.minute, target_table: 'auth_codes' },
      timezone: 'UTC',
      start_at: now,
      next_run_at,
      last_run_at: null,
      status: 'active',
    })

    return repository.save(schedule)
  }

  static calculateNextRunAt(schedule: JobSchedule, from_date = new Date()): Date {
    const base = DateTime.fromJSDate(from_date).setZone(schedule.timezone || 'UTC')

    switch (schedule.recurrence_type) {
      case 'once':
        return new Date(schedule.next_run_at)
      case 'daily':
        return base.plus({ days: 1 }).toJSDate()
      case 'weekly':
        return this.getNextWeeklyRunAt(
          from_date,
          Number(schedule.recurrence_rule?.weekday ?? base.weekday),
          Number(schedule.recurrence_rule?.hour ?? base.hour),
          Number(schedule.recurrence_rule?.minute ?? base.minute),
          schedule.timezone || 'UTC',
        )
      case 'monthly': {
        const rule = schedule.recurrence_rule ?? {}
        const next_month = base.startOf('month').plus({ months: 1 })
        const requested_day = Number(rule.day_of_month ?? base.day ?? 1)
        const max_day = next_month.daysInMonth ?? 28
        const safe_requested_day = Number.isFinite(requested_day) ? requested_day : max_day
        const final_day = Math.min(safe_requested_day, max_day)

        return next_month.set({
          day: final_day,
          hour: base.hour,
          minute: base.minute,
          second: 0,
          millisecond: 0,
        }).toJSDate()
      }
      case 'custom':
        if (schedule.recurrence_rule?.interval_days) {
          return base.plus({ days: Number(schedule.recurrence_rule.interval_days) }).toJSDate()
        }
        return base.plus({ days: 1 }).toJSDate()
      default:
        return base.plus({ days: 1 }).toJSDate()
    }
  }

  static async updateScheduleNextRun(schedule: JobSchedule, from_date = new Date()): Promise<JobSchedule> {
    const repository = AppDataSource.getRepository(JobSchedule)
    schedule.last_run_at = from_date
    schedule.next_run_at = this.calculateNextRunAt(schedule, from_date)
    return repository.save(schedule)
  }

  static async enqueueDueJobs(now = new Date()): Promise<JobQueue[]> {
    const schedule_repository = AppDataSource.getRepository(JobSchedule)
    const queue_repository = AppDataSource.getRepository(JobQueue)

    const schedules = await schedule_repository.find({
      where: { status: 'active' },
      relations: { user: true },
    })

    const queued_items: JobQueue[] = []

    for (const schedule of schedules) {
      const queued_item = await this.enqueueSchedule(schedule, queue_repository)
      if (queued_item) queued_items.push(queued_item)
    }

    return queued_items
  }

  private static async enqueueSchedule(schedule: JobSchedule, repository: Repository<JobQueue>): Promise<JobQueue | null> {
    const existing = await repository.findOne({
      where: {
        schedule: { id: schedule.id },
        scheduled_at: schedule.next_run_at,
        status: In(['scheduled', 'queued', 'dispatching']),
      },
    })
    if (existing) return null

    const queue_item = repository.create({
      schedule,
      scope: schedule.scope,
      job_type: schedule.job_type,
      entity_type: schedule.entity_type,
      entity_id: schedule.entity_id,
      payload: {
        schedule_id: schedule.id,
        user_id: schedule.user?.id ?? null,
        entity_type: schedule.entity_type,
        entity_id: schedule.entity_id,
        name: schedule.name,
        recurrence_type: schedule.recurrence_type,
        scope: schedule.scope,
        timezone: schedule.timezone,
      },
      status: 'scheduled',
      scheduled_at: schedule.next_run_at,
      queued_at: null,
      started_at: null,
      finished_at: null,
      attempts: 0,
      next_run_at: null,
      error_message: null,
    })

    return repository.save(queue_item)
  }

  static async dispatchNextAvailableJob(now = new Date()): Promise<JobQueue | null> {
    const repository = AppDataSource.getRepository(JobQueue)

    const due_job = await repository.findOne({
      where: {
        status: In(['scheduled', 'queued']),
        scheduled_at: LessThanOrEqual(now),
      },
      order: { scheduled_at: 'ASC' },
      relations: { schedule: { user: true } },
    })

    if (!due_job) return null

    due_job.status = 'dispatching'
    due_job.queued_at = due_job.queued_at ?? new Date()
    due_job.started_at = new Date()
    due_job.attempts += 1

    const saved = await repository.save(due_job)

    const run_repository = AppDataSource.getRepository(JobRun)
    await run_repository.save(run_repository.create({
      queue: saved,
      schedule: saved.schedule,
      status: 'dispatching',
      started_at: saved.started_at ?? new Date(),
      finished_at: null,
      result_json: null,
      error_message: null,
    }))

    try {
      await dispatchJob(saved)
      await this.completeJob(saved.id, 'succeeded')
    } catch (error: any) {
      await this.completeJob(saved.id, 'failed', error?.message ?? 'Error ejecutando job')
    }

    return saved
  }

  static async completeJob(job_id: number, final_status: JobStatus, error_message?: string): Promise<JobQueue | null> {
    const repository = AppDataSource.getRepository(JobQueue)
    const job = await repository.findOne({
      where: { id: job_id },
      relations: { schedule: true },
    })

    if (!job) return null

    if (final_status === 'succeeded') {
      job.status = 'succeeded'
      job.finished_at = new Date()
      job.error_message = null
      job.next_run_at = null
    } else if (final_status === 'failed') {
      job.status = 'failed'
      job.finished_at = new Date()
      job.error_message = error_message ?? null
      job.next_run_at = null
    } else if (final_status === 'expired') {
      job.status = 'expired'
      job.finished_at = new Date()
      job.error_message = error_message ?? null
      job.next_run_at = null
    } else {
      job.status = 'scheduled'
    }

    const saved_job = await repository.save(job)

    if (job.schedule && final_status === 'succeeded') {
      await this.updateScheduleNextRun(job.schedule)
    }

    const run_repository = AppDataSource.getRepository(JobRun)
    const latest_run = await run_repository.findOne({
      where: { queue: { id: job.id } },
      order: { created_at: 'DESC' },
    })

    if (latest_run) {
      latest_run.status = final_status === 'succeeded' ? 'succeeded' : final_status === 'failed' ? 'failed' : 'expired'
      latest_run.finished_at = new Date()
      latest_run.error_message = error_message ?? null
      latest_run.result_json = { status: final_status, completed_at: new Date().toISOString() }
      await run_repository.save(latest_run)
    }

    return saved_job
  }

  static async expireStaleDispatchingJobs(now = new Date(), timeout_ms = 5 * 60 * 1000): Promise<void> {
    const repository = AppDataSource.getRepository(JobQueue)
    const stale_jobs = await repository.find({
      where: {
        status: 'dispatching',
        started_at: LessThanOrEqual(new Date(now.getTime() - timeout_ms)),
      },
    })

    for (const stale_job of stale_jobs) {
      await this.completeJob(stale_job.id, 'expired', 'El trabajo quedó sin completar dentro del tiempo permitido.')
    }
  }

  static async processQueue(now = new Date()): Promise<{ enqueued: number, dispatched: JobQueue | null }> {
    await this.expireStaleDispatchingJobs(now)
    const enqueued_jobs = await this.enqueueDueJobs(now)
    const dispatched = await this.dispatchNextAvailableJob(now)

    return { enqueued: enqueued_jobs.length, dispatched }
  }

  static startProcessingLoop(
    interval_ms = Number(process.env.JOB_FREQUENCY_RUN ?? 60) * 1000,
  ): NodeJS.Timeout {
    if (!Number.isFinite(interval_ms) || interval_ms <= 0) {
      throw new Error('JOB_FREQUENCY_RUN debe ser un número de segundos mayor que cero')
    }

    const tick = async () => {
      try {
        await this.processQueue(new Date())
      } catch (error) {
        this.logger.error('Error procesando la cola', error)
      }
    }

    void tick()
    return setInterval(() => {
      void tick()
    }, interval_ms)
  }
}
