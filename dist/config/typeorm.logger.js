"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OneLineSqlLogger = void 0;
const logger_util_1 = require("../utils/logger.util");
class OneLineSqlLogger {
    constructor() {
        this.enabled = process.env.DB_LOGGING === 'true';
    }
    logQuery(query, parameters, queryRunner) {
        if (!this.enabled)
            return;
        const oneLine = query.replace(/\s+/g, ' ').trim();
        logger_util_1.logger.debug('QUERY', { query: oneLine, parameters });
    }
    logQueryError(error, query, parameters, queryRunner) {
        if (!this.enabled)
            return;
        logger_util_1.logger.error('QUERY ERROR', { query, parameters, error });
    }
    logQuerySlow(time, query, parameters, queryRunner) {
        if (!this.enabled)
            return;
        logger_util_1.logger.warn('SLOW QUERY', { time, query, parameters });
    }
    logSchemaBuild(message, queryRunner) {
        if (!this.enabled)
            return;
        logger_util_1.logger.info('SCHEMA BUILD', { message });
    }
    logMigration(message, queryRunner) {
        if (!this.enabled)
            return;
        logger_util_1.logger.info('MIGRATION', { message });
    }
    log(level, message, queryRunner) {
        if (level === 'log' || level === 'info')
            logger_util_1.logger.info(message);
        if (level === 'warn')
            logger_util_1.logger.warn(message);
    }
}
exports.OneLineSqlLogger = OneLineSqlLogger;
