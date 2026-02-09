import { IsNotEmpty } from 'class-validator'
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { User } from './User.entity'
import { Category } from './Category.entity'

@Entity('category_groups')
export class CategoryGroup {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.category_groups)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_category_groups_user' })
  user!: User

  @Column()
  @IsNotEmpty({ message: 'El nombre del grupo es obligatorio' })
  name!: string

  @Column({ default: true })
  is_active!: boolean

  @OneToMany(() => Category, category => category.category_group)
  categories!: Category[]
}
