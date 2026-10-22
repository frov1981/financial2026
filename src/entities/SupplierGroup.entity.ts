import { IsBoolean, IsNotEmpty } from 'class-validator'
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { Supplier } from './Supplier.entity'
import { User } from './User.entity'

@Index('uq_supplier_groups_user_name', ['user', 'name'], { unique: true })
@Entity('supplier_groups')
export class SupplierGroup {
  @PrimaryGeneratedColumn()
  id!: number

  @Column({ type: 'varchar', length: 255 })
  @IsNotEmpty({ message: 'El nombre del grupo es obligatorio' })
  name!: string

  @ManyToOne(() => User, user => user.supplier_groups)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_supplier_groups_user' })
  user!: User

  @Column({ type: 'boolean', default: true })
  @IsBoolean({ message: 'El estado debe ser true o false' })
  is_active!: boolean

  @OneToMany(() => Supplier, supplier => supplier.supplier_group)
  suppliers!: Supplier[]
}
