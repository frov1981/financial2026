import { Transform } from 'class-transformer'
import { IsIn, IsNotEmpty, IsNumber, IsPositive, MaxLength, Validate, ValidateIf } from 'class-validator'
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm'
import { DecimalTransformer } from '../config/decimal.transformer'
import { NotSameAccount } from '../validators/notSameAccount.validator'
import { Account } from './Account.entity'
import { Category } from './Category.entity'
import { Loan } from './Loan.entity'
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
  @JoinColumn({ name: 'to_account_id' })
  @ValidateIf(t => t.type === 'transfer')
  @IsNotEmpty({ message: 'La cuenta destino es obligatoria' })
  to_account!: Account | null

  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'category_id' })
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

  @Column({ nullable: true, length: 200 })
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MaxLength(200, { message: 'Máximo 200 caracteres' })
  description!: string

  @OneToOne(() => Loan, loan => loan.transaction)
  loan!: Loan

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @Validate(NotSameAccount)
  private _notSameAccountValidation!: boolean
}
