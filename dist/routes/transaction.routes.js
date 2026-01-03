"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const transaction_controller_1 = require("../controllers/transaction.controller");
const router = (0, express_1.Router)();
router.get('/', transaction_controller_1.transactionsPage);
router.get('/insert', transaction_controller_1.transactionFormPage);
router.post('/', transaction_controller_1.createTransaction);
exports.default = router;
