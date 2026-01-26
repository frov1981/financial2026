import { IsBoolean, IsIn, IsNotEmpty } from 'class-validator'
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { DecimalTransformer } from '../config/decimal.transformer'
import { Loan } from './Loan.entity'
import { LoanPayment } from './LoanPayment.entity'
import { Transaction } from './Transaction.entity'
import { User } from './User.entity'

@Entity('accounts')
export class Account {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.accounts)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_accounts_user' })
  user!: User

  @Column()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string

  @Column({ type: 'varchar' })
  @IsIn(['cash', 'bank', 'card', 'saving'], { message: 'El tipo debe ser cash, bank, saving o card' })
  type!: 'cash' | 'bank' | 'card' | 'saving'

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  balance!: number

  @Column({ default: true })
  @IsBoolean({ message: 'El estado debe ser true o false' })
  is_active!: boolean

  @OneToMany(() => Transaction, transaction => transaction.account)
  transactions!: Transaction[]

  @OneToMany(() => LoanPayment, payment => payment.account)
  loanPayments!: LoanPayment[]

  @OneToMany(() => Loan, loan => loan.disbursement_account)
  loans!: Loan[]
}
