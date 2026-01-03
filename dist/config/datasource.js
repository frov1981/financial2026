"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
require("reflect-metadata");
const typeorm_1 = require("typeorm");
const User_entity_1 = require("../entities/User.entity");
const Account_entity_1 = require("../entities/Account.entity");
const Category_entity_1 = require("../entities/Category.entity");
const Lender_entity_1 = require("../entities/Lender.entity");
const Loan_entity_1 = require("../entities/Loan.entity");
const LoanPayment_entity_1 = require("../entities/LoanPayment.entity");
const Transaction_entity_1 = require("../entities/Transaction.entity");
const typeorm_logger_1 = require("./typeorm.logger");
exports.AppDataSource = new typeorm_1.DataSource({
    type: 'mysql',
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [User_entity_1.User, Account_entity_1.Account, Category_entity_1.Category, Lender_entity_1.Lender, Loan_entity_1.Loan, LoanPayment_entity_1.LoanPayment, Transaction_entity_1.Transaction],
    synchronize: true,
    logging: process.env.DB_LOGGING === 'true' ? true : false,
    logger: new typeorm_logger_1.OneLineSqlLogger()
});
/*
-- CREATE USER 'ssr_user'@'localhost' IDENTIFIED BY '12345..';
-- GRANT ALL PRIVILEGES ON ssr_db.* TO 'ssr_user'@'localhost';
*/ 
