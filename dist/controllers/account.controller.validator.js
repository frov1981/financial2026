"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAccount = void 0;
const class_validator_1 = require("class-validator");
const datasource_1 = require("../config/datasource");
const Account_entity_1 = require("../entities/Account.entity");
const logger_util_1 = require("../utils/logger.util");
const mapValidationErrors_validator_1 = require("../validators/mapValidationErrors.validator");
const validateAccount = async (account, authReq) => {
    const userId = authReq.user.id;
    const errors = await (0, class_validator_1.validate)(account);
    const fieldErrors = errors.length > 0 ? (0, mapValidationErrors_validator_1.mapValidationErrors)(errors) : {};
    if (account.id && account.is_active === false && Number(account.balance) !== 0) {
        fieldErrors.is_active = 'No se puede desactivar la cuenta si tiene un balance mayor a cero';
    }
    if (account.name && userId) {
        const repo = datasource_1.AppDataSource.getRepository(Account_entity_1.Account);
        const existing = await repo.findOne({
            where: {
                name: account.name,
                user: { id: userId }
            }
        });
        if (existing && existing.id !== account.id) {
            fieldErrors.name = 'Ya existe una cuenta con este nombre';
        }
    }
    logger_util_1.logger.warn(`Account validation`, { userId, fieldErrors });
    return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
};
exports.validateAccount = validateAccount;
