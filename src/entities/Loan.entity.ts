import { IsBoolean, IsNotEmpty } from 'class-validator'
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn, Unique } from 'typeorm'
import { DecimalTransformer } from '../config/decimal.transformer'
import { Account } from './Account.entity'
import { LoanPayment } from './LoanPayment.entity'
import { Transaction } from './Transaction.entity'
import { User } from './User.entity'

@Entity('loans')
//@Unique('UQ_loans_transaction', ['transaction'])
export class Loan {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.loans)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_loans_user' })
  user!: User

  @Column()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  total_amount!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  interest_amount!: number

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

  @OneToMany(() => LoanPayment, payment => payment.loan)
  payments!: LoanPayment[]

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'disbursement_account_id', foreignKeyConstraintName: 'fk_loans_disbursement_account' })
  disbursement_account!: Account

  @OneToOne(() => Transaction)
  @JoinColumn({ name: 'transaction_id', foreignKeyConstraintName: 'fk_loans_transaction' })
  transaction!: Transaction

  @ManyToOne(() => Loan, loan => loan.children, { nullable: true })
  @JoinColumn({ name: 'parent_id', foreignKeyConstraintName: 'fk_loans_parent' })
  parent!: Loan | null

  @OneToMany(() => Loan, loan => loan.parent)
  children!: Loan[]

}
