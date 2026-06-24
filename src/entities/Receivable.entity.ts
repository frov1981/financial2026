import { IsBoolean, IsNotEmpty } from 'class-validator'
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn
} from 'typeorm'
import { DecimalTransformer } from '../config/typeorm-decimal.transformer'
import { Account } from './Account.entity'
import { Category } from './Category.entity'
import { ReceivableGroup } from './ReceivableGroup.entity'
import { Transaction } from './Transaction.entity'
import { User } from './User.entity'
import { ReceivableCollection } from './ReceivableCollection.entity'

@Entity('receivables')
export class Receivable {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.receivables)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_receivables_user' })
  user!: User

  @Column()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  total_amount!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  principal_received!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  interest_received!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  balance!: number

  @Column({ type: 'timestamp' })
  start_date!: Date

  @Column({ type: 'timestamp', nullable: true })
  end_date!: Date | null

  @Column({ default: true })
  @IsBoolean({ message: 'El estado debe ser true o false' })
  is_active!: boolean

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @Column({ nullable: true })
  note!: string

  @ManyToOne(() => ReceivableGroup, group => group.receivables)
  @JoinColumn({ name: 'receivable_group_id', foreignKeyConstraintName: 'fk_receivables_group' })
  receivable_group!: ReceivableGroup | null

  @OneToMany(() => ReceivableCollection, collection => collection.receivable)
  collections!: ReceivableCollection[]

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'disbursement_account_id', foreignKeyConstraintName: 'fk_receivables_disbursement_account' })
  disbursement_account!: Account | null

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id', foreignKeyConstraintName: 'fk_receivables_category' })
  category!: Category | null

  @OneToOne(() => Transaction)
  @JoinColumn({ name: 'transaction_id', foreignKeyConstraintName: 'fk_receivables_transaction' })
  transaction!: Transaction

}