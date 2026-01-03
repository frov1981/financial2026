import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, JoinColumn } from 'typeorm'
import { User } from './User.entity'
import { Loan } from './Loan.entity'

@Entity('lenders')
export class Lender {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.lenders)
  @JoinColumn({ name: 'user_id' })
  user!: User

  @Column()
  name!: string

  @Column({ type: 'varchar' })
  type!: 'bank' | 'cooperative' | 'person' | 'other'

  @Column({ default: true })
  is_active!: boolean

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @OneToMany(() => Loan, loan => loan.lender)
  loans!: Loan[]
}
