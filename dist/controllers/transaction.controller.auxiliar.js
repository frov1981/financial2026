"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitCategoriesByType = exports.getNextValidTransactionDate = exports.getActiveCategoriesByUser = exports.getActiveAccountsByUser = void 0;
const datasource_1 = require("../config/datasource");
const Account_entity_1 = require("../entities/Account.entity");
const Transaction_entity_1 = require("../entities/Transaction.entity");
const Category_entity_1 = require("../entities/Category.entity");
const typeorm_1 = require("typeorm");
const getActiveAccountsByUser = async (authReq) => {
    const repo = datasource_1.AppDataSource.getRepository(Account_entity_1.Account);
    const accounts = await repo.find({
        where: {
            user: { id: authReq.user.id },
            is_active: true,
            balance: (0, typeorm_1.MoreThan)(0)
        },
        order: { name: 'ASC' }
    });
    return accounts;
};
exports.getActiveAccountsByUser = getActiveAccountsByUser;
const getActiveCategoriesByUser = async (authReq) => {
    const repo = datasource_1.AppDataSource.getRepository(Category_entity_1.Category);
    const categories = await repo.find({
        where: {
            user: { id: authReq.user.id },
            is_active: true
        },
        order: { name: 'ASC' }
    });
    return categories;
};
exports.getActiveCategoriesByUser = getActiveCategoriesByUser;
const getNextValidTransactionDate = async (authReq) => {
    const userId = authReq.user.id;
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const lastTxToday = await datasource_1.AppDataSource
        .getRepository(Transaction_entity_1.Transaction)
        .createQueryBuilder('t')
        .where('t.user_id = :userId', { userId })
        .andWhere('t.date BETWEEN :start AND :end', {
        start: startOfDay,
        end: endOfDay
    })
        .orderBy('t.date', 'DESC')
        .getOne();
    if (!lastTxToday)
        return now;
    if (lastTxToday.date > now)
        return now;
    const next = new Date(lastTxToday.date);
    const minutes = next.getMinutes();
    const remainder = minutes % 5;
    const increment = remainder === 0 ? 5 : 5 - remainder;
    next.setMinutes(minutes + increment);
    next.setSeconds(0, 0);
    return next > now ? next : now;
};
exports.getNextValidTransactionDate = getNextValidTransactionDate;
// Agrupa categorías por tipo (income / expense)
const splitCategoriesByType = (categories) => {
    const incomeCategories = [];
    const expenseCategories = [];
    categories.forEach(category => {
        if (category.type === 'income') {
            incomeCategories.push(category);
        }
        if (category.type === 'expense') {
            expenseCategories.push(category);
        }
    });
    return {
        incomeCategories,
        expenseCategories
    };
};
exports.splitCategoriesByType = splitCategoriesByType;
