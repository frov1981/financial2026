import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, JoinColumn } from 'typeorm'
import { User } from './User.entity'
import { Lender } from './Lender.entity'
import { LoanPayment } from './LoanPayment.entity'

@Entity('loans')
export class Loan {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.loans)
  @JoinColumn({ name: 'user_id' })
  user!: User

  @ManyToOne(() => Lender, lender => lender.loans)
  @JoinColumn({ name: 'lender_id' })
  lender!: Lender

  @Column({ nullable: true})
  loan_number!: string

  @Column()
  name!: string

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total_amount!: number

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  balance!: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  interest_rate!: number | null

  @Column({ type: 'timestamp' })
  start_date!: Date

  @Column({ default: 'active' })
  status!: 'active' | 'closed'

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @OneToMany(() => LoanPayment, payment => payment.loan)
  payments!: LoanPayment[]
}
