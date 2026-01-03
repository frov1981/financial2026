"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveTransaction = void 0;
const datasource_1 = require("../config/datasource");
const Account_entity_1 = require("../entities/Account.entity");
const Transaction_entity_1 = require("../entities/Transaction.entity");
const logger_util_1 = require("../utils/logger.util");
const transaction_controller_auxiliar_1 = require("./transaction.controller.auxiliar");
const transaction_controller_validator_1 = require("./transaction.controller.validator");
const saveTransaction = async (req, res) => {
    const authReq = req;
    const repo = datasource_1.AppDataSource.getRepository(Transaction_entity_1.Transaction);
    const txId = req.body.id ? Number(req.body.id) : req.params.id ? Number(req.params.id) : undefined;
    const accounts = await (0, transaction_controller_auxiliar_1.getActiveAccountsByUser)(authReq);
    const categories = await (0, transaction_controller_auxiliar_1.getActiveCategoriesByUser)(authReq);
    const { incomeCategories, expenseCategories } = (0, transaction_controller_auxiliar_1.splitCategoriesByType)(categories);
    let tx;
    let mode;
    let prevType;
    let prevAmount;
    let prevAccountId;
    let prevToAccountId;
    if (txId) {
        mode = 'update';
        const existing = await repo.findOne({ where: { id: txId, user: { id: authReq.user.id } }, relations: ['account', 'to_account'] });
        if (!existing)
            return res.redirect('/transactions');
        // guardar valores previos para ajustar balances en caso de actualización
        prevType = existing.type;
        prevAmount = Number(existing.amount);
        prevAccountId = existing.account?.id;
        prevToAccountId = existing.to_account?.id;
        existing.type = req.body.type;
        if (req.body.account_id) {
            existing.account = { id: Number(req.body.account_id) };
        }
        if (req.body.to_account_id) {
            existing.to_account = { id: Number(req.body.to_account_id) };
        }
        if (req.body.category_id) {
            existing.category = { id: Number(req.body.category_id) };
        }
        if (req.body.date) {
            existing.date = new Date(req.body.date);
        }
        existing.amount = Number(req.body.amount);
        existing.description = req.body.description;
        tx = existing;
    }
    else {
        mode = 'insert';
        tx = repo.create({
            user: authReq.user,
            type: req.body.type,
            account: req.body.account_id ? { id: Number(req.body.account_id) } : undefined,
            to_account: req.body.to_account_id ? { id: Number(req.body.to_account_id) } : undefined,
            category: req.body.category_id ? { id: Number(req.body.category_id) } : undefined,
            amount: Number(req.body.amount),
            date: req.body.date ? new Date(req.body.date) : undefined,
            description: req.body.description
        });
    }
    /*Si es transferencia no debe enviar categoria*/
    if (tx.type === 'transfer') {
        tx.category = null;
    }
    logger_util_1.logger.info(`Before transaction for user ${authReq.user.id}: mode: ${mode}`);
    const errors = await (0, transaction_controller_validator_1.validateTransaction)(tx, authReq);
    if (errors) {
        const account = accounts.find(a => a.id === Number(req.body.account_id));
        const toAccount = accounts.find(a => a.id === Number(req.body.to_account_id));
        const category = categories.find(c => c.id === Number(req.body.category_id));
        return res.render('layouts/main', {
            title: mode === 'update' ? 'Editar Transacción' : 'Nueva Transacción',
            view: 'pages/transactions/form',
            transaction: {
                ...req.body,
                account_name: account?.name || '',
                to_account_name: toAccount?.name || '',
                category_name: category?.name || ''
            },
            errors,
            accounts,
            incomeCategories,
            expenseCategories,
            mode
        });
    }
    // Persistir transacción y ajustar balances dentro de una transacción DB
    const queryRunner = datasource_1.AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
        // Calcular deltas por cuenta: nuevo efecto - efecto previo
        const deltas = new Map();
        const addDelta = (accId, value) => {
            if (!accId || !value)
                return;
            const prev = deltas.get(accId) || 0;
            deltas.set(accId, prev + value);
        };
        if (mode === 'update') {
            const pAmt = prevAmount ?? 0;
            // efectos previos
            if (prevType === 'income' && prevAccountId)
                addDelta(prevAccountId, -pAmt);
            if (prevType === 'expense' && prevAccountId)
                addDelta(prevAccountId, +pAmt);
            if (prevType === 'transfer') {
                if (prevAccountId)
                    addDelta(prevAccountId, +pAmt);
                if (prevToAccountId)
                    addDelta(prevToAccountId, -pAmt);
            }
        }
        // Guardar la transacción (insert/update)
        const savedTx = await queryRunner.manager.save(Transaction_entity_1.Transaction, tx);
        // efectos nuevos
        const amt = Number(savedTx.amount);
        if (savedTx.type === 'income' && savedTx.account?.id)
            addDelta(savedTx.account.id, +amt);
        if (savedTx.type === 'expense' && savedTx.account?.id)
            addDelta(savedTx.account.id, -amt);
        if (savedTx.type === 'transfer') {
            if (savedTx.account?.id)
                addDelta(savedTx.account.id, -amt);
            if (savedTx.to_account?.id)
                addDelta(savedTx.to_account.id, +amt);
        }
        // Aplicar todos los deltas calculados
        for (const [accId, delta] of deltas) {
            const acc = await queryRunner.manager.findOne(Account_entity_1.Account, { where: { id: accId } });
            if (!acc)
                continue;
            const newBalance = Number(acc.balance) + delta;
            await queryRunner.manager.update(Account_entity_1.Account, { id: accId }, { balance: newBalance });
        }
        await queryRunner.commitTransaction();
        logger_util_1.logger.info(`Transaction data is valid for user ${authReq.user.id}, saved and balances updated.`);
        await queryRunner.release();
        return res.redirect('/transactions');
    }
    catch (error) {
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        logger_util_1.logger.error('Error saving transaction and updating balances', error);
        return res.status(500).render('layouts/main', {
            title: '',
            view: 'pages/transactions/form',
            transaction: { ...req.body },
            errors: { _form: 'Error al guardar transacción' },
            accounts,
            incomeCategories,
            expenseCategories,
            mode
        });
    }
};
exports.saveTransaction = saveTransaction;
