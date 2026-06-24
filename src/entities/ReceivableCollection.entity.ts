import { IsDate, IsNotEmpty, IsNumber } from 'class-validator'
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from 'typeorm'
import { DecimalTransformer } from '../config/typeorm-decimal.transformer'
import { Account } from './Account.entity'
import { Category } from './Category.entity'
import { Transaction } from './Transaction.entity'
import { Receivable } from './Receivable.entity'

@Entity('receivable_collections')
export class ReceivableCollection {

  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  collection_number!: number

  @ManyToOne(() => Receivable, receivable => receivable.collections)
  @JoinColumn({ name: 'receivable_id', foreignKeyConstraintName: 'fk_receivable_collections_receivable' })
  receivable!: Receivable

  @ManyToOne(() => Account, account => account.receivableCollections)
  @JoinColumn({ name: 'account_id', foreignKeyConstraintName: 'fk_receivable_collections_account' })
  @IsNotEmpty({ message: 'La cuenta es obligatoria' })
  account!: Account

  @ManyToOne(() => Transaction)
  @JoinColumn({ name: 'transaction_id', foreignKeyConstraintName: 'fk_receivable_collections_transaction' })
  transaction!: Transaction

  @IsNumber({}, { message: 'El monto debe ser numérico' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  principal_collected!: number

  @IsNumber({}, { message: 'El monto debe ser numérico' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  interest_collected!: number

  @IsDate({ message: 'La fecha del cobro debe ser una fecha válida' })
  @Column({ type: 'timestamp' })
  collection_date!: Date

  @Column({ nullable: true })
  note!: string

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id', foreignKeyConstraintName: 'fk_receivable_collections_category' })
  category!: Category | null

}