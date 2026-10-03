import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm'
import { User } from './User.entity'

@Entity('device_preferences')
@Unique('uq_device_preferences_user_device', ['user', 'device_id'])
export class DevicePreference {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id!: number

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_device_preferences_user' })
  user!: User

  @Column({ type: 'varchar', length: 36 })
  device_id!: string

  @Column({ type: 'json' })
  state!: Record<string, unknown>

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date
}
