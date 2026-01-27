import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn
} from 'typeorm'
import { User } from './User.entity'

@Entity('auth_codes')
export class AuthCode {
  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User)
  user!: User

  @Column()
  code_hash!: string

  @Column({ type: 'timestamp' })
  expires_at!: Date

  @Column({ type: 'timestamp', nullable: true })
  used_at!: Date | null

  @Column({ default: 0 })
  attempts!: number

  @CreateDateColumn()
  created_at!: Date
}
