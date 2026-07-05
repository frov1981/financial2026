import { IsBoolean, IsIn, IsNotEmpty, IsOptional } from 'class-validator'
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { CategoryGroup } from './CategoryGroups.entity'
import { Payable } from './Payable.entity'
import { PayablePayment } from './PayablePayment.entity'
import { Transaction } from './Transaction.entity'
import { User } from './User.entity'
import { Receivable } from './Receivable.entity'
import { ReceivableCollection } from './ReceivableCollection.entity'

@Entity('categories')
export class Category {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.categories)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_categories_user' })
  user!: User

  @Column()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string

  @Column({ type: 'varchar' })
  @IsIn(['income', 'expense'], { message: 'El tipo debe ser income o expense' })
  type!: 'income' | 'expense'

  @Column({ type: 'varchar' })
  @IsOptional()
  @IsIn(['payable', 'payable_payment'], { message: 'El tipo debe ser payable o payable_payment o vacío' })
  type_for_payable!: 'payable' | 'payable_payment' | 'receivable' | 'collection' | null

  @Column({ default: true })
  @IsBoolean({ message: 'El estado debe ser true o false' })
  is_active!: boolean

  @OneToMany(() => Transaction, transaction => transaction.category)
  transactions!: Transaction[]

  @OneToMany(() => Payable, payable => payable.category)
  payables!: Payable[]

  @OneToMany(() => PayablePayment, payment => payment.category)
  payable_payments!: PayablePayment[]

  @ManyToOne(() => CategoryGroup, group => group.categories)
  @JoinColumn({ name: 'category_group_id', foreignKeyConstraintName: 'fk_categories_group' })
  category_group!: CategoryGroup | null

  @OneToMany(() => Receivable, receivable => receivable.category)
  receivables!: Receivable[]

  @OneToMany(() => ReceivableCollection, collection => collection.category)
  receivable_collections!: ReceivableCollection[]

}
