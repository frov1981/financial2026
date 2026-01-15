import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { DecimalTransformer } from '../config/decimal.transformer'
import { Account } from './Account.entity'
import { Loan } from './Loan.entity'
import { Transaction } from './Transaction.entity'
import { IsDate, IsNotEmpty, IsNumber, IsPositive, Min } from 'class-validator'

@Entity('loan_payments')
export class LoanPayment {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => Loan, loan => loan.payments)
  @JoinColumn({ name: 'loan_id', foreignKeyConstraintName: 'fk_loan_payments_loan' })
  loan!: Loan

  @ManyToOne(() => Account, account => account.loanPayments)
  @JoinColumn({ name: 'account_id', foreignKeyConstraintName: 'fk_loan_payments_account' })
  @IsNotEmpty({ message: 'La cuenta es obligatoria' })
  account!: Account

  @ManyToOne(() => Transaction)
  @JoinColumn({ name: 'transaction_id', foreignKeyConstraintName: 'fk_loan_payments_transaction' })
  transaction!: Transaction


  @IsNumber({}, { message: 'El monto debe ser numérico' })
  @IsPositive({ message: 'El monto debe ser mayor a cero' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  principal_amount!: number

  @IsNumber({}, { message: 'El monto debe ser numérico' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  interest_amount!: number

  @IsDate({ message: 'La fecha del pago debe ser una fecha válida' })
  @Column({ type: 'timestamp' })
  payment_date!: Date

  @Column({ nullable: true })
  note!: string

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @Column({ nullable: true })
  loan_name_tmp!: string
}
