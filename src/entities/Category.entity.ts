import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm'
import { User } from './User.entity'
import { Transaction } from './Transaction.entity'
import { IsBoolean, IsIn, IsNotEmpty } from 'class-validator'

@Entity('categories')
export class Category {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.categories)
  @JoinColumn({ name: 'user_id' })
  user!: User

  @Column()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string

  @Column({ type: 'varchar' })
  @IsIn(['income', 'expense'], { message: 'El tipo debe ser income o expense' })
  type!: 'income' | 'expense'

  @Column({ default: true })
  @IsBoolean({ message: 'El estado debe ser true o false' })
  is_active!: boolean

  @ManyToOne(() => Category, category => category.children, { nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent!: Category | null

  @OneToMany(() => Category, category => category.parent)
  children!: Category[]

  @OneToMany(() => Transaction, transaction => transaction.category)
  transactions!: Transaction[]
}
