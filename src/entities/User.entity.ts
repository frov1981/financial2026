import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm'
import { Account } from './Account.entity'
import { Category } from './Category.entity'
import { Payable } from './Payable.entity'
import { Transaction } from './Transaction.entity'
import { CategoryGroup } from './CategoryGroups.entity'
import { PayableGroup } from './PayableGroup.entity'
import { CacheKpiBalance } from './CacheKpiBalance.entity'
import { ReceivableGroup } from './ReceivableGroup.entity'
import { Receivable } from './Receivable.entity'

@Entity('users')
//@Unique('UQ_users_email', ['email'])
export class User {

  @PrimaryGeneratedColumn()
  id!: number

  @Column({ unique: true })
  email!: string

  @Column({ select: false })
  password_hash!: string

  @Column()
  name!: string

  @Column({ type: 'varchar', default: 'USER' })
  role!: 'ADMIN' | 'USER'

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @OneToMany(() => Account, account => account.user)
  accounts!: Account[]

  @OneToMany(() => Category, category => category.user)
  categories!: Category[]

  @OneToMany(() => Transaction, transaction => transaction.user)
  transactions!: Transaction[]

  @OneToMany(() => Payable, payable => payable.user)
  payables!: Payable[]

  @OneToMany(() => CategoryGroup, group => group.user)
  category_groups!: CategoryGroup[]

  @OneToMany(() => PayableGroup, group => group.user)
  payable_groups!: PayableGroup[]

  @OneToMany(() => CacheKpiBalance, cache => cache.user)
  cache_kpi_balances!: CacheKpiBalance[]

  @OneToMany(() => ReceivableGroup, group => group.user)
  receivable_groups!: ReceivableGroup[]

  @OneToMany(() => Receivable, receivable => receivable.user)
  receivables!: Receivable[]

}
