"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapValidationErrors = mapValidationErrors;
function mapValidationErrors(errors) {
    const fieldErrors = {};
    errors.forEach(err => {
        if (err.constraints) {
            fieldErrors[err.property] = Object.values(err.constraints)[0];
        }
        if (err.children && err.children.length > 0) {
            err.children.forEach(child => {
                if (child.constraints) {
                    fieldErrors[`${err.property}`] =
                        Object.values(child.constraints)[0];
                }
            });
        }
    });
    return fieldErrors;
}
