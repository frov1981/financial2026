"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transactionsPage = exports.updateTransactionFormPage = exports.insertTransactionFormPage = exports.listTransactionsPaginatedAPI = exports.saveTransaction = void 0;
const datasource_1 = require("../config/datasource");
const Transaction_entity_1 = require("../entities/Transaction.entity");
const transaction_controller_auxiliar_1 = require("./transaction.controller.auxiliar");
const date_util_1 = require("../utils/date.util");
const logger_util_1 = require("../utils/logger.util");
var transaction_controller_saving_1 = require("./transaction.controller.saving");
Object.defineProperty(exports, "saveTransaction", { enumerable: true, get: function () { return transaction_controller_saving_1.saveTransaction; } });
const listTransactionsPaginatedAPI = async (req, res) => {
    try {
        const authReq = req;
        const page = Number(authReq.query.page) || 1;
        const limit = Number(authReq.query.limit) || 10;
        const search = authReq.query.search || '';
        const skip = (page - 1) * limit;
        const userId = authReq.user.id;
        const qb = datasource_1.AppDataSource
            .getRepository(Transaction_entity_1.Transaction)
            .createQueryBuilder('t')
            .leftJoinAndSelect('t.account', 'account')
            .leftJoinAndSelect('t.to_account', 'to_account')
            .leftJoinAndSelect('t.category', 'category')
            .where('t.user_id = :userId', { userId });
        if (search) {
            qb.andWhere(`(
          CASE LOWER(t.type) WHEN 'income' THEN 'ingresos' WHEN 'expense' THEN 'egresos' WHEN 'transfer' THEN 'transferencias' END LIKE :search OR
          CAST(t.amount AS CHAR) LIKE :search OR
          LOWER(account.name) LIKE :search OR
          LOWER(to_account.name) LIKE :search OR
          LOWER(category.name) LIKE :search OR
          LOWER(t.description) LIKE :search OR
          DATE_FORMAT(t.date, '%d/%m/%Y') LIKE :search OR
          DATE_FORMAT(t.date, '%Y-%m-%d') LIKE :search
        )`, { search: `%${search.toLowerCase()}%` });
        }
        const [items, total] = await qb
            .orderBy('t.date', 'DESC')
            .skip(skip)
            .take(limit)
            .getManyAndCount();
        res.json({ items, total, page, limit });
    }
    catch (error) {
        logger_util_1.logger.error('Error al listar transacciones:', error);
        res.status(500).json({ error: 'Error al listar transacciones' });
    }
};
exports.listTransactionsPaginatedAPI = listTransactionsPaginatedAPI;
const insertTransactionFormPage = async (req, res) => {
    const authReq = req;
    const defaultDate = await (0, transaction_controller_auxiliar_1.getNextValidTransactionDate)(authReq);
    const accounts = await (0, transaction_controller_auxiliar_1.getActiveAccountsByUser)(authReq);
    const categories = await (0, transaction_controller_auxiliar_1.getActiveCategoriesByUser)(authReq);
    const { incomeCategories, expenseCategories } = (0, transaction_controller_auxiliar_1.splitCategoriesByType)(categories);
    res.render('layouts/main', {
        title: 'Nueva Transacción',
        view: 'pages/transactions/form',
        transaction: {
            date: (0, date_util_1.formatDateForInputLocal)(defaultDate).slice(0, 16),
            amount: '0.00',
        },
        errors: {},
        accounts,
        incomeCategories,
        expenseCategories,
    });
};
exports.insertTransactionFormPage = insertTransactionFormPage;
const updateTransactionFormPage = async (req, res) => {
    const authReq = req;
    const txId = Number(req.params.id);
    const repo = datasource_1.AppDataSource.getRepository(Transaction_entity_1.Transaction);
    const tx = await repo.findOne({
        where: { id: txId, user: { id: authReq.user.id } },
        relations: ['account', 'to_account', 'category']
    });
    if (!tx) {
        return res.redirect('/transactions');
    }
    const accounts = await (0, transaction_controller_auxiliar_1.getActiveAccountsByUser)(authReq);
    const categories = await (0, transaction_controller_auxiliar_1.getActiveCategoriesByUser)(authReq);
    const { incomeCategories, expenseCategories } = (0, transaction_controller_auxiliar_1.splitCategoriesByType)(categories);
    res.render('layouts/main', {
        title: 'Editar Transacción',
        view: 'pages/transactions/form',
        transaction: {
            id: tx.id,
            type: tx.type,
            account_id: tx.account ? tx.account.id : '',
            account_name: tx.account ? tx.account.name : '',
            to_account_id: tx.to_account ? tx.to_account.id : '',
            to_account_name: tx.to_account ? tx.to_account.name : '',
            category_id: tx.category ? tx.category.id : '',
            category_name: tx.category ? tx.category.name : '',
            amount: Number(tx.amount),
            date: (0, date_util_1.formatDateForInputLocal)(tx.date).slice(0, 16),
            description: tx.description ?? ''
        },
        accounts,
        incomeCategories,
        expenseCategories,
        errors: {}
    });
};
exports.updateTransactionFormPage = updateTransactionFormPage;
const transactionsPage = (req, res) => {
    const authReq = req;
    res.render('layouts/main', {
        title: 'Transacciones',
        view: 'pages/transactions/index',
        incomeCategories: [],
        expenseCategories: [],
        USER_ID: authReq.user?.id || 'guest'
    });
};
exports.transactionsPage = transactionsPage;
