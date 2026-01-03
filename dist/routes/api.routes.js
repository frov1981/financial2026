"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const account_controller_1 = require("../controllers/account.controller");
const transaction_controller_1 = require("../controllers/transaction.controller");
const router = (0, express_1.Router)();
router.get('/accounts', account_controller_1.listAccountsAPI);
router.get('/transactions', transaction_controller_1.listTransactionsPaginatedAPI);
exports.default = router;
