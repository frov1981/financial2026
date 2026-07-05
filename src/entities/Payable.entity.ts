import { IsBoolean, IsNotEmpty } from 'class-validator'
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn, Unique } from 'typeorm'
import { DecimalTransformer } from '../config/typeorm-decimal.transformer'
import { Account } from './Account.entity'
import { Category } from './Category.entity'
import { PayableGroup } from './PayableGroup.entity'
import { PayablePayment } from './PayablePayment.entity'
import { Transaction } from './Transaction.entity'
import { User } from './User.entity'

@Entity('payables')
export class Payable {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.payables)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_payables_user' })
  user!: User

  @Column()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  total_amount!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  principal_paid!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  interest_paid!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  balance!: number;

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

  @ManyToOne(() => PayableGroup, group => group.payables)
  @JoinColumn({ name: 'payable_group_id', foreignKeyConstraintName: 'fk_payables_group' })
  payable_group!: PayableGroup | null

  @OneToMany(() => PayablePayment, payment => payment.payable)
  payments!: PayablePayment[]

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'disbursement_account_id', foreignKeyConstraintName: 'fk_payables_disbursement_account' })
  disbursement_account!: Account | null

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id', foreignKeyConstraintName: 'fk_payables_category' })
  category!: Category | null

  @OneToOne(() => Transaction)
  @JoinColumn({ name: 'transaction_id', foreignKeyConstraintName: 'fk_payables_transaction' })
  transaction!: Transaction

}
