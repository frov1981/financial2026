"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountsPage = exports.updateAccountStatusFormPage = exports.updateAccountFormPage = exports.insertAccountFormPage = exports.recalculateBalancesAPI = exports.listAccountsAPI = exports.saveAccount = void 0;
const datasource_1 = require("../config/datasource");
const Account_entity_1 = require("../entities/Account.entity");
const logger_util_1 = require("../utils/logger.util");
const account_controller_auxiliar_1 = require("./account.controller.auxiliar");
var account_controller_saving_1 = require("./account.controller.saving");
Object.defineProperty(exports, "saveAccount", { enumerable: true, get: function () { return account_controller_saving_1.saveAccount; } });
const listAccountsAPI = async (req, res) => {
    const authReq = req;
    try {
        const accounts = await datasource_1.AppDataSource.getRepository(Account_entity_1.Account).find({
            where: { user: { id: authReq.user.id } },
            order: { name: 'ASC' }
        });
        res.json(accounts);
    }
    catch (err) {
        logger_util_1.logger.error('Error al listar cuentas:', err);
        res.status(500).json({ error: 'Error al listar cuentas' });
    }
};
exports.listAccountsAPI = listAccountsAPI;
const recalculateBalancesAPI = async (req, res) => {
    try {
        const authReq = req;
        await (0, account_controller_auxiliar_1.recalculateAllAccountBalances)(authReq);
        res.json({
            success: true,
            message: 'Balances recalculados correctamente'
        });
    }
    catch (error) {
        logger_util_1.logger.error('Error al recalcular balances', error);
        res.status(500).json({
            success: false,
            message: 'Error al recalcular balances'
        });
    }
};
exports.recalculateBalancesAPI = recalculateBalancesAPI;
const insertAccountFormPage = async (req, res) => {
    const authReq = req;
    const mode = 'insert';
    res.render('layouts/main', {
        title: 'Nueva Cuenta',
        view: 'pages/accounts/form',
        account: {},
        errors: {},
        mode,
    });
};
exports.insertAccountFormPage = insertAccountFormPage;
const updateAccountFormPage = async (req, res) => {
    const authReq = req;
    const txId = Number(req.params.id);
    const mode = 'update';
    const repo = datasource_1.AppDataSource.getRepository(Account_entity_1.Account);
    const tx = await repo.findOne({
        where: { id: txId, user: { id: authReq.user.id } },
    });
    if (!tx) {
        return res.redirect('/accounts');
    }
    res.render('layouts/main', {
        title: 'Editar Cuenta',
        view: 'pages/accounts/form',
        account: {
            id: tx.id,
            type: tx.type,
            name: tx.name
        },
        errors: {},
        mode
    });
};
exports.updateAccountFormPage = updateAccountFormPage;
const updateAccountStatusFormPage = async (req, res) => {
    const authReq = req;
    const txId = Number(req.params.id);
    const mode = 'status';
    const repo = datasource_1.AppDataSource.getRepository(Account_entity_1.Account);
    const tx = await repo.findOne({
        where: { id: txId, user: { id: authReq.user.id } },
    });
    if (!tx) {
        return res.redirect('/accounts');
    }
    res.render('layouts/main', {
        title: 'Editar Estado Cuenta',
        view: 'pages/accounts/form',
        account: {
            id: tx.id,
            type: tx.type,
            name: tx.name,
            is_active: tx.is_active
        },
        errors: {},
        mode
    });
};
exports.updateAccountStatusFormPage = updateAccountStatusFormPage;
const accountsPage = (req, res) => {
    const authReq = req;
    res.render('layouts/main', {
        title: 'Cuentas',
        view: 'pages/accounts/index',
        USER_ID: authReq.user?.id || 'guest'
    });
};
exports.accountsPage = accountsPage;
