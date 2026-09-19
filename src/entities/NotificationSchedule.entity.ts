import { IsIn, Matches } from 'class-validator'
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm'
import { User } from './User.entity'
import { NotificationType } from './NotificationType.entity'

@Index('uq_notification_schedules_user_type', ['user', 'notification_type'], { unique: true })
@Entity('notification_schedules')
export class NotificationSchedule {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.notification_schedules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_notification_schedules_user' })
  user!: User

  @ManyToOne(() => NotificationType, notification_type => notification_type.schedules, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'notification_type_id', foreignKeyConstraintName: 'fk_notification_schedules_type' })
  notification_type!: NotificationType

  @Column({ type: 'varchar', length: 20 })
  @IsIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
  send_day!: string

  @Column({ type: 'time' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  send_time!: string

  @Column({ type: 'varchar', length: 64, default: 'UTC' })
  timezone!: string

  @Column({ default: true })
  enabled!: boolean

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date
}