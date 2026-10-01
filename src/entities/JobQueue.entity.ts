import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { JobSchedule } from './JobSchedule.entity'

@Entity('job_queue')
@Index('idx_job_queue_status_scheduled_at', ['status', 'scheduled_at'])
export class JobQueue {

  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @ManyToOne(() => JobSchedule, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'schedule_id', foreignKeyConstraintName: 'fk_job_queue_schedule' })
  schedule!: JobSchedule | null

  @Column({ type: 'varchar', length: 20, default: 'user' })
  scope!: 'user' | 'system'

  @Column({ type: 'varchar', length: 50 })
  job_type!: string

  @Column({ type: 'varchar', length: 50 })
  entity_type!: string

  @Column({ type: 'bigint', nullable: true })
  entity_id!: number | null

  @Column({ type: 'json' })
  payload!: Record<string, any>

  @Column({ type: 'varchar', length: 20, default: 'scheduled' })
  status!: 'scheduled' | 'queued' | 'dispatching' | 'succeeded' | 'failed' | 'expired' | 'cancelled'

  @Column({ type: 'datetime' })
  scheduled_at!: Date

  @Column({ type: 'datetime', nullable: true })
  queued_at!: Date | null

  @Column({ type: 'datetime', nullable: true })
  started_at!: Date | null

  @Column({ type: 'datetime', nullable: true })
  finished_at!: Date | null

  @Column({ type: 'int', default: 0 })
  attempts!: number

  @Column({ type: 'datetime', nullable: true })
  next_run_at!: Date | null

  @Column({ type: 'text', nullable: true })
  error_message!: string | null

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date
}
