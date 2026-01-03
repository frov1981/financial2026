import { Logger as TypeOrmLogger, QueryRunner } from 'typeorm'
import { logger } from '../utils/logger.util'

export class OneLineSqlLogger implements TypeOrmLogger {
  private enabled = process.env.DB_LOGGING === 'true';

  logQuery(query: string, parameters?: any[], queryRunner?: QueryRunner) {
    if (!this.enabled) return;
    const oneLine = query.replace(/\s+/g, ' ').trim()
    logger.debug('QUERY', { query: oneLine, parameters })
  }

  logQueryError(error: string | Error, query: string, parameters?: any[], queryRunner?: QueryRunner) {
    if (!this.enabled) return;
    logger.error('QUERY ERROR', { query, parameters, error })
  }

  logQuerySlow(time: number, query: string, parameters?: any[], queryRunner?: QueryRunner) {
    if (!this.enabled) return;
    logger.warn('SLOW QUERY', { time, query, parameters })
  }

  logSchemaBuild(message: string, queryRunner?: QueryRunner) {
    if (!this.enabled) return;
    logger.info('SCHEMA BUILD', { message })
  }
  logMigration(message: string, queryRunner?: QueryRunner) {
    if (!this.enabled) return;
    logger.info('MIGRATION', { message })
  }

  log(level: 'log' | 'info' | 'warn', message: any, queryRunner?: QueryRunner) {
    if (level === 'log' || level === 'info') logger.info(message)
    if (level === 'warn') logger.warn(message)
  }
}
