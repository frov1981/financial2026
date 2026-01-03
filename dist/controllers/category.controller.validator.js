"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateCategory = void 0;
// controllers/category.controller.validator.ts
const class_validator_1 = require("class-validator");
const datasource_1 = require("../config/datasource");
const Category_entity_1 = require("../entities/Category.entity");
const logger_util_1 = require("../utils/logger.util");
const mapValidationErrors_validator_1 = require("../validators/mapValidationErrors.validator");
const validateCategory = async (category, authReq) => {
    const userId = authReq.user.id;
    const errors = await (0, class_validator_1.validate)(category);
    const fieldErrors = errors.length > 0 ? (0, mapValidationErrors_validator_1.mapValidationErrors)(errors) : {};
    // Validación: nombre único por usuario
    if (category.name && userId) {
        const repo = datasource_1.AppDataSource.getRepository(Category_entity_1.Category);
        const existing = await repo.findOne({
            where: {
                name: category.name,
                user: { id: userId }
            }
        });
        if (existing && existing.id !== category.id) {
            fieldErrors.name = 'Ya existe una categoría con este nombre';
        }
    }
    logger_util_1.logger.warn(`Category validation`, { userId, fieldErrors });
    return Object.keys(fieldErrors).length > 0 ? fieldErrors : null;
};
exports.validateCategory = validateCategory;
