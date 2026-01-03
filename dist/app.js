"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const auth_middleware_1 = require("./middlewares/auth.middleware");
const logger_middleware_1 = require("./middlewares/logger.middleware");
const index_route_1 = __importDefault(require("./routes/index.route"));
const account_route_1 = __importDefault(require("./routes/account.route"));
const category_route_1 = __importDefault(require("./routes/category.route"));
const transaction_route_1 = __importDefault(require("./routes/transaction.route"));
const api_route_1 = __importDefault(require("./routes/api.route"));
exports.app = (0, express_1.default)();
/* =======================
   Middlewares base
======================= */
exports.app.use(express_1.default.json());
exports.app.use(express_1.default.urlencoded({ extended: true }));
exports.app.use(logger_middleware_1.httpLogger);
/* =======================
   View engine
======================= */
exports.app.set('view engine', 'ejs');
exports.app.set('views', path_1.default.join(process.cwd(), 'src/views'));
exports.app.use(express_1.default.static(path_1.default.join(process.cwd(), 'src/public')));
/* =======================
   Auth global
======================= */
exports.app.use(auth_middleware_1.authMiddleware);
/* =======================
   Variables globales EJS
======================= */
exports.app.use((req, res, next) => {
    res.locals.errors = {};
    next();
});
/* =======================
   Routes
======================= */
exports.app.use('/', index_route_1.default);
exports.app.use('/accounts', account_route_1.default);
exports.app.use('/categories', category_route_1.default);
exports.app.use('/transactions', transaction_route_1.default);
exports.app.use('/api', api_route_1.default);
