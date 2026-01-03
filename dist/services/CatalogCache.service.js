"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearAllCatalogCache = exports.clearActiveCatalogCacheByUser = exports.getAllCategoriesByUser1 = exports.getAllAccountsByUser1 = exports.getActiveCategoriesByUser1 = exports.getActiveAccountsByUser1 = void 0;
const datasource_1 = require("../config/datasource");
const Account_entity_1 = require("../entities/Account.entity");
const Category_entity_1 = require("../entities/Category.entity");
const activeAccountsCache = new Map();
const activeCategoriesCache = new Map();
const allAccountsCache = new Map();
const allCategoriesCache = new Map();
/* =======================
   Accounts activas
======================= */
const getActiveAccountsByUser1 = async (userId) => {
    if (!activeAccountsCache.has(userId)) {
        const accounts = await datasource_1.AppDataSource
            .getRepository(Account_entity_1.Account)
            .find({
            where: {
                user: { id: userId },
                is_active: true
            },
            order: { name: 'ASC' }
        });
        activeAccountsCache.set(userId, accounts);
    }
    return activeAccountsCache.get(userId);
};
exports.getActiveAccountsByUser1 = getActiveAccountsByUser1;
/* =======================
   Categories activas (solo hijas)
======================= */
const getActiveCategoriesByUser1 = async (userId) => {
    if (!activeCategoriesCache.has(userId)) {
        const qb = datasource_1.AppDataSource
            .getRepository(Category_entity_1.Category)
            .createQueryBuilder('c')
            .where('c.user_id = :userId', { userId })
            .andWhere('c.is_active = true')
            .andWhere(qb => {
            const sub = qb.subQuery()
                .select('1')
                .from(Category_entity_1.Category, 'c2')
                .where('c2.parent_id = c.id')
                .getQuery();
            return `NOT EXISTS ${sub}`;
        })
            .orderBy('c.name', 'ASC');
        activeCategoriesCache.set(userId, await qb.getMany());
    }
    return activeCategoriesCache.get(userId);
};
exports.getActiveCategoriesByUser1 = getActiveCategoriesByUser1;
const getAllAccountsByUser1 = async (userId) => {
    if (!allAccountsCache.has(userId)) {
        const accounts = await datasource_1.AppDataSource
            .getRepository(Account_entity_1.Account)
            .find({ where: { user: { id: userId } }, order: { name: 'ASC' } });
        allAccountsCache.set(userId, accounts);
    }
    return allAccountsCache.get(userId);
};
exports.getAllAccountsByUser1 = getAllAccountsByUser1;
const getAllCategoriesByUser1 = async (userId) => {
    if (!allCategoriesCache.has(userId)) {
        const categories = await datasource_1.AppDataSource
            .getRepository(Category_entity_1.Category)
            .find({ where: { user: { id: userId } }, order: { name: 'ASC' } });
        allCategoriesCache.set(userId, categories);
    }
    return allCategoriesCache.get(userId);
};
exports.getAllCategoriesByUser1 = getAllCategoriesByUser1;
/* =======================
   Limpieza selectiva
======================= */
const clearActiveCatalogCacheByUser = (userId) => {
    activeAccountsCache.delete(userId);
    activeCategoriesCache.delete(userId);
};
exports.clearActiveCatalogCacheByUser = clearActiveCatalogCacheByUser;
/* =======================
   Limpieza total (opcional)
======================= */
const clearAllCatalogCache = () => {
    allAccountsCache.clear();
    allCategoriesCache.clear();
};
exports.clearAllCatalogCache = clearAllCatalogCache;
