import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, MaxLength } from 'class-validator'
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from 'typeorm'
import { Transaction } from './Transaction.entity'
import { User } from './User.entity'

@Index('idx_suppliers_user', ['user'])
@Entity('suppliers')
export class Supplier {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.suppliers)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_suppliers_user' })
  user!: User

  @Column({ type: 'varchar', length: 255 })
  @IsNotEmpty({ message: 'La razón social es obligatoria' })
  business_name!: string

  @Column({ type: 'varchar', length: 20, nullable: true })
  tax_id!: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  address_1!: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  address_2!: string | null

  @Column({ type: 'varchar', length: 30, nullable: true })
  mobile_1!: string | null

  @Column({ type: 'varchar', length: 30, nullable: true })
  mobile_2!: string | null

  @Column({ type: 'varchar', length: 30, nullable: true })
  whatsapp_1!: string | null

  @Column({ type: 'varchar', length: 30, nullable: true })
  whatsapp_2!: string | null

  @Column({ type: 'varchar', length: 254, nullable: true })
  @IsOptional()
  @IsEmail({}, { message: 'El correo debe tener un formato válido' })
  @MaxLength(254, { message: 'El correo no puede superar 254 caracteres' })
  email_1!: string | null

  @Column({ type: 'varchar', length: 254, nullable: true })
  @IsOptional()
  @IsEmail({}, { message: 'El correo debe tener un formato válido' })
  @MaxLength(254, { message: 'El correo no puede superar 254 caracteres' })
  email_2!: string | null

  @Column({ type: 'boolean', default: true })
  @IsBoolean({ message: 'El estado debe ser true o false' })
  is_active!: boolean

  @OneToMany(() => Transaction, transaction => transaction.supplier)
  transactions!: Transaction[]

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date
}
