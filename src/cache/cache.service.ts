import { LOGGER_EVENTS } from '../utils/logger-events'
import NodeCache from 'node-cache'
import { logger } from '../utils/logger.util'

type CacheKey = string | number

const getCacheUserId = (key: CacheKey): number | null => {
    if (typeof key !== 'string') return null

    const match = key.match(/(?:^|_)user_(\d+)(?:_|$)/)
    if (!match) return null

    const user_id = Number(match[1])
    return Number.isSafeInteger(user_id) && user_id > 0 ? user_id : null
}

const summarizeCacheKey = (key: CacheKey): string =>
    typeof key === 'string' ? key.replace(/_filter_.+$/, '_filter_[redacted]') : String(key)

const summarizeCacheValue = (value: unknown) => {
    if (Array.isArray(value)) {
        return { value_type: 'array', item_count: value.length }
    }

    if (value !== null && typeof value === 'object') {
        const record = value as { items?: unknown }
        return {
            value_type: 'object',
            item_count: Array.isArray(record.items) ? record.items.length : undefined,
            property_count: Object.keys(value).length,
        }
    }

    return { value_type: value === null ? 'null' : typeof value }
}

class LoggedNodeCache extends NodeCache {
    override set<T>(key: CacheKey, value: T): boolean
    override set<T>(key: CacheKey, value: T, ttl: number | string): boolean
    override set<T>(key: CacheKey, value: T, ttl?: number | string): boolean {
        const stored = ttl === undefined
            ? super.set(key, value)
            : super.set(key, value, ttl)

        if (stored) {
            logger.forMethod('set', LOGGER_EVENTS.CACHE, getCacheUserId(key)).debug('Entrada guardada en caché', {
                cache_key: summarizeCacheKey(key),
                ...summarizeCacheValue(value),
            })
        }

        return stored
    }
}

export const cache = new LoggedNodeCache({
    stdTTL: 14400, // 4 horas
    checkperiod: 120 // 2 minutos
})