import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { Account } from './Account.entity'
import { Loan } from './Loan.entity'
import { Transaction } from './Transaction.entity'

@Entity('loan_payments')
export class LoanPayment {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => Loan, loan => loan.payments)
  @JoinColumn({ name: 'loan_id' })
  loan!: Loan

  @ManyToOne(() => Account, account => account.loanPayments)
  @JoinColumn({ name: 'account_id' })
  account!: Account

  @ManyToOne(() => Transaction)
  @JoinColumn({ name: 'transaction_id' })
  transaction!: Transaction

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  principal_amount!: number

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  interest_amount!: number

  @Column({ type: 'timestamp' })
  payment_date!: Date

  @Column({ nullable: true })
  note!: string

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date
}
