import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { JobQueue } from './JobQueue.entity'
import { JobSchedule } from './JobSchedule.entity'

@Entity('job_runs')
export class JobRun {

  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @ManyToOne(() => JobQueue, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'queue_id', foreignKeyConstraintName: 'fk_job_runs_queue' })
  queue!: JobQueue

  @ManyToOne(() => JobSchedule, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'schedule_id', foreignKeyConstraintName: 'fk_job_runs_schedule' })
  schedule!: JobSchedule | null

  @Column({ type: 'varchar', length: 20 })
  status!: 'dispatching' | 'succeeded' | 'failed' | 'expired'

  @Column({ type: 'datetime' })
  started_at!: Date

  @Column({ type: 'datetime', nullable: true })
  finished_at!: Date | null

  @Column({ type: 'json', nullable: true })
  result_json!: Record<string, any> | null

  @Column({ type: 'text', nullable: true })
  error_message!: string | null

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date
}
