"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateTransaction = void 0;
const class_validator_1 = require("class-validator");
const datasource_1 = require("../config/datasource");
const Account_entity_1 = require("../entities/Account.entity");
const logger_util_1 = require("../utils/logger.util");
const validateTransaction = async (tx, authReq) => {
    const errors = await (0, class_validator_1.validate)(tx);
    const fieldErrors = {};
    if (errors.length > 0) {
        errors.forEach(err => {
            const message = err.constraints
                ? Object.values(err.constraints)[0]
                : err.children?.[0]?.constraints
                    ? Object.values(err.children[0].constraints)[0]
                    : null;
            if (!message)
                return;
            switch (err.property) {
                case 'account':
                    fieldErrors.account = message;
                    break;
                case 'to_account':
                    fieldErrors.to_account = message;
                    break;
                case 'description':
                    fieldErrors.description = message;
                    break;
                case 'category':
                    fieldErrors.category = message;
                    break;
                default:
                    fieldErrors._form = message;
            }
        });
    }
    // Validación: la fecha debe ser del mes en curso o posterior
    if (tx.date) {
        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        if (tx.date < startOfCurrentMonth) {
            fieldErrors.date = 'La fecha debe ser del mes en curso o posterior';
        }
    }
    // Validación: el monto debe ser mayor a cero
    if (tx.amount === undefined || tx.amount === null || Number(tx.amount) <= 0) {
        fieldErrors.amount = 'El monto debe ser mayor a cero';
    }
    // Validación: para egresos, la cuenta debe tener saldo disponible
    if (tx.type === 'expense') {
        if (!tx.account || !tx.account.id) {
            fieldErrors.account = 'Cuenta requerida para egreso';
        }
        else {
            const accRepo = datasource_1.AppDataSource.getRepository(Account_entity_1.Account);
            const acc = await accRepo.findOne({ where: { id: tx.account.id, user: { id: authReq.user.id } } });
            const accBalance = acc ? Number(acc.balance) : 0;
            if (accBalance <= 0) {
                fieldErrors.amount = 'No hay saldo disponible en la cuenta para realizar el egreso';
            }
            else if (Number(tx.amount) > accBalance) {
                fieldErrors.amount = 'Saldo insuficiente en la cuenta para este egreso';
            }
        }
    }
    // Validación: para transferencias, la cuenta origen debe tener saldo suficiente
    if (tx.type === 'transfer') {
        if (!tx.account || !tx.account.id) {
            fieldErrors.account = 'Cuenta origen requerida para transferencia';
        }
        if (!tx.to_account || !tx.to_account.id) {
            fieldErrors.to_account = 'Cuenta destino requerida para transferencia';
        }
        if (tx.account && tx.to_account && tx.account.id === tx.to_account.id) {
            fieldErrors.to_account = 'La cuenta destino debe ser distinta a la cuenta origen';
        }
        if (tx.account && tx.account.id) {
            const accRepo = datasource_1.AppDataSource.getRepository(Account_entity_1.Account);
            const acc = await accRepo.findOne({ where: { id: tx.account.id, user: { id: authReq.user.id } } });
            const accBalance = acc ? Number(acc.balance) : 0;
            if (accBalance <= 0) {
                fieldErrors.amount = 'No hay saldo disponible en la cuenta origen para realizar la transferencia';
            }
            else if (Number(tx.amount) > accBalance) {
                fieldErrors.amount = 'Saldo insuficiente en la cuenta origen para esta transferencia';
            }
        }
    }
    logger_util_1.logger.warn(`Transaction validation errors for user ${authReq.user.id}: ${JSON.stringify(fieldErrors)}`);
    return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
};
exports.validateTransaction = validateTransaction;
