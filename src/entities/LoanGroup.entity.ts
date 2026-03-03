import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { Loan } from './Loan.entity'
import { User } from './User.entity'
import { IsNotEmpty } from 'class-validator'

@Entity('loan_groups')
export class LoanGroup {

  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  @IsNotEmpty({ message: 'El nombre del grupo es obligatorio' })
  name!: string

  @Column({ default: true })
  is_active!: boolean

  @OneToMany(() => Loan, loan => loan.loan_group)
  loans!: Loan[]

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_loan_groups_user' })
  user!: User

}
