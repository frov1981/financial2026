"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
require("dotenv/config");
const datasource_1 = require("../config/datasource");
const User_entity_1 = require("../entities/User.entity");
const Account_entity_1 = require("../entities/Account.entity");
const Category_entity_1 = require("../entities/Category.entity");
const Lender_entity_1 = require("../entities/Lender.entity");
const Loan_entity_1 = require("../entities/Loan.entity");
const Transaction_entity_1 = require("../entities/Transaction.entity");
const LoanPayment_entity_1 = require("../entities/LoanPayment.entity");
const logger_util_1 = require("../utils/logger.util");
function random(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randomDecemberDate() {
    return new Date(2024, 11, random(1, 31));
}
async function runSeed(ds) {
    const userRepo = ds.getRepository(User_entity_1.User);
    if (await userRepo.count() > 0) {
        logger_util_1.logger.info('Seed ya ejecutado. Abortando.');
        return;
    }
    const accountRepo = ds.getRepository(Account_entity_1.Account);
    const categoryRepo = ds.getRepository(Category_entity_1.Category);
    const lenderRepo = ds.getRepository(Lender_entity_1.Lender);
    const loanRepo = ds.getRepository(Loan_entity_1.Loan);
    const transactionRepo = ds.getRepository(Transaction_entity_1.Transaction);
    const loanPaymentRepo = ds.getRepository(LoanPayment_entity_1.LoanPayment);
    for (let u = 1; u <= 3; u++) {
        const user = await userRepo.save({
            email: `user${u}@demo.com`,
            name: `Usuario ${u}`,
            password_hash: 'hashed_password_demo'
        });
        // Inicializar cuentas con balances positivos (evitar saldos negativos en seed)
        const accounts = await accountRepo.save([
            { user, name: 'Efectivo', type: 'cash', balance: random(500, 3000) },
            { user, name: 'Banco', type: 'bank', balance: random(1000, 5000) },
            { user, name: 'Tarjeta', type: 'card', balance: random(200, 2000) }
        ]);
        const categories = await categoryRepo.save([
            { user, name: 'Salario', type: 'income', parent: null },
            { user, name: 'Alimentación', type: 'expense', parent: null },
            { user, name: 'Transporte', type: 'expense', parent: null },
            { user, name: 'Pago préstamo', type: 'expense', parent: null }
        ].slice(0, random(3, 5)));
        const lender = await lenderRepo.save({
            user,
            name: 'Banco Central',
            type: 'bank'
        });
        const loans = [];
        for (let i = 1; i <= random(3, 5); i++) {
            const total = random(3000, 10000);
            const loan = await loanRepo.save({
                user,
                lender,
                name: `Préstamo ${i}`,
                loan_number: `LN-${u}-${i}`,
                total_amount: total,
                balance: total,
                interest_rate: 12.5,
                start_date: randomDecemberDate(),
                status: 'active'
            });
            loans.push(loan);
        }
        const txCount = random(20, 30);
        for (let t = 0; t < txCount; t++) {
            const isLoanPayment = Math.random() < 0.3 && loans.length > 0;
            if (isLoanPayment) {
                const loan = loans[random(0, loans.length - 1)];
                const principal = random(50, 200);
                const interest = random(10, 60);
                const tx = await transactionRepo.save({
                    user,
                    type: 'expense',
                    account: accounts[random(0, accounts.length - 1)],
                    category: categories.find(c => c.name === 'Pago préstamo') || null,
                    amount: principal + interest,
                    date: randomDecemberDate(),
                    description: 'Pago de préstamo'
                });
                await loanPaymentRepo.save({
                    loan,
                    account: tx.account,
                    transaction: tx,
                    principal_amount: principal,
                    interest_amount: interest,
                    payment_date: tx.date,
                    note: 'Pago mensual'
                });
                loan.balance = Number(loan.balance) - principal;
                if (loan.balance <= 0) {
                    loan.balance = 0;
                    loan.status = 'closed';
                }
                await loanRepo.save(loan);
            }
            else {
                // Seleccionar cuenta
                const accIndex = random(0, accounts.length - 1);
                const account = accounts[accIndex];
                // Decidir tipo (income/expense) pero asegurar consistencia con el balance
                let isIncome = Math.random() < 0.4;
                // Si la cuenta no tiene saldo y se escogió expense, convertir a income
                if (!isIncome && (!account.balance || Number(account.balance) <= 0)) {
                    isIncome = true;
                }
                // Determinar monto según regla: ingresos > 500, egresos < 50
                let amount;
                if (isIncome) {
                    // ingresos mayores a 500
                    amount = random(501, 2000);
                }
                else {
                    // egresos menores a 50 (1..49) pero limitados por el balance actual
                    const desired = random(1, 49);
                    const maxAmount = Math.max(0, Math.floor(Number(account.balance)));
                    // si no hay suficiente balance convertir a ingreso
                    if (maxAmount <= 0) {
                        isIncome = true;
                        amount = random(501, 2000);
                    }
                    else {
                        amount = Math.min(desired, maxAmount);
                        if (amount <= 0)
                            amount = 1;
                    }
                }
                const savedTx = await transactionRepo.save({
                    user,
                    type: isIncome ? 'income' : 'expense',
                    account: account,
                    category: categories.find(c => c.type === (isIncome ? 'income' : 'expense')) || null,
                    amount: amount,
                    date: randomDecemberDate(),
                    description: 'Movimiento generado'
                });
                // Actualizar balance en memoria y en DB para mantener consistencia
                if (isIncome) {
                    account.balance = Number(account.balance) + amount;
                }
                else {
                    account.balance = Number(account.balance) - amount;
                    if (account.balance < 0)
                        account.balance = 0;
                }
                await accountRepo.update({ id: account.id }, { balance: account.balance });
            }
        }
    }
    logger_util_1.logger.info('Seed ejecutado correctamente');
}
datasource_1.AppDataSource.initialize()
    .then(runSeed)
    .finally(() => process.exit(0));
