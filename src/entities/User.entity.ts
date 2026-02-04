import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm'
import { Account } from './Account.entity'
import { Category } from './category.entity'
import { Loan } from './Loan.entity'
import { Transaction } from './Transaction.entity'

@Entity('users')
//@Unique('UQ_users_email', ['email'])
export class User {

  @PrimaryGeneratedColumn()
  id!: number

  @Column({ unique: true,  })
  email!: string

  @Column()
  password_hash!: string

  @Column()
  name!: string

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @OneToMany(() => Account, account => account.user)
  accounts!: Account[]

  @OneToMany(() => Category, category => category.user)
  categories!: Category[]

  @OneToMany(() => Transaction, transaction => transaction.user)
  transactions!: Transaction[]

  @OneToMany(() => Loan, loan => loan.user)
  loans!: Loan[]

}
