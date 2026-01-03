import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn } from 'typeorm'
import { Account } from './Account.entity'
import { Category } from './Category.entity'
import { Transaction } from './Transaction.entity'
import { Loan } from './Loan.entity'
import { Lender } from './Lender.entity'

@Entity('users')
export class User {

  @PrimaryGeneratedColumn()
  id!: number

  @Column({ unique: true })
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

  @OneToMany(() => Lender, lender => lender.user)
  lenders!: Lender[]
}
