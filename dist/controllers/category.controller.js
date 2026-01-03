"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoriesPage = exports.updateCategoryStatusFormPage = exports.updateCategoryFormPage = exports.insertCategoryFormPage = exports.listCategoriesAPI = void 0;
const datasource_1 = require("../config/datasource");
const Category_entity_1 = require("../entities/Category.entity");
const logger_util_1 = require("../utils/logger.util");
const listCategoriesAPI = async (req, res) => {
    const authReq = req;
    try {
        const categories = await datasource_1.AppDataSource.getRepository(Category_entity_1.Category).find({
            where: { user: { id: authReq.user.id } },
            order: { name: 'ASC' }
        });
        res.json(categories);
    }
    catch (error) {
        logger_util_1.logger.error('Error al listar categorías', error);
        res.status(500).json({ error: 'Error al listar categorías' });
    }
};
exports.listCategoriesAPI = listCategoriesAPI;
const insertCategoryFormPage = async (req, res) => {
    const mode = 'insert';
    res.render('layouts/main', {
        title: 'Nueva Categoría',
        view: 'pages/categories/form',
        category: {},
        errors: {},
        mode
    });
};
exports.insertCategoryFormPage = insertCategoryFormPage;
const updateCategoryFormPage = async (req, res) => {
    const authReq = req;
    const categoryId = Number(req.params.id);
    const mode = 'update';
    const repo = datasource_1.AppDataSource.getRepository(Category_entity_1.Category);
    const category = await repo.findOne({
        where: { id: categoryId, user: { id: authReq.user.id } }
    });
    if (!category) {
        return res.redirect('/categories');
    }
    res.render('layouts/main', {
        title: 'Editar Categoría',
        view: 'pages/categories/form',
        category: {
            id: category.id,
            name: category.name,
            type: category.type
        },
        errors: {},
        mode
    });
};
exports.updateCategoryFormPage = updateCategoryFormPage;
const updateCategoryStatusFormPage = async (req, res) => {
    const authReq = req;
    const categoryId = Number(req.params.id);
    const mode = 'status';
    const repo = datasource_1.AppDataSource.getRepository(Category_entity_1.Category);
    const category = await repo.findOne({
        where: { id: categoryId, user: { id: authReq.user.id } }
    });
    if (!category) {
        return res.redirect('/categories');
    }
    res.render('layouts/main', {
        title: 'Editar Estado Categoría',
        view: 'pages/categories/form',
        category: {
            id: category.id,
            name: category.name,
            type: category.type,
            is_active: category.is_active
        },
        errors: {},
        mode
    });
};
exports.updateCategoryStatusFormPage = updateCategoryStatusFormPage;
const categoriesPage = (req, res) => {
    const authReq = req;
    res.render('layouts/main', {
        title: 'Categorías',
        view: 'pages/categories/index',
        USER_ID: authReq.user?.id || 'guest'
    });
};
exports.categoriesPage = categoriesPage;
