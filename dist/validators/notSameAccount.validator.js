"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotSameAccount = void 0;
const class_validator_1 = require("class-validator");
let NotSameAccount = class NotSameAccount {
    validate(_, args) {
        const t = args.object;
        if (t.type !== 'transfer')
            return true;
        if (!t.account || !t.to_account)
            return true;
        return t.account.id !== t.to_account.id;
    }
    defaultMessage() {
        return 'La cuenta origen y la cuenta destino no pueden ser la misma';
    }
};
exports.NotSameAccount = NotSameAccount;
exports.NotSameAccount = NotSameAccount = __decorate([
    (0, class_validator_1.ValidatorConstraint)({ name: 'NotSameAccount', async: false })
], NotSameAccount);
