import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { Payable } from './Payable.entity'
import { User } from './User.entity'
import { IsNotEmpty } from 'class-validator'

@Entity('payable_groups')
export class PayableGroup {

  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  @IsNotEmpty({ message: 'El nombre del grupo es obligatorio' })
  name!: string

  @Column({ default: true })
  is_active!: boolean

  @OneToMany(() => Payable, payable => payable.payable_group)
  payables!: Payable[]

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_payable_groups_user' })
  user!: User

}
