"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Transaction = void 0;
const typeorm_1 = require("typeorm");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const User_entity_1 = require("./User.entity");
const Account_entity_1 = require("./Account.entity");
const Category_entity_1 = require("./Category.entity");
const notSameAccount_validator_1 = require("../validators/notSameAccount.validator");
let Transaction = class Transaction {
};
exports.Transaction = Transaction;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Transaction.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_entity_1.User, user => user.transactions),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", User_entity_1.User)
], Transaction.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    (0, class_validator_1.IsIn)(['income', 'expense', 'transfer'], {
        message: 'Tipo de transacción inválido'
    }),
    __metadata("design:type", String)
], Transaction.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Account_entity_1.Account),
    (0, typeorm_1.JoinColumn)({ name: 'account_id' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'La cuenta es obligatoria' }),
    __metadata("design:type", Account_entity_1.Account)
], Transaction.prototype, "account", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Account_entity_1.Account, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'to_account_id' }),
    (0, class_validator_1.ValidateIf)(t => t.type === 'transfer'),
    (0, class_validator_1.IsNotEmpty)({ message: 'La cuenta destino es obligatoria' }),
    __metadata("design:type", Object)
], Transaction.prototype, "to_account", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Category_entity_1.Category, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'category_id' }),
    (0, class_validator_1.ValidateIf)(t => t.type !== 'transfer'),
    (0, class_validator_1.IsNotEmpty)({ message: 'La categoría es obligatoria' }),
    __metadata("design:type", Object)
], Transaction.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2 }),
    (0, class_validator_1.IsNumber)({}, { message: 'El monto debe ser numérico' }),
    (0, class_validator_1.IsPositive)({ message: 'El monto debe ser mayor a cero' }),
    __metadata("design:type", Number)
], Transaction.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp' }),
    (0, class_transformer_1.Transform)(({ value }) => value ? new Date(value) : new Date()),
    __metadata("design:type", Date)
], Transaction.prototype, "date", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true, length: 200 }),
    (0, class_validator_1.IsNotEmpty)({ message: 'La descripción es obligatoria' }),
    (0, class_validator_1.MaxLength)(200, { message: 'Máximo 200 caracteres' }),
    __metadata("design:type", String)
], Transaction.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], Transaction.prototype, "created_at", void 0);
__decorate([
    (0, class_validator_1.Validate)(notSameAccount_validator_1.NotSameAccount),
    __metadata("design:type", Boolean)
], Transaction.prototype, "_notSameAccountValidation", void 0);
exports.Transaction = Transaction = __decorate([
    (0, typeorm_1.Entity)('transactions')
], Transaction);
