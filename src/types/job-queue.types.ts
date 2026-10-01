import { User } from '../entities/User.entity'

export type JobStatus = 'scheduled' | 'queued' | 'dispatching' | 'succeeded' | 'failed' | 'expired' | 'cancelled'
export type JobScheduleStatus = 'active' | 'paused' | 'cancelled' | 'expired'
export type JobRunStatus = 'dispatching' | 'succeeded' | 'failed' | 'expired'
export type JobRecurrenceType = 'once' | 'daily' | 'weekly' | 'monthly' | 'custom'
export type JobScope = 'user' | 'system'

export interface CreateJobScheduleInput {
  user?: User | null
  scope?: JobScope
  job_type: string
  entity_type: string
  entity_id?: number | null
  name: string
  recurrence_type: JobRecurrenceType
  recurrence_rule?: Record<string, any> | null
  timezone?: string
  start_at?: Date
  next_run_at?: Date
}

export interface EnqueueSummary {
  enqueued: number
  dispatched: unknown | null
}
