import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { User } from './User.entity'

@Entity('job_schedules')
export class JobSchedule {

  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @ManyToOne(() => User, user => user.job_schedules, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_job_schedules_user' })
  user!: User | null

  @Column({ type: 'varchar', length: 20, default: 'user' })
  scope!: 'user' | 'system'

  @Column({ type: 'varchar', length: 50 })
  job_type!: string

  @Column({ type: 'varchar', length: 50 })
  entity_type!: string

  @Column({ type: 'bigint', nullable: true })
  entity_id!: number | null

  @Column({ type: 'varchar', length: 120 })
  name!: string

  @Column({ type: 'varchar', length: 20 })
  recurrence_type!: 'once' | 'daily' | 'weekly' | 'monthly' | 'custom'

  @Column({ type: 'json', nullable: true })
  recurrence_rule!: Record<string, any> | null

  @Column({ type: 'varchar', length: 64, default: 'UTC' })
  timezone!: string

  @Column({ type: 'datetime' })
  start_at!: Date

  @Column({ type: 'datetime' })
  next_run_at!: Date

  @Column({ type: 'datetime', nullable: true })
  last_run_at!: Date | null

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status!: 'active' | 'paused' | 'cancelled' | 'expired'

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date
}
