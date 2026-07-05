# Codigo Fuente Consolidado 
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\config\rate-limiter.ts
```
 
```ts
import rateLimit from 'express-rate-limit'
import { Request, Response } from 'express'

/**
 * Handler personalizado para respuestas de rate limit en JSON
 */
const createJsonHandler = (message: string) => {
  return (req: Request, res: Response) => {
    const rateLimitData = (req as any).rateLimit
    const retryAfter = rateLimitData?.resetTime ? 
      Math.ceil((rateLimitData.resetTime - Date.now()) / 1000) : 60
    
    res.status(429).json({
      success: false,
      error: message,
      retryAfter, // segundos antes de reintentar
      resetTime: rateLimitData?.resetTime
    })
  }
}

/**
 * Rate limiter para login (5 intentos por 15 minutos)
 * Previene ataques de fuerza bruta en credenciales
 */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos máximo
  message: 'Demasiados intentos de login. Intenta nuevamente en 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createJsonHandler('Demasiados intentos de login. Espera antes de intentar nuevamente.'),
  skip: (req) => {
    return process.env.NODE_SKIP_LOGIN === 'true'
  }
})

/**
 * Rate limiter para 2FA (5 intentos por 15 minutos)
 * Previene ataques de fuerza bruta en códigos de verificación
 */
export const twoFALimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos máximo
  message: 'Demasiados intentos de 2FA. Intenta nuevamente en 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createJsonHandler('Demasiados intentos de 2FA. Espera antes de intentar nuevamente.'),
  skip: (req) => {
    return process.env.NODE_SKIP_LOGIN === 'true'
  }
})

/**
 * Rate limiter general para APIs (100 solicitudes por minuto)
 * Protege contra DOS en endpoints de lectura
 * Más permisivo que login/2FA para no afectar navegación normal
 */
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 100, // 100 solicitudes máximo (suficiente para navegación)
  message: 'Demasiadas solicitudes. Espera antes de enviar más.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: createJsonHandler('Límite de solicitudes excedido. Espera antes de intentar nuevamente.'),
  // Removido keyGenerator personalizado para usar el por defecto que maneja IPv6 correctamente
})
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\config\session-store.ts
```
 
```ts
import MySQLStoreFactory from 'express-mysql-session'
import session from 'express-session'
import mysql from 'mysql2/promise'

const MySQLStore = MySQLStoreFactory(session)

/* ============================
   Pool MySQL para sesiones
============================ */
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  timezone: 'Z',
  connectionLimit: process.env.SESSION_DB_CONNECTION_LIMIT ? parseInt(process.env.SESSION_DB_CONNECTION_LIMIT, 10) : 1
})

/* ============================
   Store de sesiones
============================ */
export const sessionStore = new MySQLStore(
  {
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: 60 * 60 * 1000,
    createDatabaseTable: true,
    schema: {
      tableName: 'sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data'
      }
    }
  },
  pool as any
)
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\config\typeorm-decimal.transformer.ts
```
 
```ts
import { ValueTransformer } from 'typeorm'

export const DecimalTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => value === null ? null : Number(value)
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\config\typeorm.datasource.ts
```
 
```ts
import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { Account } from '../entities/Account.entity'
import { AuthCode } from '../entities/AuthCode.entity'
import { CacheKpiBalance } from '../entities/CacheKpiBalance.entity'
import { CacheKpiCategory } from '../entities/CacheKpiCategory.entity'
import { Category } from '../entities/Category.entity'
import { CategoryGroup } from '../entities/CategoryGroups.entity'
import { Payable } from '../entities/Payable.entity'
import { PayableGroup } from '../entities/PayableGroup.entity'
import { PayablePayment } from '../entities/PayablePayment.entity'
import { Receivable } from '../entities/Receivable.entity'
import { ReceivableCollection } from '../entities/ReceivableCollection.entity'
import { ReceivableGroup } from '../entities/ReceivableGroup.entity'
import { Transaction } from '../entities/Transaction.entity'
import { User } from '../entities/User.entity'
import { OneLineSqlLogger } from './typeorm.logger'

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [
    User,
    AuthCode,
    Account,
    Category,
    CategoryGroup,
    Payable,
    PayableGroup,
    PayablePayment,
    Transaction,
    CacheKpiBalance,
    CacheKpiCategory,
    Receivable,
    ReceivableCollection,
    ReceivableGroup
  ],
  synchronize: false,
  timezone: 'Z',
  extra: {
    timezone: 'Z',
    connectionLimit: process.env.DB_CONNECTION_LIMIT ? parseInt(process.env.DB_CONNECTION_LIMIT, 10) : 3
  },
  logging: process.env.DB_LOGGING === 'true' ? true : false,
  logger: new OneLineSqlLogger()
})
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\config\typeorm.logger.ts
```
 
```ts
import { QueryRunner, Logger as TypeOrmLogger } from 'typeorm';
import { logger } from '../utils/logger.util';

export class OneLineSqlLogger implements TypeOrmLogger {
  private enabled = process.env.DB_LOGGING === 'true';

  logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner) {
    if (!this.enabled) return;
    const oneLine = query.replace(/\s+/g, ' ').trim()
    logger.debug('QUERY', { query: oneLine, parameters })
  }

  logQueryError(error: string | Error, query: string, parameters?: any[], queryRunner?: QueryRunner) {
    if (!this.enabled) return;
    logger.error('QUERY ERROR', { query, parameters, error })
  }

  logQuerySlow(time: number, query: string, parameters?: any[], queryRunner?: QueryRunner) {
    if (!this.enabled) return;
    logger.warn('SLOW QUERY', { time, query, parameters })
  }

  logSchemaBuild(message: string, queryRunner?: QueryRunner) {
    if (!this.enabled) return;
    logger.info('SCHEMA BUILD', { message })
  }
  logMigration(message: string, queryRunner?: QueryRunner) {
    if (!this.enabled) return;
    logger.info('MIGRATION', { message })
  }

  log(level: 'log' | 'info' | 'warn', message: any, queryRunner?: QueryRunner) {
    if (level === 'log' || level === 'info') logger.info(message)
    if (level === 'warn') logger.warn(message)
  }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\config\genhash.js
```
 
```js
import bcrypt from 'bcryptjs'

async function run() {
  const password = '12345'
  const hash = await bcrypt.hash(password, 10)
  console.log(hash)
}

run()

/* Para ejecutar: node src/config/genhash.js */ 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\Account.entity.ts
```
 
```ts
import { IsBoolean, IsIn, IsNotEmpty } from 'class-validator'
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { DecimalTransformer } from '../config/typeorm-decimal.transformer'
import { Payable } from './Payable.entity'
import { PayablePayment } from './PayablePayment.entity'
import { Transaction } from './Transaction.entity'
import { User } from './User.entity'
import { ReceivableCollection } from './ReceivableCollection.entity'
import { Receivable } from './Receivable.entity'
@Index('idx_accounts_user_active_type', ['user', 'is_active', 'type'])
@Entity('accounts')
export class Account {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.accounts)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_accounts_user' })
  user!: User

  @Column()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string

  @Column({ type: 'varchar' })
  @IsIn(['cash', 'bank', 'card', 'saving'], { message: 'El tipo debe ser cash, bank, saving o card' })
  type!: 'cash' | 'bank' | 'card' | 'saving'

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  balance!: number

  @Column({ default: true })
  @IsBoolean({ message: 'El estado debe ser true o false' })
  is_active!: boolean

  @OneToMany(() => Transaction, transaction => transaction.account)
  transactions!: Transaction[]

  @OneToMany(() => PayablePayment, payment => payment.account)
  payablePayments!: PayablePayment[]

  @OneToMany(() => Payable, payable => payable.disbursement_account)
  payables!: Payable[]

  @OneToMany(() => ReceivableCollection, collection => collection.account)
  receivableCollections!: ReceivableCollection[]

  @OneToMany(() => Receivable, receivable => receivable.disbursement_account)
  receivables!: Receivable[]
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\AuthCode.entity.ts
```
 
```ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn
} from 'typeorm'
import { User } from './User.entity'

@Entity('auth_codes')
export class AuthCode {
  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_authcodes_user' })
  user!: User

  @Column()
  code_hash!: string

  @Column({ type: 'timestamp' })
  expires_at!: Date

  @Column({ type: 'timestamp', nullable: true })
  used_at!: Date | null

  @Column({ default: 0 })
  attempts!: number

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\CacheKpiBalance.entity.ts
```
 
```ts
import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { DecimalTransformer } from '../config/typeorm-decimal.transformer'
import { User } from './User.entity'

@Index('uq_user_period', ['user', 'period_year', 'period_month'], { unique: true })
@Entity('cache_kpi_balances')
export class CacheKpiBalance {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_cache_kpi_balances_user' })
  user!: User

  @Column({ type: 'int' })
  period_year!: number

  @Column({ type: 'int' })
  period_month!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  incomes!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  expenses!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  savings!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  withdrawals!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  loans!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  payments!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  total_inflows!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  total_outflows!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  net_cash_flow!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  net_savings!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  available_balance!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  principal_breakdown!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  interest_breakdown!: number

} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\CacheKpiCategory.entity.ts
```
 
```ts
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
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\Category.entity.ts
```
 
```ts
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
  @IsIn(['loan', 'payment'], { message: 'El tipo debe ser loan o payment o vacío' })
  type_for_loan!: 'loan' | 'payment' | 'receivable' | 'collection' | null

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
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\CategoryGroups.entity.ts
```
 
```ts
import { IsNotEmpty } from 'class-validator'
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { User } from './User.entity'
import { Category } from './Category.entity'

@Entity('category_groups')
export class CategoryGroup {

  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  @IsNotEmpty({ message: 'El nombre del grupo es obligatorio' })
  name!: string

  @Column({ default: true })
  is_active!: boolean

  @OneToMany(() => Category, category => category.category_group)
  categories!: Category[]

  @ManyToOne(() => User, user => user.category_groups)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_category_groups_user' })
  user!: User
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\Payable.entity.ts
```
 
```ts
import { IsBoolean, IsNotEmpty } from 'class-validator'
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn, Unique } from 'typeorm'
import { DecimalTransformer } from '../config/typeorm-decimal.transformer'
import { Account } from './Account.entity'
import { Category } from './Category.entity'
import { PayableGroup } from './PayableGroup.entity'
import { PayablePayment } from './PayablePayment.entity'
import { Transaction } from './Transaction.entity'
import { User } from './User.entity'

@Entity('payables')
export class Payable {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.payables)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_payables_user' })
  user!: User

  @Column()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  total_amount!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  principal_paid!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  interest_paid!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  balance!: number;

  @Column({ type: 'timestamp' })
  start_date!: Date

  @Column({ type: 'timestamp', nullable: true })
  end_date!: Date | null

  @Column({ default: true })
  @IsBoolean({ message: 'El estado debe ser true o false' })
  is_active!: boolean

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @Column({ nullable: true })
  note!: string

  @ManyToOne(() => PayableGroup, group => group.payables)
  @JoinColumn({ name: 'payable_group_id', foreignKeyConstraintName: 'fk_payables_group' })
  payable_group!: PayableGroup | null

  @OneToMany(() => PayablePayment, payment => payment.payable)
  payments!: PayablePayment[]

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'disbursement_account_id', foreignKeyConstraintName: 'fk_payables_disbursement_account' })
  disbursement_account!: Account | null

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id', foreignKeyConstraintName: 'fk_payables_category' })
  category!: Category | null

  @OneToOne(() => Transaction)
  @JoinColumn({ name: 'transaction_id', foreignKeyConstraintName: 'fk_payables_transaction' })
  transaction!: Transaction

}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\PayableGroup.entity.ts
```
 
```ts
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
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\PayablePayment.entity.ts
```
 
```ts
import { IsDate, IsNotEmpty, IsNumber, IsPositive, Min } from 'class-validator'
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm'
import { DecimalTransformer } from '../config/typeorm-decimal.transformer'
import { Account } from './Account.entity'
import { Category } from './Category.entity'
import { Payable } from './Payable.entity'
import { Transaction } from './Transaction.entity'

@Entity('payable_payments')
export class PayablePayment {

  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  payment_number!: number

  @ManyToOne(() => Payable, payable => payable.payments)
  @JoinColumn({ name: 'payable_id', foreignKeyConstraintName: 'fk_payable_payments_payable' })
  payable!: Payable

  @ManyToOne(() => Account, account => account.payablePayments)
  @JoinColumn({ name: 'account_id', foreignKeyConstraintName: 'fk_payable_payments_account' })
  @IsNotEmpty({ message: 'La cuenta es obligatoria' })
  account!: Account

  @ManyToOne(() => Transaction)
  @JoinColumn({ name: 'transaction_id', foreignKeyConstraintName: 'fk_payable_payments_transaction' })
  transaction!: Transaction

  @IsNumber({}, { message: 'El monto debe ser numérico' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  principal_paid!: number

  @IsNumber({}, { message: 'El monto debe ser numérico' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  interest_paid!: number

  @IsDate({ message: 'La fecha del pago debe ser una fecha válida' })
  @Column({ type: 'timestamp' })
  payment_date!: Date

  @Column({ nullable: true })
  note!: string

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id', foreignKeyConstraintName: 'fk_payable_payments_category' })
  category!: Category | null

}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\Receivable.entity.ts
```
 
```ts
import { IsBoolean, IsNotEmpty } from 'class-validator'
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn
} from 'typeorm'
import { DecimalTransformer } from '../config/typeorm-decimal.transformer'
import { Account } from './Account.entity'
import { Category } from './Category.entity'
import { ReceivableGroup } from './ReceivableGroup.entity'
import { Transaction } from './Transaction.entity'
import { User } from './User.entity'
import { ReceivableCollection } from './ReceivableCollection.entity'

@Entity('receivables')
export class Receivable {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.receivables)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_receivables_user' })
  user!: User

  @Column()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  name!: string

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  total_amount!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  principal_received!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  interest_received!: number

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  balance!: number

  @Column({ type: 'timestamp' })
  start_date!: Date

  @Column({ type: 'timestamp', nullable: true })
  end_date!: Date | null

  @Column({ default: true })
  @IsBoolean({ message: 'El estado debe ser true o false' })
  is_active!: boolean

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @Column({ nullable: true })
  note!: string

  @ManyToOne(() => ReceivableGroup, group => group.receivables)
  @JoinColumn({ name: 'receivable_group_id', foreignKeyConstraintName: 'fk_receivables_group' })
  receivable_group!: ReceivableGroup | null

  @OneToMany(() => ReceivableCollection, collection => collection.receivable)
  collections!: ReceivableCollection[]

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'disbursement_account_id', foreignKeyConstraintName: 'fk_receivables_disbursement_account' })
  disbursement_account!: Account | null

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id', foreignKeyConstraintName: 'fk_receivables_category' })
  category!: Category | null

  @OneToOne(() => Transaction)
  @JoinColumn({ name: 'transaction_id', foreignKeyConstraintName: 'fk_receivables_transaction' })
  transaction!: Transaction

} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\ReceivableCollection.entity.ts
```
 
```ts
import { IsDate, IsNotEmpty, IsNumber } from 'class-validator'
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from 'typeorm'
import { DecimalTransformer } from '../config/typeorm-decimal.transformer'
import { Account } from './Account.entity'
import { Category } from './Category.entity'
import { Transaction } from './Transaction.entity'
import { Receivable } from './Receivable.entity'

@Entity('receivable_collections')
export class ReceivableCollection {

  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  collection_number!: number

  @ManyToOne(() => Receivable, receivable => receivable.collections)
  @JoinColumn({ name: 'receivable_id', foreignKeyConstraintName: 'fk_receivable_collections_receivable' })
  receivable!: Receivable

  @ManyToOne(() => Account, account => account.receivableCollections)
  @JoinColumn({ name: 'account_id', foreignKeyConstraintName: 'fk_receivable_collections_account' })
  @IsNotEmpty({ message: 'La cuenta es obligatoria' })
  account!: Account

  @ManyToOne(() => Transaction)
  @JoinColumn({ name: 'transaction_id', foreignKeyConstraintName: 'fk_receivable_collections_transaction' })
  transaction!: Transaction

  @IsNumber({}, { message: 'El monto debe ser numérico' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  principal_collected!: number

  @IsNumber({}, { message: 'El monto debe ser numérico' })
  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  interest_collected!: number

  @IsDate({ message: 'La fecha del cobro debe ser una fecha válida' })
  @Column({ type: 'timestamp' })
  collection_date!: Date

  @Column({ nullable: true })
  note!: string

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @ManyToOne(() => Category)
  @JoinColumn({ name: 'category_id', foreignKeyConstraintName: 'fk_receivable_collections_category' })
  category!: Category | null

} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\ReceivableGroup.entity.ts
```
 
```ts
import { IsNotEmpty } from 'class-validator'
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm'
import { User } from './User.entity'
import { Receivable } from './Receivable.entity'

@Entity('receivable_groups')
export class ReceivableGroup {

  @PrimaryGeneratedColumn()
  id!: number

  @Column()
  @IsNotEmpty({ message: 'El nombre del grupo es obligatorio' })
  name!: string

  @Column({ default: true })
  is_active!: boolean

  @OneToMany(() => Receivable, receivable => receivable.receivable_group)
  receivables!: Receivable[]

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_receivable_groups_user' })
  user!: User

} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\Transaction.entity.ts
```
 
```ts
import { Transform } from 'class-transformer'
import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, MaxLength, ValidateIf } from 'class-validator'
import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToOne, PrimaryGeneratedColumn } from 'typeorm'
import { DecimalTransformer } from '../config/typeorm-decimal.transformer'
import { Account } from './Account.entity'
import { Category } from './Category.entity'
import { Payable } from './Payable.entity'
import { PayablePayment } from './PayablePayment.entity'
import { User } from './User.entity'
import { Receivable } from './Receivable.entity'
import { ReceivableCollection } from './ReceivableCollection.entity'

@Entity('transactions')
export class Transaction {

  @PrimaryGeneratedColumn()
  id!: number

  @ManyToOne(() => User, user => user.transactions)
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_transactions_user' })
  user!: User

  @Column({ type: 'varchar' })
  @IsIn(['income', 'expense', 'transfer'], {
    message: 'Tipo de transacción inválido'
  })
  type!: 'income' | 'expense' | 'transfer'

  @Column({ type: 'varchar', nullable: true })
  @IsOptional()
  @IsIn(['income', 'expense', 'income_for_payable', 'payment_for_payable', 'saving', 'withdrawal', 'transfer'], {
    message: 'Tipo de transacción detallado inválido'
  })
  detailed_type?: 'income' | 'expense' | 'income_for_payable' | 'payment_for_payable' | 'saving' | 'withdrawal' | 'transfer' | null

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'account_id', foreignKeyConstraintName: 'fk_transactions_account' })
  @IsNotEmpty({ message: 'La cuenta es obligatoria' })
  account!: Account | null

  @ManyToOne(() => Account, { nullable: true })
  @JoinColumn({ name: 'to_account_id', foreignKeyConstraintName: 'fk_transactions_to_account' })
  @ValidateIf(t => t.type === 'transfer')
  @IsNotEmpty({ message: 'La cuenta destino es obligatoria' })
  to_account!: Account | null

  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'category_id', foreignKeyConstraintName: 'fk_transactions_categories' })
  @ValidateIf(t => t.type !== 'transfer')
  @IsNotEmpty({ message: 'La categoría es obligatoria' })
  category!: Category | null

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, transformer: DecimalTransformer })
  @IsNumber({}, { message: 'El monto debe ser numérico' })
  @IsPositive({ message: 'El monto debe ser mayor a cero' })
  amount!: number

  @Column({ type: 'timestamp' })
  @Transform(({ value }) => value ? new Date(value) : new Date())
  date!: Date

  @Column({ default: '', length: 1000 })
  @IsNotEmpty({ message: 'La descripción es obligatoria' })
  @MaxLength(1000, { message: 'Máximo 1000 caracteres' })
  description!: string

  @OneToOne(() => Payable, payable => payable.transaction, { nullable: true })
  payable!: Payable

  @OneToOne(() => PayablePayment, payment => payment.transaction, { nullable: true })
  payable_payment!: PayablePayment | null

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @OneToOne(() => Receivable, receivable => receivable.transaction)
  receivable!: Receivable | null

  @OneToOne(() => ReceivableCollection, collection => collection.transaction)
  receivable_collection!: ReceivableCollection | null

}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\entities\User.entity.ts
```
 
```ts
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, Unique } from 'typeorm'
import { Account } from './Account.entity'
import { Category } from './Category.entity'
import { Payable } from './Payable.entity'
import { Transaction } from './Transaction.entity'
import { CategoryGroup } from './CategoryGroups.entity'
import { PayableGroup } from './PayableGroup.entity'
import { CacheKpiBalance } from './CacheKpiBalance.entity'
import { ReceivableGroup } from './ReceivableGroup.entity'
import { Receivable } from './Receivable.entity'

@Entity('users')
//@Unique('UQ_users_email', ['email'])
export class User {

  @PrimaryGeneratedColumn()
  id!: number

  @Column({ unique: true })
  email!: string

  @Column({ select: false })
  password_hash!: string

  @Column()
  name!: string

  @Column({ type: 'varchar', default: 'USER' })
  role!: 'ADMIN' | 'USER'

  @CreateDateColumn({ type: 'timestamp' })
  created_at!: Date

  @OneToMany(() => Account, account => account.user)
  accounts!: Account[]

  @OneToMany(() => Category, category => category.user)
  categories!: Category[]

  @OneToMany(() => Transaction, transaction => transaction.user)
  transactions!: Transaction[]

  @OneToMany(() => Payable, payable => payable.user)
  payables!: Payable[]

  @OneToMany(() => CategoryGroup, group => group.user)
  category_groups!: CategoryGroup[]

  @OneToMany(() => PayableGroup, group => group.user)
  payable_groups!: PayableGroup[]

  @OneToMany(() => CacheKpiBalance, cache => cache.user)
  cache_kpi_balances!: CacheKpiBalance[]

  @OneToMany(() => ReceivableGroup, group => group.user)
  receivable_groups!: ReceivableGroup[]

  @OneToMany(() => Receivable, receivable => receivable.user)
  receivables!: Receivable[]

}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\cache\cache-accounts.service.ts
```
 
```ts
import { performance } from 'perf_hooks';
import { AppDataSource } from "../config/typeorm.datasource";
import { Account } from "../entities/Account.entity";
import { AuthRequest } from "../types/auth-request";
import { cacheKeys } from "./cache-key.service";
import { cache } from "./cache.service";
import { logger } from '../utils/logger.util';

export type DTOAccount = {
    id: number
    name: string
    type: string
    balance: number
    is_active: boolean
    transaction_count: number
}

const getAccountsBase = async (user_id: number): Promise<Account[]> => {
    const cache_key = cacheKeys.accountsByUser(user_id)
    const cached_accounts = cache.get<Account[]>(cache_key)
    if (cached_accounts !== undefined) {
        return cached_accounts
    }
    const repo = AppDataSource.getRepository(Account)
    const accounts: Account[] = await repo.find({
        where: { user: { id: user_id } },
        order: { name: 'ASC' }
    })
    cache.set(cache_key, accounts)
    return accounts
}

export const getAccounts = async (auth_req: AuthRequest): Promise<Account[]> => {
    const user_id = auth_req.user.id
    const accounts: Account[] = await getAccountsBase(user_id)
    return accounts
}

export const getAccountById = async (auth_req: AuthRequest, account_id: number): Promise<Account | null> => {
    const user_id = auth_req.user.id
    const accounts = await getAccountsBase(user_id)
    const account = accounts.find(account => account.id === account_id)
    return account || null
}

export const getAccountByName = async (auth_req: AuthRequest, name: string): Promise<Account | null> => {
    const user_id = auth_req.user.id
    const accounts = await getAccountsBase(user_id)
    const account = accounts.find(account => account.name === name)
    return account || null
}

export const getAccountsForDisbursement = async (auth_req: AuthRequest): Promise<Account[]> => {
    const user_id = auth_req.user.id
    const accounts: Account[] = await getAccountsBase(user_id)
    const active_accounts_for_disbursement: Account[] = accounts.filter(account => ['cash', 'bank', 'card'].includes(account.type))
    return active_accounts_for_disbursement
}

export const getActiveAccountById = async (auth_req: AuthRequest, account_id: number): Promise<Account | null> => {
    const user_id = auth_req.user.id
    const accounts = await getAccountsBase(user_id)
    const account = accounts.find(account => account.id === account_id && account.is_active)
    return account || null
}

export const getActiveAccounts = async (auth_req: AuthRequest): Promise<Account[]> => {
    const user_id = auth_req.user.id
    const accounts: Account[] = await getAccountsBase(user_id)
    const active_accounts: Account[] = accounts.filter(account => account.is_active && account.balance >= 0 && ['cash', 'bank', 'card'].includes(account.type))
    return active_accounts
}

export const getActiveAccountsIncludeCurrentAccount = async (auth_req: AuthRequest, account_id?: number): Promise<Account[]> => {
    const user_id = auth_req.user.id
    const accounts: Account[] = await getAccountsBase(user_id)
    let active_accounts: Account[]
    if (account_id) {
        active_accounts = accounts.filter(account => (account.is_active && account.balance >= 0 && ['cash', 'bank', 'card'].includes(account.type)) || account.id === account_id)
    } else {
        active_accounts = accounts.filter(account => (account.is_active && account.balance >= 0 && ['cash', 'bank', 'card'].includes(account.type)))
    }
    return active_accounts
}

export const getActiveAccountsForTransfer = async (auth_req: AuthRequest): Promise<Account[]> => {
    const user_id = auth_req.user.id
    const accounts: Account[] = await getAccountsBase(user_id)
    const active_accounts_for_transfer: Account[] = accounts.filter(account => account.is_active && ['cash', 'bank', 'card', 'saving'].includes(account.type))
    return active_accounts_for_transfer
}

export const getActiveAccountsForTransferIncludeCurrentAccount = async (auth_req: AuthRequest, account_id?: number): Promise<Account[]> => {
    const user_id = auth_req.user.id
    const accounts: Account[] = await getAccountsBase(user_id)
    let active_accounts_for_transfer: Account[]
    if (account_id) {
        active_accounts_for_transfer = accounts.filter(account => (account.is_active && ['cash', 'bank', 'card', 'saving'].includes(account.type)) || account.id === account_id)
    } else {
        active_accounts_for_transfer = accounts.filter(account => account.is_active && ['cash', 'bank', 'card', 'saving'].includes(account.type))
    }
    return active_accounts_for_transfer
}

export const getActiveAccountsForDisbursement = async (auth_req: AuthRequest): Promise<Account[]> => {
    const user_id = auth_req.user.id
    const accounts: Account[] = await getAccountsBase(user_id)
    const active_accounts_for_disbursement: Account[] = accounts.filter(account => account.is_active && ['cash', 'bank', 'card'].includes(account.type))
    return active_accounts_for_disbursement
}

export const getAccountsForApi = async (auth_req: AuthRequest): Promise<DTOAccount[]> => {
    const user_id = auth_req.user.id
    const cache_key = cacheKeys.accountsByUserForApi(user_id)
    const cached_accounts = cache.get<DTOAccount[]>(cache_key)
    if (cached_accounts !== undefined) {
        return cached_accounts
    }
    const repository = AppDataSource.getRepository(Account)
    const start = performance.now()
    const result = await repository
        .createQueryBuilder('account')
        .where('account.user_id = :user_id', { user_id })
        .addSelect(subQuery =>
            subQuery
                .select('COUNT(t.id)')
                .from('transactions', 't')
                .where('t.account_id = account.id'),
            'transaction_count'
        )
        .orderBy('account.name', 'ASC')
        .getRawAndEntities()

    const accounts: DTOAccount[] = result.entities.map((account, index) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        balance: account.balance,
        is_active: account.is_active,
        transaction_count: Number(result.raw[index].transaction_count)
    }))

    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`method=[${getAccountsForApi.name}], cacheKey=[${cache_key}], user=[${user_id}], entity=[account], count=[${accounts.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    cache.set(cache_key, accounts)
    return accounts
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\cache\cache-categories.service.ts
```
 
```ts
import { performance } from 'perf_hooks';
import { AppDataSource } from "../config/typeorm.datasource";
import { Category } from "../entities/Category.entity";
import { AuthRequest } from "../types/auth-request";
import { logger } from '../utils/logger.util';
import { cacheKeys } from "./cache-key.service";
import { cache } from "./cache.service";

export type DTOCategory = {
    id: number
    name: string
    type: 'income' | 'expense'
    type_for_loan: 'loan' | 'payment' | 'receivable' | 'collection' | null
    is_active: boolean
    category_group: { id: number, name: string } | null
    transactions_count: number
}

const getCategoriesBase = async (user_id: number): Promise<Category[]> => {
    const cache_key = cacheKeys.categoriesByUser(user_id)
    const cached_categories = cache.get<Category[]>(cache_key)
    if (cached_categories !== undefined) {
        return cached_categories
    }
    const repo = AppDataSource.getRepository(Category)
    const categories: Category[] = await repo.find({
        where: { user: { id: user_id } },
        relations: { category_group: true },
        order: { name: 'ASC' }
    })
    cache.set(cache_key, categories)
    return categories
}

export const getCategories = async (auth_req: AuthRequest): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    return categories
}

export const getCategoryById = async (auth_req: AuthRequest, category_id: number): Promise<Category | null> => {
    const user_id = auth_req.user.id
    const categories = await getCategoriesBase(user_id)
    const category = categories.find(category => category.id === category_id)
    return category || null
}

export const getCategoryByName = async (auth_req: AuthRequest, name: string): Promise<Category | null> => {
    const user_id = auth_req.user.id
    const categories = await getCategoriesBase(user_id)
    const category = categories.find(category => category.name.toLowerCase() === name.toLowerCase())
    return category || null
}

export const getActiveCategoryById = async (auth_req: AuthRequest, category_id: number): Promise<Category | null> => {
    const user_id = auth_req.user.id
    const categories = await getCategoriesBase(user_id)
    const category = categories.find(category => category.id === category_id && category.is_active)
    return category || null
}

export const getActiveCategories = async (auth_req: AuthRequest): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    const active_categories: Category[] = categories.filter(category => category.is_active)
    return active_categories
}

export const getActiveIncomeCategories = async (auth_req: AuthRequest): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    const active_income_categories: Category[] = categories.filter(category => category.is_active && category.type === 'income')
    return active_income_categories
}

export const getActiveIncomeCategoriesIncludeCurrentCategory = async (auth_req: AuthRequest, category_id?: number): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    let active_income_categories: Category[]
    if (category_id) {
        active_income_categories = categories.filter(category => (category.is_active && category.type === 'income') || category.id === category_id)
    } else {
        active_income_categories = categories.filter(category => (category.is_active && category.type === 'income'))
    }
    return active_income_categories
}

export const getActiveExpenseCategories = async (auth_req: AuthRequest): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    const active_expense_categories: Category[] = categories.filter(category => category.is_active && category.type === 'expense')
    return active_expense_categories
}

export const getActiveExpenseCategoriesIncludeCurrentCategory = async (auth_req: AuthRequest, category_id?: number): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    let active_expense_categories: Category[]
    if (category_id) {
        active_expense_categories = categories.filter(category => (category.is_active && category.type === 'expense') || category.id === category_id)
    } else {
        active_expense_categories = categories.filter(category => (category.is_active && category.type === 'expense'))
    }
    return active_expense_categories
}

export const getActiveLoanCategories = async (auth_req: AuthRequest): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    const active_loan_categories: Category[] = categories.filter(category => category.is_active && category.type_for_loan === 'loan')
    return active_loan_categories
}

export const getActivePaymentCategories = async (auth_req: AuthRequest): Promise<Category[]> => {
    const user_id = auth_req.user.id
    const categories: Category[] = await getCategoriesBase(user_id)
    const active_payment_categories: Category[] = categories.filter(category => category.is_active && category.type_for_loan === 'payment')
    return active_payment_categories
}

export const getCategoriesForApi = async (auth_req: AuthRequest): Promise<DTOCategory[]> => {
    const user_id = auth_req.user.id
    const cache_key = cacheKeys.categoriesByUserForApi(user_id)
    const cached_categories = cache.get<DTOCategory[]>(cache_key)
    if (cached_categories !== undefined) {
        return cached_categories
    }
    const repository = AppDataSource.getRepository(Category)
    const start = performance.now()
    const result = await repository
        .createQueryBuilder('category')
        .innerJoin('category.user', 'user')
        .innerJoinAndSelect('category.category_group', 'group')
        .where('user.id = :user_id', { user_id })
        .addSelect(subQuery =>
            subQuery
                .select('COUNT(t.id)')
                .from('transactions', 't')
                .where('t.category_id = category.id'),
            'transactions_count'
        )
        .orderBy('group.name', 'ASC')
        .addOrderBy('category.name', 'ASC')
        .getRawAndEntities()

    const categories: DTOCategory[] = result.entities.map((category, index) => ({
        id: category.id,
        name: category.name,
        type: category.type,
        type_for_loan: category.type_for_loan,
        is_active: category.is_active,
        category_group: category.category_group ? { id: category.category_group.id, name: category.category_group.name } : null,
        transactions_count: Number(result.raw[index].transactions_count)
    }))

    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`method=[${getCategoriesForApi.name}], cacheKey=[${cache_key}], user=[${user_id}], entity=[category], count=[${categories.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    cache.set(cache_key, categories)
    return categories
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\cache\cache-category-groups.service.ts
```
 
```ts
import { AppDataSource } from "../config/typeorm.datasource";
import { CategoryGroup } from "../entities/CategoryGroups.entity";
import { AuthRequest } from "../types/auth-request";
import { cacheKeys } from "./cache-key.service";
import { cache } from "./cache.service";


const getCategoryGroupBase = async (user_id: number): Promise<CategoryGroup[]> => {
    const cache_key = cacheKeys.categoryGroupByUser(user_id)
    const cached_category_group = cache.get<CategoryGroup[]>(cache_key)
    if (cached_category_group !== undefined) {
        return cached_category_group
    }
    const repo = AppDataSource.getRepository(CategoryGroup)
    const category_group: CategoryGroup[] = await repo.find({
        where: { user: { id: user_id } },
        order: { name: 'ASC' }
    })
    cache.set(cache_key, category_group)
    return category_group
}

export const getCategoryGroup = async (auth_req: AuthRequest): Promise<CategoryGroup[]> => {
    const user_id = auth_req.user.id
    const category_group: CategoryGroup[] = await getCategoryGroupBase(user_id)
    return category_group
}

export const getCategoryGroupById = async (auth_req: AuthRequest, category_group_id: number): Promise<CategoryGroup | null> => {
    const user_id = auth_req.user.id
    const category_groups = await getCategoryGroupBase(user_id)
    const category_group = category_groups.find(category_group => category_group.id === category_group_id)
    return category_group || null
}

export const getCategoryGroupByName = async (auth_req: AuthRequest, name: string): Promise<CategoryGroup | null> => {
    const user_id = auth_req.user.id
    const category_groups = await getCategoryGroupBase(user_id)
    const category_group = category_groups.find(category_group => category_group.name.toLowerCase() === name.toLowerCase())
    return category_group || null
}

export const getActiveCategoryGroupById = async (category_group_id: number, auth_req: AuthRequest): Promise<CategoryGroup | null> => {
    const user_id = auth_req.user.id
    const category_groups = await getCategoryGroupBase(user_id)
    const category_group = category_groups.find(category_group => category_group.id === category_group_id && category_group.is_active)
    return category_group || null
}

export const getActiveCategoryGroup = async (auth_req: AuthRequest): Promise<CategoryGroup[]> => {
    const user_id = auth_req.user.id
    const category_groups = await getCategoryGroupBase(user_id)
    const category_group = category_groups.filter(category_group => category_group.is_active)
    return category_group
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\cache\cache-home.service.ts
```
 
```ts
import { performance } from 'perf_hooks';
import { AppDataSource } from "../config/typeorm.datasource";
import { CacheKpiBalance } from "../entities/CacheKpiBalance.entity";
import { AuthRequest } from "../types/auth-request";
import { logger } from '../utils/logger.util';
import { cacheKeys } from "./cache-key.service";
import { cache } from "./cache.service";

type CashFlowSummary = {
  labels: string[]
  total_inflows: number[]
  total_outflows: number[]
  net_cash_flow: number[]
}

type LoanFlowSummary = {
  labels: string[]
  total_loans: number[]
  total_payments: number[]
  net_balance: number[]
}

const base_kpi = {
  incomes: 0,
  expenses: 0,
  loans: 0,
  payments: 0,
  savings: 0,
  withdrawals: 0,
  total_inflows: 0,
  total_outflows: 0,
  net_cash_flow: 0,
  net_savings: 0,
  available_balance: 0,
  principal_breakdown: 0,
  interest_breakdown: 0,
  is_populate: 0
}

type KpiBalance = typeof base_kpi

type TrendValue = {
  diff: number
  percent: number
  direction: 'up' | 'down' | 'equal'
} | null

type KpiTrend = {
  [K in keyof KpiBalance]: TrendValue
}

const buildAuthReq = (auth_req: AuthRequest, year: number, month: number): AuthRequest => {
  return {
    ...auth_req,
    query: {
      ...auth_req.query,
      year_period_for_kpi: year,
      month_period_for_kpi: month
    }
  } as unknown as AuthRequest
}

export const getHomeKpisCacheAccumulated = async (auth_req: AuthRequest): Promise<KpiBalance> => {
  const user_id = auth_req.user.id
  const year = Number(auth_req.query.year_period_for_kpi || 0)
  const month = Number(auth_req.query.month_period_for_kpi || 0)
  const cache_key = cacheKeys.homeBalanceKpiAccum(user_id, year, month)
  const cached = cache.get<KpiBalance>(cache_key)
  if (cached !== undefined) return cached
  const years = await getHomeAvailableYearsKpiCache(auth_req)
  const real_years = years.filter(y => y !== 0)
  if (!real_years.length) {
    cache.set(cache_key, base_kpi)
    return base_kpi
  }
  const base_year = Math.min(...real_years)
  const current = await getHomeBalanceKpiCache(auth_req)
  if (year <= base_year) {
    cache.set(cache_key, current)
    return current
  }
  const prev_req = buildAuthReq(auth_req, year - 1, 0)
  const prev: KpiBalance = await getHomeKpisCacheAccumulated(prev_req)
  const result: KpiBalance = {
    incomes: prev.incomes + current.incomes,
    expenses: prev.expenses + current.expenses,
    savings: prev.savings + current.savings,
    withdrawals: prev.withdrawals + current.withdrawals,
    loans: prev.loans + current.loans,
    payments: prev.payments + current.payments,
    total_inflows: prev.total_inflows + current.total_inflows,
    total_outflows: prev.total_outflows + current.total_outflows,
    net_cash_flow: prev.net_cash_flow + current.net_cash_flow,
    net_savings: prev.net_savings + current.net_savings,
    available_balance: prev.available_balance + current.available_balance,
    principal_breakdown: prev.principal_breakdown + current.principal_breakdown,
    interest_breakdown: prev.interest_breakdown + current.interest_breakdown,
    is_populate: 1
  }
  cache.set(cache_key, result)
  return result
}
const calcTrend = (current: number, previous: number): TrendValue => {
  if (previous === 0) return null
  const diff = Number((current - previous).toFixed(2))
  const percent = Number(((diff / previous) * 100).toFixed(2))
  return {
    diff,
    percent,
    direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'equal'
  }
}

const calcTrendObject = (current: KpiBalance, previous: KpiBalance): KpiTrend => {
  const result = {} as KpiTrend
  for (const key in current) {
    if (key === 'is_populate') continue
    const curr = current[key as keyof KpiBalance]
    const prev = previous[key as keyof KpiBalance]
    result[key as keyof KpiBalance] = calcTrend(curr, prev)
  }
  return result
}

/********************************************************************************************
 * ******************************************************************************************
 *******************************************************************************************/
export const getHomeAvailableYearsKpiCache = async (auth_req: AuthRequest): Promise<number[]> => {
  const user_id = auth_req.user.id
  const cache_key = cacheKeys.homeAvailableYearsKpi(user_id)
  const cached_available_kpi_years = cache.get<number[]>(cache_key)
  if (cached_available_kpi_years !== undefined) return cached_available_kpi_years
  const repo = AppDataSource.getRepository(CacheKpiBalance)
  const start = performance.now()
  const rows = await repo.createQueryBuilder('k')
    .select('DISTINCT k.period_year', 'year')
    .where('k.user_id = :user_id', { user_id })
    .orderBy('k.period_year', 'DESC')
    .getRawMany()
  const end = performance.now()
  const duration_sec = (end - start) / 1000
  logger.debug(`method=[${getHomeAvailableYearsKpiCache.name}], cacheKey=[${cache_key}], user=[${user_id}], entity=[cache-kpi-balance], count=[${rows.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)
  const years = rows.map(r => Number(r.year))
  const f_year = [0, ...years]
  logger.info(`${getHomeAvailableYearsKpiCache.name}. Años disponibles: `, { f_year })
  cache.set(cache_key, f_year)
  return f_year
}

export const getHomeBalanceKpiCache = async (auth_req: AuthRequest): Promise<KpiBalance> => {
  const user_id = auth_req.user.id
  const year_period_for_kpi = Number(auth_req.query.year_period_for_kpi || 0)
  const month_period_for_kpi = Number(auth_req.query.month_period_for_kpi || 0)
  const cache_key = cacheKeys.homeBalanceKpi(user_id, year_period_for_kpi, month_period_for_kpi)
  const cached = cache.get<KpiBalance>(cache_key)
  if (cached !== undefined) return cached
  const repo = AppDataSource.getRepository(CacheKpiBalance)
  const start = performance.now()
  const qb = repo.createQueryBuilder('k').where('k.user_id = :user_id', { user_id })
  if (year_period_for_kpi > 0) qb.andWhere('k.period_year = :year', { year: year_period_for_kpi })
  if (year_period_for_kpi > 0 && month_period_for_kpi > 0) qb.andWhere('k.period_month = :month', { month: month_period_for_kpi })
  const rows = await qb.getMany()
  const end = performance.now()
  const duration_sec = (end - start) / 1000
  logger.debug(`method=[${getHomeBalanceKpiCache.name}], cacheKey=[${cache_key}], user=[${user_id}], entity=[cache-kpi-balance], count=[${rows.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)
  if (!rows.length) return base_kpi

  logger.debug('HOME_KPI_ROWS', rows.map(row => ({ year: row.period_year, month: row.period_month, available_balance: row.available_balance })))
  const result: KpiBalance = rows.reduce((acc, row) => {
    acc.incomes += Number(row.incomes)
    acc.expenses += Number(row.expenses)
    acc.savings += Number(row.savings)
    acc.withdrawals += Number(row.withdrawals)
    acc.loans += Number(row.loans)
    acc.payments += Number(row.payments)
    acc.total_inflows += Number(row.total_inflows)
    acc.total_outflows += Number(row.total_outflows)
    acc.net_cash_flow += Number(row.net_cash_flow)
    acc.net_savings += Number(row.net_savings)
    acc.available_balance += Number(row.available_balance)
    acc.principal_breakdown += Number(row.principal_breakdown)
    acc.interest_breakdown += Number(row.interest_breakdown)
    acc.is_populate = 1
    return acc
  }, { ...base_kpi })
  logger.info(`${getHomeBalanceKpiCache.name}. `, { year_period_for_kpi, available_balance: result.available_balance })
  cache.set(cache_key, result)
  return result
}

export const getHomeTrendKpiCache = async (auth_req: AuthRequest) => {
  const user_id = auth_req.user.id
  const year = Number(auth_req.query.year_period_for_kpi || 0)
  const month = Number(auth_req.query.month_period_for_kpi || 0)
  if (year === 0) {
    return { current: base_kpi, previous: null, trend: null }
  }
  const cache_key = cacheKeys.homeTrendKpi(user_id, year, month)
  const cached = cache.get(cache_key)
  if (cached !== undefined) return cached
  const years = await getHomeAvailableYearsKpiCache(auth_req)
  const real_years = years.filter(y => y !== 0)
  if (!real_years.length) {
    const result = { current: base_kpi, previous: null, trend: null }
    cache.set(cache_key, result)
    return result
  }
  const base_year = Math.min(...real_years)
  const current = await getHomeBalanceKpiCache(auth_req)
  if (year <= base_year) {
    const result = { current, previous: null, trend: null }
    cache.set(cache_key, result)
    return result
  }
  const prev_req = buildAuthReq(auth_req, year - 1, 0)
  const previous: KpiBalance = await getHomeBalanceKpiCache(prev_req)
  const trend = calcTrendObject(current, previous)
  const result = { current, previous, trend }
  cache.set(cache_key, result)
  return result
}

export const getHomeCashFlowSummaryCache = async (auth_req: AuthRequest): Promise<CashFlowSummary> => {
  const user_id = auth_req.user.id
  const year = Number(auth_req.query.year_period_for_cash_summ || 0)

  const cache_key = cacheKeys.homeCashFlowSummary(user_id, year)
  const cached = cache.get<CashFlowSummary>(cache_key)
  if (cached !== undefined) return cached

  const labels: string[] = []
  const total_inflows: number[] = []
  const total_outflows: number[] = []
  const net_cash_flow: number[] = []

  let available_years = cache.get<number[]>(cacheKeys.homeAvailableYearsKpi(user_id)) || []
  available_years.sort((a, b) => a - b)

  if (year === 0) {
    for (const y of available_years) {
      if (y === 0) continue
      let inflows = 0
      let outflows = 0
      let net = 0

      for (let month = 1; month <= 12; month++) {
        const kpi_key = cacheKeys.homeBalanceKpi(user_id, y, month)
        let kpi = cache.get<KpiBalance>(kpi_key)

        if (!kpi) {
          const req = buildAuthReq(auth_req, y, month)
          kpi = await getHomeBalanceKpiCache(req)
          cache.set(kpi_key, kpi)
        }

        inflows += kpi?.total_inflows ?? 0
        outflows += kpi?.total_outflows ?? 0
        net += kpi?.net_cash_flow ?? 0
      }

      labels.push(String(y))
      total_inflows.push(inflows)
      total_outflows.push(outflows)
      net_cash_flow.push(net)
    }
  } else {
    const month_labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

    for (let month = 1; month <= 12; month++) {
      const kpi_key = cacheKeys.homeBalanceKpi(user_id, year, month)
      const kpi = cache.get<KpiBalance>(kpi_key)

      labels.push(month_labels[month - 1])
      total_inflows.push(kpi?.total_inflows ?? 0)
      total_outflows.push(kpi?.total_outflows ?? 0)
      net_cash_flow.push(kpi?.net_cash_flow ?? 0)
    }
  }

  const result: CashFlowSummary = {
    labels,
    total_inflows,
    total_outflows,
    net_cash_flow
  }

  cache.set(cache_key, result)
  return result
}

export const getHomeLoanFlowSummaryCache = async (auth_req: AuthRequest): Promise<LoanFlowSummary> => {
  const user_id = auth_req.user.id
  const year = Number(auth_req.query.year_period_for_loan_summ || 0)

  const cache_key = cacheKeys.homeLoanFlowSummary(user_id, year)
  const cached = cache.get<LoanFlowSummary>(cache_key)
  if (cached !== undefined) return cached

  const labels: string[] = []
  const total_loans: number[] = []
  const total_payments: number[] = []
  const net_balance: number[] = []

  let available_years = cache.get<number[]>(cacheKeys.homeAvailableYearsKpi(user_id)) || []
  available_years.sort((a, b) => a - b)

  if (year === 0) {
    for (const y of available_years) {
      if (y === 0) continue

      let loans = 0
      let payments = 0
      let net = 0

      for (let month = 1; month <= 12; month++) {
        const kpi_key = cacheKeys.homeBalanceKpi(user_id, y, month)
        let kpi = cache.get<KpiBalance>(kpi_key)

        if (!kpi) {
          const req = buildAuthReq(auth_req, y, month)
          kpi = await getHomeBalanceKpiCache(req)
          cache.set(kpi_key, kpi)
        }

        loans += kpi?.loans ?? 0
        payments += kpi?.payments ?? 0
        net += (kpi?.loans ?? 0) - (kpi?.payments ?? 0)
      }

      labels.push(String(y))
      total_loans.push(loans)
      total_payments.push(payments)
      net_balance.push(net)
    }
  } else {
    const month_labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

    for (let month = 1; month <= 12; month++) {
      const kpi_key = cacheKeys.homeBalanceKpi(user_id, year, month)
      const kpi = cache.get<KpiBalance>(kpi_key)

      labels.push(month_labels[month - 1])
      total_loans.push(kpi?.loans ?? 0)
      total_payments.push(kpi?.payments ?? 0)
      net_balance.push((kpi?.loans ?? 0) - (kpi?.payments ?? 0))
    }
  }

  const result: LoanFlowSummary = {
    labels,
    total_loans,
    total_payments,
    net_balance
  }

  cache.set(cache_key, result)
  return result
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\cache\cache-key.service.ts
```
 
```ts
import { AuthRequest } from "../types/auth-request"
import { logger } from "../utils/logger.util"
import { cache } from "./cache.service"

export type TypeSource = 'account' | 'category' | 'category_group' | 'payable' | 'payable_group' | 'payable_payment' | 'transaction' | 'home'

export const cacheKeys = {
  accountsByUser: (user_id: number) => `accounts_user_${user_id}`,
  accountsByUserForApi: (user_id: number) => `accounts_api_user_${user_id}`,

  categoriesByUser: (user_id: number) => `categories_user_${user_id}`,
  categoriesByUserForApi: (user_id: number) => `categories_api_user_${user_id}`,

  categoryGroupByUser: (user_id: number) => `category_group_user_${user_id}`,
  categoryGroupByUserForApi: (user_id: number) => `category_group_api_user_${user_id}`,

  payablesByUser: (user_id: number) => `payables_user_${user_id}`,
  payablesByUserForApi: (user_id: number) => `payables_api_user_${user_id}`,

  payableGroupByUser: (user_id: number) => `payable_group_user_${user_id}`,
  payableGroupByUserForApi: (user_id: number) => `payable_group_api_user_${user_id}`,

  paymentsByUser: (user_id: number) => `payment_user_${user_id}`,
  paymentsByUserForApi: (user_id: number) => `payment_api_user_${user_id}`,

  paymentsByPayment: (user_id: number, payment_id: number) => `payment_user_${user_id}_payment_${payment_id}`,
  paymentsByPayableForApi: (user_id: number, payable_id: number) => `payment_api_user_${user_id}_payable_${payable_id}`,
  paymentsByPayablePrefix: (user_id: number) => `payment_api_user_${user_id}_payable_`,

  homeAvailableYearsKpi: (user_id: number) => `home_available_years_kpi_user_${user_id}`,

  homeBalanceKpi: (user_id: number, year: number, month: number) => `home_balance_kpi_user_${user_id}_year_${year}_month_${month}`,
  homeBalanceKpiPrefix: (user_id: number) => `home_balance_kpi_user_${user_id}_`,

  homeCashFlowSummary: (user_id: number, year: number) => `home_cash_flow_summary_user_${user_id}_year_${year}`,
  homeCashFlowSummaryPrefix: (user_id: number) => `home_cash_flow_summary_user_${user_id}_year_`,

  homePayableFlowSummary: (user_id: number, year: number) => `home_payable_flow_summary_user_${user_id}_year_${year}`,
  homePayableFlowSummaryPrefix: (user_id: number) => `home_payable_flow_summary_user_${user_id}_year_`,

  homeTrendKpi: (user_id: number, year: number, month: number) => `home_kpis_trend_user_${user_id}_year_${year}_month_${month}`,
  homeTrendKpiPrefix: (user_id: number) => `home_kpis_trend_user_${user_id}_`,

  homeBalanceKpiAccum: (user_id: number, year: number, month: number) => `home_kpis_balance_accum_user_${user_id}_year_${year}_month_${month}`,
  homeBalanceKpiAccumPrefix: (user_id: number) => `home_kpis_balance_accum_user_${user_id}_`,

  allByUser: (user_id: number) => [
    `accounts_user_${user_id}`,
    `accounts_api_user_${user_id}`,
    `categories_user_${user_id}`,
    `categories_api_user_${user_id}`,
    `category_group_user_${user_id}`,
    `category_group_api_user_${user_id}`,
    `payables_user_${user_id}`,
    `payables_api_user_${user_id}`,
    `payable_group_user_${user_id}`,
    `payable_group_api_user_${user_id}`,
    `payment_user_${user_id}`,
    `payment_api_user_${user_id}`,
    `home_available_years_kpi_user_${user_id}`,
  ]
}

const delByPrefix = (prefix: string) => {
  const keys = cache.keys()
  const keys_to_delete = keys.filter(k => k.startsWith(prefix))
  return cache.del(keys_to_delete)
}

export const deleteAll = (auth_req: AuthRequest, source: TypeSource): void => {
  const user_id = auth_req.user.id
  const deleted = cache.del(cacheKeys.allByUser(user_id))
  const deleted_kpis = delByPrefix(cacheKeys.homeBalanceKpiPrefix(user_id))
  const deleted_payments = delByPrefix(cacheKeys.paymentsByPayablePrefix(user_id))
  const deleted_kpis_accum = delByPrefix(cacheKeys.homeBalanceKpiAccumPrefix(user_id))
  const deleted_trend = delByPrefix(cacheKeys.homeTrendKpiPrefix(user_id))
  const deleted_cash_flow_summary = delByPrefix(cacheKeys.homeCashFlowSummaryPrefix(user_id))
  const deleted_payable_flow_summary = delByPrefix(cacheKeys.homePayableFlowSummaryPrefix(user_id))
  logger.debug(`Delete Cache All. user=[${user_id}], keysDeleted=[${deleted}], kpisDeleted=[${deleted_kpis}], kpisAccumDeleted=[${deleted_kpis_accum}], trendDeleted=[${deleted_trend}], paymentsDeleted=[${deleted_payments}], cashFlowSummary=[${deleted_cash_flow_summary}], payableFlowSummary=[${deleted_payable_flow_summary}]`)
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\cache\cache-payable-groups.service.ts
```
 
```ts
import { AppDataSource } from "../config/typeorm.datasource";
import { PayableGroup } from "../entities/PayableGroup.entity";
import { AuthRequest } from "../types/auth-request";
import { cacheKeys } from "./cache-key.service";
import { cache } from "./cache.service";

const getPayableGroupBase = async (user_id: number): Promise<PayableGroup[]> => {
    const cache_key = cacheKeys.payableGroupByUser(user_id)
    const cached_payable_group = cache.get<PayableGroup[]>(cache_key)
    if (cached_payable_group !== undefined) {
        return cached_payable_group
    }
    const repo = AppDataSource.getRepository(PayableGroup)
    const payable_group: PayableGroup[] = await repo.find({
        where: { user: { id: user_id } },
        order: { name: 'ASC' }
    })
    cache.set(cache_key, payable_group)
    return payable_group
}

export const getPayableGroup = async (auth_req: AuthRequest): Promise<PayableGroup[]> => {
    const user_id = auth_req.user.id
    const payable_group: PayableGroup[] = await getPayableGroupBase(user_id)
    return payable_group
}

export const getPayableGroupById = async (auth_req: AuthRequest, payable_group_id: number): Promise<PayableGroup | null> => {
    const user_id = auth_req.user.id
    const payable_groups = await getPayableGroupBase(user_id)
    const payable_group = payable_groups.find(payable_group => payable_group.id === payable_group_id)
    return payable_group || null
}

export const getPayableGroupByName = async (auth_req: AuthRequest, name: string): Promise<PayableGroup | null> => {
    const user_id = auth_req.user.id
    const payable_groups = await getPayableGroupBase(user_id)
    const payable_group = payable_groups.find(payable_group => payable_group.name.toLowerCase() === name.toLowerCase())
    return payable_group || null
}

export const getActivePayableGroupById = async (auth_req: AuthRequest, payable_group_id: number): Promise<PayableGroup | null> => {
    const user_id = auth_req.user.id
    const payable_groups = await getPayableGroupBase(user_id)
    const payable_group = payable_groups.find(payable_group => payable_group.id === payable_group_id && payable_group.is_active)
    return payable_group || null
}

export const getActivePayableGroup = async (auth_req: AuthRequest): Promise<PayableGroup[]> => {
    const user_id = auth_req.user.id
    const payable_groups = await getPayableGroupBase(user_id)
    const payable_group = payable_groups.filter(payable_group => payable_group.is_active)
    return payable_group
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\cache\cache-payable-payments.service.ts
```
 
```ts
import { AppDataSource } from "../config/typeorm.datasource"
import { PayablePayment } from "../entities/PayablePayment.entity"
import { AuthRequest } from "../types/auth-request"
import { logger } from "../utils/logger.util"
import { cacheKeys } from "./cache-key.service"
import { cache } from "./cache.service"

export type DTOPayablePayment = {
    id: number
    payment_number: number
    principal_paid: number
    interest_paid: number
    payment_date: Date
    note: string | null
    created_at: Date
    account: { id: number, name: string } | null
    category: { id: number, name: string } | null
    payable: { id: number, name: string } | null
}

const getPaymentsBase = async (user_id: number): Promise<PayablePayment[]> => {
    const cache_key = cacheKeys.paymentsByUser(user_id)
    const cached_payments = cache.get<PayablePayment[]>(cache_key)
    if (cached_payments !== undefined) return cached_payments

    const repo = AppDataSource.getRepository(PayablePayment)
    const payments: PayablePayment[] = await repo.find({
        where: { payable: { user: { id: user_id } } },
        relations: { payable: true, category: true, account: true, transaction: true },
    })

    cache.set(cache_key, payments)
    return payments
}

export const getPayments = async (auth_req: AuthRequest): Promise<PayablePayment[]> => {
    const user_id = auth_req.user.id
    const payments: PayablePayment[] = await getPaymentsBase(user_id)
    return payments
}

export const getPaymentById = async (auth_req: AuthRequest, payment_id: number): Promise<PayablePayment | null> => {
    const user_id = auth_req.user.id
    const payments = await getPaymentsBase(user_id)
    const payment = payments.find(payment => payment.id === payment_id)
    return payment || null
}

export const getPaymentsForApi = async (auth_req: AuthRequest, payable_id: number): Promise<DTOPayablePayment[]> => {
    const user_id = auth_req.user.id
    const cache_key = cacheKeys.paymentsByPayableForApi(user_id, payable_id)

    const cached = cache.get<DTOPayablePayment[]>(cache_key)
    if (cached !== undefined) return cached

    const repo = AppDataSource.getRepository(PayablePayment)
    const start = performance.now()

    const result = await repo.find({
        where: { payable: { id: payable_id } },
        relations: { payable: true, account: true, category: true },
        order: { payment_date: 'DESC' }
    })

    const payments: DTOPayablePayment[] = result.map(p => ({
        id: p.id,
        payment_number: p.payment_number,
        principal_paid: p.principal_paid,
        interest_paid: p.interest_paid,
        payment_date: p.payment_date,
        note: p.note,
        created_at: p.created_at,
        account: p.account ? { id: p.account.id, name: p.account.name } : null,
        category: p.category ? { id: p.category.id, name: p.category.name } : null,
        payable: p.payable ? { id: p.payable.id, name: p.payable.name } : null
    }))

    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`method=[${getPaymentsForApi.name}], cacheKey=[${cache_key}], payable=[${payable_id}], user=[${user_id}], entity=[payable_payment], count=[${payments.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    cache.set(cache_key, payments)
    return payments
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\cache\cache-payables.service.ts
```
 
```ts
import { performance } from 'perf_hooks';
import { AppDataSource } from "../config/typeorm.datasource";
import { Payable } from "../entities/Payable.entity";
import { AuthRequest } from "../types/auth-request";
import { logger } from '../utils/logger.util';
import { cacheKeys } from "./cache-key.service";
import { cache } from "./cache.service";

type DTOPayable = {
    id: number
    name: string
    total_amount: number
    principal_paid: number
    interest_paid: number
    balance: number
    start_date: Date
    end_date: Date | null
    is_active: boolean
    created_at: Date
    note: string | null
    disbursement_account: { id: number, name: string } | null
    category: { id: number, name: string } | null
    payable_group: { id: number, name: string } | null
}

type DTOPayableGroupTotal = {
    payable_group_id: number
    payable_group_name: string
    total_balance: number
}

const getPayablesBase = async (user_id: number): Promise<Payable[]> => {
    const cache_key = cacheKeys.payablesByUser(user_id)
    const cached_payables = cache.get<Payable[]>(cache_key)
    if (cached_payables !== undefined) {
        return cached_payables
    }
    const repo = AppDataSource.getRepository(Payable)
    const payables: Payable[] = await repo.find({
        where: { user: { id: user_id } },
        relations: { payable_group: true, category: true, disbursement_account: true, transaction: true, payments: true },
        order: { name: 'ASC' }
    })
    cache.set(cache_key, payables)
    return payables
}

export const getPayables = async (auth_req: AuthRequest): Promise<Payable[]> => {
    const user_id = auth_req.user.id
    const payables: Payable[] = await getPayablesBase(user_id)
    return payables
}

export const getPayableById = async (auth_req: AuthRequest, payable_id: number): Promise<Payable | null> => {
    const user_id = auth_req.user.id
    const payables = await getPayablesBase(user_id)
    const payable = payables.find(payable => payable.id === payable_id)
    return payable || null
}

export const getPayableByName = async (auth_req: AuthRequest, name: string): Promise<Payable | null> => {
    const user_id = auth_req.user.id
    const payables = await getPayablesBase(user_id)
    const payable = payables.find(payable => payable.name.toLowerCase() === name.toLowerCase())
    return payable || null
}

export const getActivePayableById = async (auth_req: AuthRequest, payable_id: number): Promise<Payable | null> => {
    const user_id = auth_req.user.id
    const payables = await getPayablesBase(user_id)
    const payable = payables.find(payable => payable.id === payable_id && payable.is_active)
    return payable || null
}

export const getActivePayables = async (auth_req: AuthRequest): Promise<Payable[]> => {
    const user_id = auth_req.user.id
    const payables: Payable[] = await getPayablesBase(user_id)
    const active_payables: Payable[] = payables.filter(payable => payable.is_active)
    return active_payables
}

export const getInactivePayables = async (auth_req: AuthRequest): Promise<Payable[]> => {
    const user_id = auth_req.user.id
    const payables: Payable[] = await getPayablesBase(user_id)
    const inactive_payables: Payable[] = payables.filter(payable => !payable.is_active)
    return inactive_payables
}

export const getPayablesForApi = async (auth_req: AuthRequest): Promise<{ payables: DTOPayable[], group_totals: DTOPayableGroupTotal[] }> => {
    const user_id = auth_req.user.id
    const cache_key = cacheKeys.payablesByUserForApi(user_id)
    const cached_payables = cache.get<{ payables: DTOPayable[], group_totals: DTOPayableGroupTotal[] }>(cache_key)
    if (cached_payables !== undefined) {
        return cached_payables
    }

    const repository = AppDataSource.getRepository(Payable)
    const start = performance.now()
    const result = await repository
        .createQueryBuilder('payable')
        .leftJoinAndSelect('payable.payable_group', 'payable_group')
        .leftJoinAndSelect('payable.disbursement_account', 'disbursement_account')
        .leftJoinAndSelect('payable.category', 'category')
        .where('payable.user_id = :user_id', { user_id })
        .orderBy('payable_group.name', 'ASC')
        .addOrderBy('payable.name', 'ASC')
        .getMany()

    const payables: DTOPayable[] = result.map(payable => ({
        id: payable.id,
        name: payable.name,
        total_amount: payable.total_amount,
        principal_paid: payable.principal_paid,
        interest_paid: payable.interest_paid,
        balance: payable.balance,
        start_date: payable.start_date,
        end_date: payable.end_date,
        is_active: payable.is_active,
        created_at: payable.created_at,
        note: payable.note,
        disbursement_account: payable.disbursement_account ? { id: payable.disbursement_account.id, name: payable.disbursement_account.name } : null,
        category: payable.category ? { id: payable.category.id, name: payable.category.name } : null,
        payable_group: payable.payable_group ? { id: payable.payable_group.id, name: payable.payable_group.name } : null
    }))

    const group_totals_map: Record<number, DTOPayableGroupTotal> = {}

    for (const payable of result) {
        if (!payable.payable_group) continue
        const group_id = payable.payable_group.id

        if (!group_totals_map[group_id]) {
            group_totals_map[group_id] = {
                payable_group_id: group_id,
                payable_group_name: payable.payable_group.name,
                total_balance: 0
            }
        }

        group_totals_map[group_id].total_balance += Number(payable.balance)
    }

    const group_totals = Object.values(group_totals_map)
    const response = { payables, group_totals }
    
    const end = performance.now()
    const duration_sec = (end - start) / 1000
    logger.debug(`method=[${getPayablesForApi.name}], cacheKey=[${cache_key}], user=[${user_id}], entity=[payable], count=[${payables.length}], elapsedTime=[${duration_sec.toFixed(4)}]`)
    cache.set(cache_key, response)
    return response
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\cache\cache.service.ts
```
 
```ts
import NodeCache from 'node-cache'

export const cache = new NodeCache({
    stdTTL: 14400, // 4 horas
    checkperiod: 120 // 2 minutos
}) 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\services\account-balance.service.ts
```
 
```ts
import { AppDataSource } from '../config/typeorm.datasource'
import { Account } from '../entities/Account.entity'
import { logger } from '../utils/logger.util'

export class AccountBalanceService {

    static async getNetAvailableBalance(user_id: number): Promise<number> {
        const result = await AppDataSource
            .getRepository(Account)
            .createQueryBuilder('account')
            .select('COALESCE(SUM(account.balance), 0)', 'total')
            .where('account.user_id = :user_id', { user_id })
            .andWhere('account.is_active = :is_active', { is_active: true })
            .andWhere('account.type IN (:...types)', { types: ['cash', 'bank'] })
            .getRawOne()

        logger.info(`${AccountBalanceService.getNetAvailableBalance.name}. `, `Net available balance for user ${user_id}: ${result.total}`)
        return Number(result?.total ?? 0)
    }

}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\services\kpi-cache.service.ts
```
 
```ts
import { AppDataSource } from '../config/typeorm.datasource'
import { CacheKpiBalance } from '../entities/CacheKpiBalance.entity'
import { CacheKpiCategory } from '../entities/CacheKpiCategory.entity'
import { AuthRequest } from '../types/auth-request'
import { formatDateForInputLocal } from '../utils/date.util'
import { parseError } from '../utils/error.util'
import { logger } from '../utils/logger.util'

function money(n: number) {
  return Number(n.toFixed(2))
}

/* ============================
   QUERY BASE (ÚNICA FUENTE)
============================ */
const query_base = `
SELECT
  COALESCE(SUM(CASE WHEN COALESCE(NULLIF(t.detailed_type, ''), t.type) = 'income' THEN t.amount ELSE 0 END), 0) AS incomes,
  COALESCE(SUM(CASE WHEN COALESCE(NULLIF(t.detailed_type, ''), t.type) = 'expense' THEN t.amount ELSE 0 END), 0) AS expenses,
  COALESCE(SUM(CASE WHEN COALESCE(NULLIF(t.detailed_type, ''), t.type) = 'income_for_loan' THEN t.amount ELSE 0 END), 0) AS loans,
  COALESCE(SUM(CASE WHEN COALESCE(NULLIF(t.detailed_type, ''), t.type) = 'payment_for_loan' THEN t.amount ELSE 0 END), 0) AS payments,
  COALESCE(SUM(CASE WHEN COALESCE(NULLIF(t.detailed_type, ''), t.type) = 'saving' THEN t.amount ELSE 0 END), 0) AS savings,
  COALESCE(SUM(CASE WHEN COALESCE(NULLIF(t.detailed_type, ''), t.type) = 'withdrawal' THEN t.amount ELSE 0 END), 0) AS withdrawals
 FROM transactions t
WHERE t.user_id = ?
  AND (? IS NULL OR t.date >= ?)
  AND (? IS NULL OR t.date <  ?)
`

const category_query_base = `
SELECT
  cg.id AS category_group_id,
  c.id AS category_id,
  COALESCE(cg.name, '') AS cat_group_name,
  COALESCE(c.name, '') AS cat_name,
  SUM(t.amount) AS amount,
  COUNT(*) AS transaction_count
FROM transactions t
LEFT JOIN categories c ON c.id = t.category_id
LEFT JOIN category_groups cg ON cg.id = c.category_group_id
WHERE t.user_id = ?
  AND t.category_id IS NOT NULL
  AND (? IS NULL OR t.date >= ?)
  AND (? IS NULL OR t.date <  ?)
GROUP BY cg.id, cg.name, c.id, c.name
ORDER BY cg.name, c.name
`

export class KpiCacheService {


  /* ============================
   PARA RECALCULAR EL KPI DE BALANCE DEL MES ACTUAL Y TOTAL
  ============================ */
  private static async recalculateCurrMonthBalanceKPI(auth_req: AuthRequest, period_year: number, period_month: number) {

    const user_id = auth_req.user.id
    const timezone = auth_req.timezone || 'UTC'

    try {

      const start_local = new Date(period_year, period_month - 1, 1)
      const end_local = new Date(period_year, period_month, 1)


      const start_date = new Date(formatDateForInputLocal(start_local, timezone))
      const end_date = new Date(formatDateForInputLocal(end_local, timezone))

      logger.debug('KPI_DATE_RANGE', { user_id, period_year, period_month, timezone, start_local, end_local, start_date, end_date })

      const result = await AppDataSource.manager.query(query_base, [
        user_id,
        start_date, start_date,
        end_date, end_date
      ])



      if (!result?.length) return

      const r = result[0]

      logger.debug('KPI_QUERY_RESULT', { user_id, period_year, period_month, timezone, start_date, end_date, result: r })

      const incomes = Number(r.incomes || 0)
      const expenses = Number(r.expenses || 0)
      const loans = Number(r.loans || 0)
      const payments = Number(r.payments || 0)
      const savings = Number(r.savings || 0)
      const withdrawals = Number(r.withdrawals || 0)

      const total_inflows = money(incomes + loans)
      const total_outflows = money(expenses + payments)
      const net_cash_flow = money(total_inflows - total_outflows)
      const net_savings = money(savings - withdrawals)
      const available_balance = money(net_cash_flow - net_savings)

      const repo = AppDataSource.getRepository(CacheKpiBalance)

      const existing = await repo.findOne({
        where: { user: { id: user_id }, period_year, period_month },
        relations: ['user']
      })
      logger.debug('KPI_COMPARE', { period_year, period_month, old_available_balance: existing?.available_balance, old_incomes: existing?.incomes, old_expenses: existing?.expenses, old_loans: existing?.loans, old_payments: existing?.payments, old_savings: existing?.savings, old_withdrawals: existing?.withdrawals, new_available_balance: available_balance, new_incomes: incomes, new_expenses: expenses, new_loans: loans, new_payments: payments, new_savings: savings, new_withdrawals: withdrawals })

      const payload = {
        incomes,
        expenses,
        savings,
        withdrawals,
        loans,
        payments,
        total_inflows,
        total_outflows,
        net_cash_flow,
        net_savings,
        available_balance,
        principal_breakdown: 0,
        interest_breakdown: 0
      }
      logger.debug('KPI_MONTH_AFTER', { user_id, period_year, period_month, incomes, expenses, loans, payments, savings, withdrawals, available_balance })

      if (existing) {
        await repo.update({ id: existing.id }, payload)
      } else {
        await repo.insert({
          user: { id: user_id } as any,
          period_year,
          period_month,
          ...payload
        })
      }
      logger.debug('KPI_MONTH_BEFORE', { user_id, period_year, period_month, incomes, expenses, loans, payments, savings, withdrawals, available_balance })
      logger.info(`KPI MES recalculado user=${user_id} periodo=${period_month}/${period_year}`)

    } catch (error: any) {
      logger.error('Error recalculando KPI mes', parseError(error))
    }
  }

  private static async recalculateAllBalanceKPI(user_id: number, timezone: string) {

    try {

      const repo = AppDataSource.getRepository(CacheKpiBalance)

      await repo.delete({ user: { id: user_id } })

      const rows = await AppDataSource.manager.query(`
        SELECT DISTINCT YEAR(date) as year, MONTH(date) as month
        FROM transactions
        WHERE user_id = ?
      `, [user_id])

      for (const row of rows) {

        const year = Number(row.year)
        const month = Number(row.month)

        const start_local = new Date(year, month - 1, 1)
        const end_local = new Date(year, month, 1)

        const start_date = new Date(formatDateForInputLocal(start_local, timezone))
        const end_date = new Date(formatDateForInputLocal(end_local, timezone))

        const result = await AppDataSource.manager.query(query_base, [
          user_id,
          start_date, start_date,
          end_date, end_date
        ])

        if (!result?.length) continue

        const r = result[0]

        const incomes = Number(r.incomes || 0)
        const expenses = Number(r.expenses || 0)
        const loans = Number(r.loans || 0)
        const payments = Number(r.payments || 0)
        const savings = Number(r.savings || 0)
        const withdrawals = Number(r.withdrawals || 0)

        const total_inflows = money(incomes + loans)
        const total_outflows = money(expenses + payments)
        const net_cash_flow = money(total_inflows - total_outflows)
        const net_savings = money(savings - withdrawals)
        const available_balance = money(net_cash_flow - net_savings)

        await repo.insert({
          user: { id: user_id } as any,
          period_year: year,
          period_month: month,
          incomes,
          expenses,
          savings,
          withdrawals,
          loans,
          payments,
          total_inflows,
          total_outflows,
          net_cash_flow,
          net_savings,
          available_balance,
          principal_breakdown: 0,
          interest_breakdown: 0
        })
      }

      logger.info(`KPI FULL REBUILD user=${user_id}`)

    } catch (error) {
      logger.error('Error en recalculateAllBalanceKPI', parseError(error))
    }
  }

    static async recalculateBalanceKPIByTransaction(auth_req: AuthRequest, transaction: any) {
    logger.debug('recalculateBalanceKPIByTransaction', { trx_id: transaction.id, trx_date: transaction.date, trx_created_at: transaction.created_at, amount: transaction.amount, timezone: auth_req.timezone })

    const user_id = auth_req.user.id
    const timezone = auth_req.timezone || 'UTC'

    try {

      if (!transaction?.date) {
        logger.warn('recalculateBalanceKPIByTransaction sin transaction.date')
        return
      }

      const trx_utc = new Date(formatDateForInputLocal(transaction.date, timezone))
      const trx_year = trx_utc.getUTCFullYear()
      const trx_month = trx_utc.getUTCMonth() + 1

      const now_utc = new Date(formatDateForInputLocal(new Date(), timezone))
      const current_year = now_utc.getUTCFullYear()
      const current_month = now_utc.getUTCMonth() + 1

      const is_current_period = trx_year === current_year && trx_month === current_month

      logger.debug('KPI_PERIOD_RAW', { trx_id: transaction.id, trx_date: transaction.date })
      if (is_current_period) {
        await this.recalculateCurrMonthBalanceKPI(auth_req, trx_year, trx_month)
      } else {
        await this.recalculateAllBalanceKPI(user_id, timezone)
      }

      logger.debug('KPI recalculado por transacción', { trx_year, trx_month, current_year, current_month, is_current_period })
    } catch (error: any) {
      logger.error('Error en recalculateBalanceKPIByTransaction', parseError(error))
    }
  }

  /* ============================
  PARA RECALCULAR EL KPI DE CATEGORÍAS DEL MES ACTUAL Y TOTAL
  ============================ */
  private static async recalculateCurrMonthCategoryKPI(auth_req: AuthRequest, period_year: number, period_month: number) {
    const user_id = auth_req.user.id
    const timezone = auth_req.timezone || 'UTC'

    try {
      const start_local = new Date(period_year, period_month - 1, 1)
      const end_local = new Date(period_year, period_month, 1)

      const start_date = new Date(formatDateForInputLocal(start_local, timezone))
      const end_date = new Date(formatDateForInputLocal(end_local, timezone))

      const repo = AppDataSource.getRepository(CacheKpiCategory)

      await repo.delete({ user: { id: user_id }, year_period: period_year, month_period: period_month })

      const rows = await AppDataSource.manager.query(category_query_base, [
        user_id,
        start_date, start_date,
        end_date, end_date
      ])

      for (const row of rows) {
        await repo.insert({
          user: { id: user_id } as any,
          year_period: period_year,
          month_period: period_month,
          category_group: { id: Number(row.category_group_id) } as any,
          category: { id: Number(row.category_id) } as any,
          amount: Number(row.amount || 0),
          transaction_count: Number(row.transaction_count || 0)
        })
      }

      logger.info(`KPI CATEGORIAS MES recalculado user=${user_id} periodo=${period_month}/${period_year}`)
    } catch (error: any) {
      logger.error('Error recalculando KPI categorías mes', parseError(error))
    }
  }

  private static async recalculateAllCategoryKPI(user_id: number, timezone: string) {
    try {
      const repo = AppDataSource.getRepository(CacheKpiCategory)

      await repo.delete({ user: { id: user_id } })

      const rows = await AppDataSource.manager.query(`
        SELECT DISTINCT YEAR(date) as year, MONTH(date) as month
        FROM transactions
        WHERE user_id = ?
      `, [user_id])

      for (const row of rows) {
        const year = Number(row.year)
        const month = Number(row.month)

        const start_local = new Date(year, month - 1, 1)
        const end_local = new Date(year, month, 1)

        const start_date = new Date(formatDateForInputLocal(start_local, timezone))
        const end_date = new Date(formatDateForInputLocal(end_local, timezone))

        const category_rows = await AppDataSource.manager.query(category_query_base, [
          user_id,
          start_date, start_date,
          end_date, end_date
        ])

        for (const category_row of category_rows) {
          await repo.insert({
            user: { id: user_id } as any,
            year_period: year,
            month_period: month,
            category_group: { id: Number(category_row.category_group_id) } as any,
            category: { id: Number(category_row.category_id) } as any,
            amount: Number(category_row.amount || 0),
            transaction_count: Number(category_row.transaction_count || 0)
          })
        }
      }

      logger.info(`KPI CATEGORIAS FULL REBUILD user=${user_id}`)
    } catch (error) {
      logger.error('Error en recalculateAllCategoryKPI', parseError(error))
    }
  }

  static async recalculateCategoryKPIByTransaction(auth_req: AuthRequest, transaction: any) {
    logger.debug('recalculateCategoryKPIByTransaction', { trx_id: transaction.id, trx_date: transaction.date, timezone: auth_req.timezone })

    const user_id = auth_req.user.id
    const timezone = auth_req.timezone || 'UTC'

    try {
      if (!transaction?.date) {
        logger.warn('recalculateCategoryKPIByTransaction sin transaction.date')
        return
      }

      const trx_utc = new Date(formatDateForInputLocal(transaction.date, timezone))
      const trx_year = trx_utc.getUTCFullYear()
      const trx_month = trx_utc.getUTCMonth() + 1

      const now_utc = new Date(formatDateForInputLocal(new Date(), timezone))
      const current_year = now_utc.getUTCFullYear()
      const current_month = now_utc.getUTCMonth() + 1

      const is_current_period = trx_year === current_year && trx_month === current_month

      if (is_current_period) {
        await this.recalculateCurrMonthCategoryKPI(auth_req, trx_year, trx_month)
      } else {
        await this.recalculateAllCategoryKPI(user_id, timezone)
      }

      logger.debug('KPI CATEGORÍAS recalculado por transacción', { trx_year, trx_month, current_year, current_month, is_current_period })
    } catch (error: any) {
      logger.error('Error en recalculateCategoryKPIByTransaction', parseError(error))
    }
  }

}

 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\services\next-valid-trx-date.service.ts
```
 
```ts
import { DateTime } from "luxon"
import { AppDataSource } from "../config/typeorm.datasource"
import { Transaction } from "../entities/Transaction.entity"
import { AuthRequest } from "../types/auth-request"

export const getNextValidTransactionDate = async (auth_req: AuthRequest): Promise<Date> => {

    const user_id = auth_req.user.id
    const timezone = auth_req.timezone ?? 'UTC'
    const now_utc = DateTime.utc()
    const now_local = now_utc.setZone(timezone)
    const start_of_day_utc = now_local.startOf('day').toUTC().toJSDate()
    const end_of_day_utc = now_local.endOf('day').toUTC().toJSDate()

    const last_transaction = await AppDataSource
        .getRepository(Transaction)
        .createQueryBuilder('t')
        .where('t.user_id = :user_id', { user_id })
        .andWhere('t.date BETWEEN :start AND :end', { start: start_of_day_utc, end: end_of_day_utc })
        .orderBy('t.date', 'DESC')
        .getOne()

    if (!last_transaction?.date) return now_utc.toJSDate()

    const last_transaction_utc = DateTime.fromJSDate(last_transaction.date, { zone: 'utc' })
    const remainder = last_transaction_utc.minute % 5
    const increment = remainder === 0 ? 5 : 5 - remainder
    const next_valid_utc = last_transaction_utc.plus({ minutes: increment }).set({ second: 0, millisecond: 0 })
    
    if (next_valid_utc < now_utc) return now_utc.set({ second: 0, millisecond: 0 }).toJSDate()

    return next_valid_utc.toJSDate()
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\services\payable-balance.service.ts
```
 
```ts
import { AppDataSource } from '../config/typeorm.datasource'
import { Payable } from '../entities/Payable.entity'

export class PayableBalanceService {

  static async getPendingPayableBalance(user_id: number): Promise<number> {
    const result = await AppDataSource
      .getRepository(Payable)
      .createQueryBuilder('payable')
      .select('COALESCE(SUM(payable.balance), 0)', 'total')
      .where('payable.user_id = :user_id', { user_id })
      .andWhere('payable.is_active = :is_active', { is_active: true })
      .getRawOne()

    return Number(result?.total ?? 0)
  }

}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\services\payable-payment-number.service.ts
```
 
```ts
import { AppDataSource } from "../config/typeorm.datasource"
import { PayablePayment } from "../entities/PayablePayment.entity"

/* =========================================================
Obtener siguiente número de pago para un préstamo
========================================================= */

export const getNextPayablePaymentNumber = async (payable_id: number): Promise<number> => {

  const last_payment = await AppDataSource
    .getRepository(PayablePayment)
    .createQueryBuilder('p')
    .where('p.payable_id = :payable_id', { payable_id })
    .andWhere('p.payment_number > 0')
    .orderBy('p.payment_number', 'DESC')
    .getOne()

  if (!last_payment?.payment_number) return 1

  return last_payment.payment_number + 1
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\services\populate-items.service.ts
```
 
```ts
import { In, IsNull, MoreThanOrEqual, Not } from "typeorm"
import { AppDataSource } from "../config/typeorm.datasource"
import { Account } from "../entities/Account.entity"
import { PayableGroup } from "../entities/PayableGroup.entity"
import { AuthRequest } from "../types/auth-request"
import { Category } from "../entities/Category.entity"
import { CategoryGroup } from "../entities/CategoryGroups.entity"

export const getActiveParentLoansByUser = async (auth_req: AuthRequest): Promise<PayableGroup[]> => {
  const repo = AppDataSource.getRepository(PayableGroup)

  return await repo.find({
    where: {
      user: { id: auth_req.user.id },
      is_active: true
    },
    order: { name: 'ASC' }
  })
}

export const getActiveParentCategoriesByUser = async (auth_req: AuthRequest): Promise<CategoryGroup[]> => {
  const repo = AppDataSource.getRepository(CategoryGroup)

  return await repo.find({
    where: {
      user: { id: auth_req.user.id },
      is_active: true
    },
    order: { name: 'ASC' }
  })
}

export const getActiveAccountsByUser_Deprecated = async (authReq: AuthRequest): Promise<Account[]> => {
  const repo = AppDataSource.getRepository(Account)
  /* type!: 'cash' | 'bank' | 'card' | 'saving' */
  const accounts = await repo.find({
    where: {
      user: { id: authReq.user.id },
      is_active: true,
      balance: MoreThanOrEqual(0),
      type: In(['cash', 'bank', 'card'])
    },
    order: { name: 'ASC' }
  })
  return accounts
}

export const getActiveAccountsForTransferByUser_Deprecated = async (authReq: AuthRequest): Promise<Account[]> => {
  const repo = AppDataSource.getRepository(Account)
  const accounts = await repo.find({
    where: {
      user: { id: authReq.user.id },
      is_active: true,
      balance: MoreThanOrEqual(0),
    },
    order: { name: 'ASC' }
  })
  return accounts
}

export const getActiveCategoriesByUser_Deprecated = async (authReq: AuthRequest): Promise<Category[]> => {
  const repo = AppDataSource.getRepository(Category)
  const categories = await repo.find({
    where: {
      user: { id: authReq.user.id },
      is_active: true,
    },
    order: { name: 'ASC' }
  })
  return categories
}

export const getActiveCategoriesForLoansByUser = async (authReq: AuthRequest): Promise<Category[]> => {
  const repo = AppDataSource.getRepository(Category)
  const categories = await repo.find({
    where: {
      user: { id: authReq.user.id },
      is_active: true,
      type_for_loan: 'loan'
    },
    order: { name: 'ASC' }
  })
  return categories
}

export const getActiveCategoriesForPaymentsByUser = async (authReq: AuthRequest): Promise<Category[]> => {
  const repo = AppDataSource.getRepository(Category)
  const categories = await repo.find({
    where: {
      user: { id: authReq.user.id },
      is_active: true,
      type_for_loan: 'payment'
    },
    order: { name: 'ASC' }
  })
  return categories
} 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\services\send-2fa-mail.service.ts
```
 
```ts
import nodemailer from 'nodemailer'
import { logger } from '../utils/logger.util'
import { parseError } from '../utils/error.util'

const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: process.env.MAIL_SECURE === 'true',
    auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
})

export async function send2FACodeMail(to: string, name: string, code: string): Promise<void> {
    try {
        await transporter.sendMail({
            from: process.env.MAIL_FROM,
            to,
            subject: 'Código de verificación (2FA)',
            text: `Hola ${name}, tu código de verificación es: ${code}`,
            html: `
        <p>Hola <strong>${name}</strong>,</p>
        <p>Tu código de verificación es:</p>
        <h2>${code}</h2>
        <p>Este código expira en 10 minutos.</p>
        <p>Favor no responder a este correo.</p>
      `
        })
    } catch (error) {
        logger.error('[MAIL] Error enviando correo 2FA', parseError(error))
        throw error
    }
}
 
```
 
--- 
 
```text
FILE: C:\Users\Dell\Documents\Proyectos\ssrfinan\src\services\send-2fa.service.ts
```
 
```ts
import { IsNull } from 'typeorm'
import { AppDataSource } from '../config/typeorm.datasource'
import { AuthCode } from '../entities/AuthCode.entity'
import { User } from '../entities/User.entity'
import { generateNumericCode, hashCode } from '../utils/auth-code.util'
import { logger } from '../utils/logger.util'
import { send2FACodeMail } from './send-2fa-mail.service'

export async function send2FACode(user: User): Promise<void> {
    const repo = AppDataSource.getRepository(AuthCode)

    await repo.delete({ user: { id: user.id }, used_at: IsNull() })

    const code = generateNumericCode(6)
    const codeHash = await hashCode(code)

    const expires = new Date()
    expires.setMinutes(expires.getMinutes() + 10)

    const authCode = repo.create({ user, code_hash: codeHash, expires_at: expires })

    await repo.save(authCode)
    await send2FACodeMail(user.email, user.name, code)
    logger.info(`[2FA] Código enviado por correo a [${user.email}], codigo: [${code}]`)
}
 
```
 
