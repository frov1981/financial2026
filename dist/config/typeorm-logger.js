"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OneLineSqlLogger = void 0;
class OneLineSqlLogger {
    logQuery(query, parameters) {
        const oneLine = query.replace(/\s+/g, ' ').trim();
        console.log('QUERY:', oneLine);
        if (parameters?.length) {
            console.log('PARAMS:', parameters);
        }
    }
    logQueryError(error, query) {
        console.error('QUERY ERROR:', query, error);
    }
    logQuerySlow() { }
    logSchemaBuild() { }
    logMigration() { }
    log() { }
}
exports.OneLineSqlLogger = OneLineSqlLogger;
