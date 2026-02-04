import { Transform } from 'class-transformer'
import { IsIn, IsNotEmpty, IsNumber, IsPositive, MaxLength, ValidateIf } from 'class-validator'
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm'
import { DecimalTransformer } from '../config/typeorm-decimal.transformer'
import { Account } from './Account.entity'
import { Category } from './category.entity'
import { Loan } from './Loan.entity'
import { LoanPayment } from './LoanPayment.entity'
import { User } from './User.entity'

@Entity('transactions')
export class Transaction {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.transactions)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_transactions_user' })
  user!: User

  @Column({ type: 'varchar' })
  @IsIn(['income', 'expense', 'transfer'], {
    message: 'Tipo de transacción inválido'
  })
  type!: 'income' | 'expense' | 'transfer'

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'account_id', foreignKeyConstraintName: 'fk_transactions_account' })
  @IsNotEmpty({ message: 'La cuenta es obligatoria' })
  account!: Account

  @ManyToOne(() => Account, { nullable: true })
  @JoinColumn({ name: 'to_account_id', foreignKeyConstraintName: 'fk_transactions_to_account' })
  @ValidateIf(t => t.type === 'transfer')
  @IsNotEmpty({ message: 'La cuenta destino es obligatoria' })
  to_account!: Account | null

  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'category_id', foreignKeyConstraintName: 'fk_transactions_categories' })
  @ValidateIf(t => t.type !== 'transfer')
  @IsNotEmpty({ message: 'La categoría es obligatoria' })
  category!: Category | null

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  @IsNumber({}, { message: 'El monto debe ser numérico' })
  @IsPositive({ message: 'El monto debe ser mayor a cero' })
  amount!: number

  @Column({ type: 'timestamp' })
  @Transform(({ value }) => value ? new Date(value) : new Date())
  date!: Date

  @Column({ default: '', length: 1000 })
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MaxLength(1000, { message: 'Máximo 1000 caracteres' })
  description!: string

  @OneToOne(() => Loan, loan => loan.transaction, { nullable: true })
  loan!: Loan

  @OneToOne(() => LoanPayment, payment => payment.transaction, { nullable: true })
  loan_payment!: LoanPayment | null

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

}
