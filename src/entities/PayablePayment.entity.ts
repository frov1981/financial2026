import { IsDate, IsNotEmpty, IsNumber, IsPositive, Min } from 'class-validator'
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { DecimalTransformer } from '../config/typeorm-decimal.transformer'
import { Account } from './Account.entity'
import { Category } from './Category.entity'
import { Payable } from './Payable.entity'
import { Transaction } from './Transaction.entity'

@Entity('payable_payments')
export class PayablePayment {

  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  payment_number!: number

  @ManyToOne(() => Payable, payable => payable.payments)
  @JoinColumn({ name: 'payable_id', foreignKeyConstraintName: 'fk_payable_payments_payable' })
  payable!: Payable

  @ManyToOne(() => Account, account => account.payablePayments)
  @JoinColumn({ name: 'account_id', foreignKeyConstraintName: 'fk_payable_payments_account' })
  @IsNotEmpty({ message: 'La cuenta es obligatoria' })
  account!: Account

  @ManyToOne(() => Transaction)
  @JoinColumn({ name: 'transaction_id', foreignKeyConstraintName: 'fk_payable_payments_transaction' })
  transaction!: Transaction

  @IsNumber({}, { message: 'El monto debe ser numérico' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  principal_paid!: number

  @IsNumber({}, { message: 'El monto debe ser numérico' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  interest_paid!: number

  @IsDate({ message: 'La fecha del pago debe ser una fecha válida' })
  @Column({ type: 'timestamp' })
  payment_date!: Date

  @Column({ nullable: true })
  note!: string

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id', foreignKeyConstraintName: 'fk_payable_payments_category' })
  category!: Category | null

}
