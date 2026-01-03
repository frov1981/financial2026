import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn
} from 'typeorm'
import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  MaxLength,
  Validate,
  ValidateIf
} from 'class-validator'
import { Transform } from 'class-transformer'
import { User } from './User.entity'
import { Account } from './Account.entity'
import { Category } from './Category.entity'
import { NotSameAccount } from '../validators/notSameAccount.validator'

@Entity('transactions')
export class Transaction {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.transactions)
  @JoinColumn({ name: 'user_id' })
  user!: User

  @Column({ type: 'varchar' })
  @IsIn(['income', 'expense', 'transfer'], {
    message: 'Tipo de transacción inválido'
  })
  type!: 'income' | 'expense' | 'transfer'

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'account_id' })
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

  @Column({ type: 'decimal', precision: 12, scale: 2 })
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

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @Validate(NotSameAccount)
  private _notSameAccountValidation!: boolean
}
