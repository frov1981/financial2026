import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { Loan } from './Loan.entity'
import { User } from './User.entity'

@Entity('loan_groups')
export class LoanGroup {

  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  name!: string

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_loan_groups_user' })
  user!: User

  @Column({ default: true })
  is_active!: boolean

  @OneToMany(() => Loan, loan => loan.loan_group)
  loans!: Loan[]

}
