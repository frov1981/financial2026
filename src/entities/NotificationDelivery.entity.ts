import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { NotificationSchedule } from './NotificationSchedule.entity'
import { NotificationType } from './NotificationType.entity'
import { User } from './User.entity'

@Index('uq_notification_deliveries_schedule_period', ['schedule', 'period_key'], { unique: true })
@Entity('notification_deliveries')
export class NotificationDelivery {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => NotificationSchedule, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'schedule_id', foreignKeyConstraintName: 'fk_notification_deliveries_schedule' })
  schedule!: NotificationSchedule

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_notification_deliveries_user' })
  user!: User

  @ManyToOne(() => NotificationType, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'notification_type_id', foreignKeyConstraintName: 'fk_notification_deliveries_type' })
  notification_type!: NotificationType

  @Column({ type: 'varchar', length: 100 })
  period_key!: string

  @Column({ type: 'varchar', length: 20, default: 'processing' })
  status!: 'processing' | 'sent' | 'failed'

  @Column({ type: 'timestamp', nullable: true })
  sent_at!: Date | null

  @Column({ type: 'text', nullable: true })
  error_message!: string | null

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date
}