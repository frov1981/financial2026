import { QueryRunner, Logger as TypeOrmLogger } from 'typeorm';
import { logger } from '../utils/logger.util';

const query_logger = logger.forMethod('logQuery', 'TYPEORM_QUERY')
const query_error_logger = logger.forMethod('logQueryError', 'TYPEORM_QUERY_ERROR')
const query_slow_logger = logger.forMethod('logQuerySlow', 'TYPEORM_QUERY_SLOW')
const schema_logger = logger.forMethod('logSchemaBuild', 'TYPEORM_SCHEMA')
const migration_logger = logger.forMethod('logMigration', 'TYPEORM_MIGRATION')
const general_logger = logger.forMethod('log', 'TYPEORM_LOG')

export class OneLineSqlLogger implements TypeOrmLogger {
  private enabled = process.env.DB_LOGGING === 'true';

  logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner) {
    if (!this.enabled) return;
    const oneLine = query.replace(/\s+/g, ' ').trim()
    query_logger.debug('QUERY', { query: oneLine, parameters })
  }

  logQueryError(error: string | Error, query: string, parameters?: any[], queryRunner?: QueryRunner) {
    if (!this.enabled) return;
    query_error_logger.error('QUERY ERROR', { query, parameters, error })
  }

  logQuerySlow(time: number, query: string, parameters?: any[], queryRunner?: QueryRunner) {
    if (!this.enabled) return;
    query_slow_logger.warn('SLOW QUERY', { time, query, parameters })
  }

  logSchemaBuild(message: string, queryRunner?: QueryRunner) {
    if (!this.enabled) return;
    schema_logger.info('SCHEMA BUILD', { message })
  }
  logMigration(message: string, queryRunner?: QueryRunner) {
    if (!this.enabled) return;
    migration_logger.info('MIGRATION', { message })
  }

  log(level: 'log' | 'info' | 'warn', message: any, queryRunner?: QueryRunner) {
    if (level === 'log' || level === 'info') general_logger.info(message)
    if (level === 'warn') general_logger.warn(message)
  }
}
