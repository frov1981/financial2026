import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('log_events')
@Index('ix_log_events_level_occurred_at', ['level', 'occurred_at'])
@Index('ix_log_events_event_name_occurred_at', ['event_name', 'occurred_at'])
@Index('ix_log_events_method_name_occurred_at', ['method_name', 'occurred_at'])
@Index('ix_log_events_user_id_occurred_at', ['user_id', 'occurred_at'])
export class LogEvent {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id!: string

  @CreateDateColumn({ type: 'timestamp', precision: 3 })
  occurred_at!: Date

  @Column({ type: 'varchar', length: 10 })
  level!: string

  @Column({ type: 'varchar', length: 100, default: 'ssrfinan-api' })
  service!: string

  @Column({ type: 'varchar', length: 150 })
  event_name!: string

  @Column({ type: 'varchar', length: 150 })
  method_name!: string

  @Column({ type: 'varchar', length: 25, nullable: true })
  ex_event_type!: string | null

  @Column({ type: 'int', nullable: true })
  user_id!: number | null

  @Column({ type: 'text' })
  message!: string

  @Column({ type: 'json', nullable: true })
  context!: unknown | null
}