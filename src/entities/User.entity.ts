import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm'
import { Account } from './Account.entity'
import { Category } from './Category.entity'
import { Loan } from './Loan.entity'
import { Transaction } from './Transaction.entity'
import { CategoryGroup } from './CategoryGroups.entity'
import { LoanGroup } from './LoanGroup.entity'
import { CacheKpiBalance } from './CacheKpiBalance.entity'

@Entity('users')
//@Unique('UQ_users_email', ['email'])
export class User {

  @PrimaryGeneratedColumn()
  id!: number

  @Column({ unique: true, select: false })
  email!: string

  @Column({ select: false })
  password_hash!: string

  @Column({ select: false })
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

  @OneToMany(() => CategoryGroup, group => group.user)
  category_groups!: CategoryGroup[]

  @OneToMany(() => LoanGroup, group => group.user)
  loan_groups!: LoanGroup[]

  @OneToMany(() => CacheKpiBalance, cache => cache.user)
  cache_kpi_balances!: CacheKpiBalance[]

}
