"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveCategory = void 0;
const datasource_1 = require("../config/datasource");
const Category_entity_1 = require("../entities/Category.entity");
const logger_util_1 = require("../utils/logger.util");
const category_controller_validator_1 = require("./category.controller.validator");
const saveCategory = async (req, res) => {
    const authReq = req;
    const repo = datasource_1.AppDataSource.getRepository(Category_entity_1.Category);
    const txId = req.body.id ? Number(req.body.id) : req.params.id ? Number(req.params.id) : undefined;
    let tx;
    let mode;
    if (txId) {
        const existing = await repo.findOne({
            where: { id: txId, user: { id: authReq.user.id } }
        });
        if (!existing) {
            return res.redirect('/categories');
        }
        if (req.body.is_active !== undefined) {
            mode = 'status';
            existing.is_active = req.body.is_active === 'true';
        }
        else {
            mode = 'update';
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
            is_active: true
        });
    }
    logger_util_1.logger.info(`Before saving category`, { userId: authReq.user.id, mode, tx });
    const errors = await (0, category_controller_validator_1.validateCategory)(tx, authReq);
    if (errors) {
        return res.render('layouts/main', {
            title: '',
            view: 'pages/categories/form',
            category: {
                ...req.body,
                is_active: req.body.is_active === 'true' ? true : false
            },
            errors,
            mode
        });
    }
    await repo.save(tx);
    logger_util_1.logger.info(`Category saved to database.`);
    res.redirect('/categories');
};
exports.saveCategory = saveCategory;
