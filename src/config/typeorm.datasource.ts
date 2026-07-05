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
