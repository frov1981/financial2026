import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { DecimalTransformer } from '../config/typeorm-decimal.transformer'
import { Category } from './Category.entity'
import { CategoryGroup } from './CategoryGroups.entity'
import { User } from './User.entity'

@Index('uk_cache_kpi_categories', ['user', 'year_period', 'month_period', 'category_group', 'category'], { unique: true })
@Index('idx_user_period', ['user', 'year_period', 'month_period'])
@Index('idx_category_group', ['user', 'category_group'])
@Index('idx_category', ['user', 'category'])
@Entity('cache_kpi_categories')
export class CacheKpiCategory {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_cache_kpi_categories_user' })
  user!: User

  @Column({ type: 'smallint' })
  year_period!: number

  @Column({ type: 'tinyint' })
  month_period!: number

  @ManyToOne(() => CategoryGroup)
  @JoinColumn({ name: 'category_group_id', foreignKeyConstraintName: 'fk_cache_kpi_categories_group' })
  category_group!: CategoryGroup

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id', foreignKeyConstraintName: 'fk_cache_kpi_categories_category' })
  category!: Category

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  amount!: number

  @Column({ type: 'int', default: 0 })
  transaction_count!: number

}
