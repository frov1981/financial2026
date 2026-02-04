import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { Account } from '../entities/Account.entity'
import { AuthCode } from '../entities/AuthCode.entity'
import { Category } from '../entities/category.entity'
import { Loan } from '../entities/Loan.entity'
import { LoanPayment } from '../entities/LoanPayment.entity'
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
  entities: [User, AuthCode, Account, Category, Loan, LoanPayment, Transaction],
  synchronize: false,
  timezone: 'Z',
  extra: {
    timezone: 'Z'
  },
  logging: process.env.DB_LOGGING === 'true' ? true : false,
  logger: new OneLineSqlLogger()
})

/*
-- CREATE USER 'ssr_user'@'localhost' IDENTIFIED BY '12345..';
-- GRANT ALL PRIVILEGES ON ssr_db.* TO 'ssr_user'@'localhost';
*/