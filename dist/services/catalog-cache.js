"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearAllCatalogCache = exports.clearCatalogCacheByUser = exports.getCategoriesByUser = exports.getAccountsByUser = void 0;
const datasource_1 = require("../config/datasource");
const Account_entity_1 = require("../entities/Account.entity");
const Category_entity_1 = require("../entities/Category.entity");
const accountsCache = new Map();
const categoriesCache = new Map();
/* =======================
   Accounts activas
======================= */
const getAccountsByUser = async (userId) => {
    if (!accountsCache.has(userId)) {
        const accounts = await datasource_1.AppDataSource
            .getRepository(Account_entity_1.Account)
            .find({
            where: {
                user: { id: userId },
                is_active: true
            },
            order: { name: 'ASC' }
        });
        accountsCache.set(userId, accounts);
    }
    return accountsCache.get(userId);
};
exports.getAccountsByUser = getAccountsByUser;
/* =======================
   Categories activas (solo hijas)
======================= */
const getCategoriesByUser = async (userId) => {
    if (!categoriesCache.has(userId)) {
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
        categoriesCache.set(userId, await qb.getMany());
    }
    return categoriesCache.get(userId);
};
exports.getCategoriesByUser = getCategoriesByUser;
/* =======================
   Limpieza selectiva
======================= */
const clearCatalogCacheByUser = (userId) => {
    accountsCache.delete(userId);
    categoriesCache.delete(userId);
};
exports.clearCatalogCacheByUser = clearCatalogCacheByUser;
/* =======================
   Limpieza total (opcional)
======================= */
const clearAllCatalogCache = () => {
    accountsCache.clear();
    categoriesCache.clear();
};
exports.clearAllCatalogCache = clearAllCatalogCache;
