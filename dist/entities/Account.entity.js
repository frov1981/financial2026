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
exports.Account = void 0;
const class_validator_1 = require("class-validator");
const typeorm_1 = require("typeorm");
const LoanPayment_entity_1 = require("./LoanPayment.entity");
const Transaction_entity_1 = require("./Transaction.entity");
const User_entity_1 = require("./User.entity");
let Account = class Account {
};
exports.Account = Account;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Account.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_entity_1.User, user => user.accounts),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", User_entity_1.User)
], Account.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'El nombre es obligatorio' }),
    __metadata("design:type", String)
], Account.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar' }),
    (0, class_validator_1.IsIn)(['cash', 'bank', 'card'], { message: 'El tipo debe ser cash, bank o card' }),
    __metadata("design:type", String)
], Account.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 15, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Account.prototype, "balance", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: true }),
    (0, class_validator_1.IsBoolean)({ message: 'El estado debe ser true o false' }),
    __metadata("design:type", Boolean)
], Account.prototype, "is_active", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Transaction_entity_1.Transaction, transaction => transaction.account),
    __metadata("design:type", Array)
], Account.prototype, "transactions", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => LoanPayment_entity_1.LoanPayment, payment => payment.account),
    __metadata("design:type", Array)
], Account.prototype, "loanPayments", void 0);
exports.Account = Account = __decorate([
    (0, typeorm_1.Entity)('accounts')
], Account);
