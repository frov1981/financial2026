import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, Index, UpdateDateColumn } from 'typeorm'
import { DecimalTransformer } from '../config/typeorm-decimal.transformer'
import { User } from './User.entity'

@Entity('cache_kpi_balances')
@Unique('uq_cache_kpi_period', ['user', 'period_year', 'period_month'])
@Index('idx_cache_kpi_user_year', ['user', 'period_year'])
@Index('idx_cache_kpi_year_month', ['period_year', 'period_month'])
export class CacheKpiBalance {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.cache_kpi_balances)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_cache_kpi_user' })
  user!: User

  @Column({ type: 'smallint' })
  period_year!: number

  @Column({ type: 'tinyint' })
  period_month!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  total_income!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  total_expense!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  total_savings!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  total_withdrawals!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  net_worth!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  available_savings!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  net_balance!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  total_loan!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  total_principal_paid!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  total_interest_paid!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  total_loan_balance!: number

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at!: Date

}