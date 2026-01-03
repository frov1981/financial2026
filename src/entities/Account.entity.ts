import { IsBoolean, IsIn, IsNotEmpty } from 'class-validator'
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { LoanPayment } from './LoanPayment.entity'
import { Transaction } from './Transaction.entity'
import { User } from './User.entity'

@Entity('accounts')
export class Account {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.accounts)
  @JoinColumn({ name: 'user_id' })
  user!: User

  @Column()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string

  @Column({ type: 'varchar' })
  @IsIn(['cash', 'bank', 'card'], { message: 'El tipo debe ser cash, bank o card' })
  type!: 'cash' | 'bank' | 'card'

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  balance!: number

  @Column({ default: true })
  @IsBoolean({ message: 'El estado debe ser true o false' })
  is_active!: boolean

  @OneToMany(() => Transaction, transaction => transaction.account)
  transactions!: Transaction[]

  @OneToMany(() => LoanPayment, payment => payment.account)
  loanPayments!: LoanPayment[]
}
