"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveAccount = void 0;
const datasource_1 = require("../config/datasource");
const Account_entity_1 = require("../entities/Account.entity");
const logger_util_1 = require("../utils/logger.util");
const account_controller_validator_1 = require("./account.controller.validator");
const saveAccount = async (req, res) => {
    const authReq = req;
    const repo = datasource_1.AppDataSource.getRepository(Account_entity_1.Account);
    const txId = req.body.id ? Number(req.body.id) : req.params.id ? Number(req.params.id) : undefined;
    let tx;
    let mode;
    if (txId) {
        const existing = await repo.findOne({ where: { id: txId, user: { id: authReq.user.id } } });
        if (!existing) {
            return res.redirect('/accounts');
        }
        if (req.body.is_active !== undefined) {
            mode = 'status';
            existing.is_active = req.body.is_active === 'true';
        }
        else {
            mode = 'update';
            if (req.body.type) {
                existing.type = req.body.type;
            }
            if (req.body.name) {
                existing.name = req.body.name;
            }
        }
        tx = existing;
    }
    else {
        mode = 'insert';
        tx = repo.create({
            user: { id: authReq.user.id },
            type: req.body.type,
            name: req.body.name,
            is_active: true,
            balance: 0
        });
    }
    logger_util_1.logger.info(`Before saving account`, { userId: authReq.user.id, mode, tx });
    const errors = await (0, account_controller_validator_1.validateAccount)(tx, authReq);
    if (errors) {
        return res.render('layouts/main', {
            title: '',
            view: 'pages/accounts/form',
            account: {
                ...req.body,
                is_active: req.body.is_active === 'true' ? true : false
            },
            errors,
            mode,
        });
    }
    await repo.save(tx);
    logger_util_1.logger.info(`Account saved to database.`);
    res.redirect('/accounts');
};
exports.saveAccount = saveAccount;
