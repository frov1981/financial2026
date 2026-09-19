import { IsNotEmpty } from 'class-validator'
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { NotificationSchedule } from './NotificationSchedule.entity'

@Entity('notification_types')
export class NotificationType {

  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 80, unique: true })
  @IsNotEmpty()
  key!: string

  @Column({ type: 'varchar', length: 150 })
  @IsNotEmpty()
  name!: string

  @Column({ type: 'text', nullable: true })
  description!: string | null

  @Column({ default: true })
  enabled!: boolean

  @OneToMany(() => NotificationSchedule, schedule => schedule.notification_type)
  schedules!: NotificationSchedule[]
}