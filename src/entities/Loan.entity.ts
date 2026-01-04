import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { LoanPayment } from './LoanPayment.entity'
import { User } from './User.entity'

@Entity('loans')
export class Loan {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.loans)
  @JoinColumn({ name: 'user_id' })
  user!: User

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

  @Column({ type: 'timestamp' })
  end_date!: Date

  @Column({ default: 'active' })
  status!: 'active' | 'closed'

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @OneToMany(() => LoanPayment, payment => payment.loan)
  payments!: LoanPayment[]
}
