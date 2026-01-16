import { IsIn, IsNotEmpty } from 'class-validator'
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn } from 'typeorm'
import { DecimalTransformer } from '../config/decimal.transformer'
import { Account } from './Account.entity'
import { LoanPayment } from './LoanPayment.entity'
import { Transaction } from './Transaction.entity'
import { User } from './User.entity'

@Entity('loans')
export class Loan {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.loans)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_loans_user' })
  user!: User

  @Column({ nullable: true })
  loan_number!: string

  @Column()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  total_amount!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  interest_amount!: number | null

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  balance!: number;

  @Column({ type: 'timestamp' })
  start_date!: Date

  @Column({ type: 'timestamp', nullable: true })
  end_date!: Date | null

  @Column({ default: 'active' })
  @IsIn(['active', 'closed'], { message: 'El tipo debe ser active o closed' })
  status!: 'active' | 'closed'

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @OneToMany(() => LoanPayment, payment => payment.loan)
  payments!: LoanPayment[]

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'disbursement_account_id', foreignKeyConstraintName: 'fk_loans_disbursement_account' })
  disbursement_account!: Account

  @OneToOne(() => Transaction, { nullable: true })
  @JoinColumn({ name: 'transaction_id', foreignKeyConstraintName: 'fk_loans_transaction' })
  transaction!: Transaction | null

}
