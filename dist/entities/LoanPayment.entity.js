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
exports.LoanPayment = void 0;
const typeorm_1 = require("typeorm");
const Loan_entity_1 = require("./Loan.entity");
const Account_entity_1 = require("./Account.entity");
const Transaction_entity_1 = require("./Transaction.entity");
let LoanPayment = class LoanPayment {
};
exports.LoanPayment = LoanPayment;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], LoanPayment.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Loan_entity_1.Loan, loan => loan.payments),
    (0, typeorm_1.JoinColumn)({ name: 'loan_id' }),
    __metadata("design:type", Loan_entity_1.Loan)
], LoanPayment.prototype, "loan", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Account_entity_1.Account, account => account.loanPayments),
    (0, typeorm_1.JoinColumn)({ name: 'account_id' }),
    __metadata("design:type", Account_entity_1.Account)
], LoanPayment.prototype, "account", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Transaction_entity_1.Transaction),
    (0, typeorm_1.JoinColumn)({ name: 'transaction_id' }),
    __metadata("design:type", Transaction_entity_1.Transaction)
], LoanPayment.prototype, "transaction", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2 }),
    __metadata("design:type", Number)
], LoanPayment.prototype, "principal_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 12, scale: 2 }),
    __metadata("design:type", Number)
], LoanPayment.prototype, "interest_amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], LoanPayment.prototype, "payment_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }),
    __metadata("design:type", String)
], LoanPayment.prototype, "note", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamp' }),
    __metadata("design:type", Date)
], LoanPayment.prototype, "created_at", void 0);
exports.LoanPayment = LoanPayment = __decorate([
    (0, typeorm_1.Entity)('loan_payments')
], LoanPayment);
