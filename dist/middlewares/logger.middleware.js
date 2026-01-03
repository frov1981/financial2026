"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.httpLogger = void 0;
const logger_util_1 = require("../utils/logger.util");
const httpLogger = (req, res, next) => {
    const start = Date.now();
    logger_util_1.logger.debug(`${req.method} ${req.originalUrl}`, { headers: req.headers, query: req.query, body: req.body });
    const referer = req.get('referer') || req.get('referrer') || 'no referer';
    logger_util_1.logger.debug(`${referer}`);
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger_util_1.logger.debug(`${req.method} ${req.originalUrl} - Status: ${res.statusCode} - ${duration}ms`);
    });
    res.on('close', () => {
        const duration = Date.now() - start;
        logger_util_1.logger.debug(`${req.method} ${req.originalUrl} - Connection closed - ${duration}ms`);
    });
    next();
};
exports.httpLogger = httpLogger;
