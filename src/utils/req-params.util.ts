import { Request } from 'express'

/**
 * =========================
 * Helpers base
 * =========================
 */

const hasValue = (value: any): boolean => {
    return value !== undefined && value !== null && value !== ''
}

/**
 * =========================
 * String
 * =========================
 */
export const getStringFromBody = (
    req: Request,
    field: string
): string | undefined => {
    const value = req.body?.[field]
    if (!hasValue(value)) return undefined
    return String(value)
}

/**
 * =========================
 * Number
 * =========================
 */
export const getNumberFromBody = (
    req: Request,
    field: string
): number | undefined => {
    const value = req.body?.[field]
    if (!hasValue(value)) return undefined

    const parsed = Number(value)
    return Number.isNaN(parsed) ? undefined : parsed
}

/**
 * =========================
 * Boolean
 * Acepta: true, false, "true", "false", 1, 0
 * =========================
 */
export const getBoolFromBody = (
    req: Request,
    field: string
): boolean | undefined => {
    const value = req.body?.[field]
    if (!hasValue(value)) return undefined

    if (value === true || value === 'true' || value === 1 || value === '1') {
        return true
    }

    if (value === false || value === 'false' || value === 0 || value === '0') {
        return false
    }

    return undefined
}

/**
 * =========================
 * Date (solo fecha: YYYY-MM-DD)
 * =========================
 */
export const getDateFromBody = (
    req: Request,
    field: string
): Date | undefined => {
    const value = req.body?.[field]
    if (!hasValue(value)) return undefined

    const date = new Date(`${value}T00:00:00`)
    return isNaN(date.getTime()) ? undefined : date
}

/**
 * =========================
 * DateTime (ISO o timestamp)
 * =========================
 */
export const getDateTimeFromBody = (
    req: Request,
    field: string
): Date | undefined => {
    const value = req.body?.[field]
    if (!hasValue(value)) return undefined

    const date = new Date(value)
    return isNaN(date.getTime()) ? undefined : date
}

/**
 * =========================
 * ID from params
 * =========================    
 */
export const getIdFromParams = (req: Request): number | undefined => {
    const { id } = req.params
    if (!id) return undefined
    const parsed = Number(id)
    return Number.isNaN(parsed) ? undefined : parsed
}

/**
 * =========================
 * Number from params
 * =========================
 */
export const getNumberFromParams = (
    req: Request,
    paramName: string
): number | undefined => {
    const value = req.params[paramName]
    if (value === undefined) return undefined

    const parsed = Number(value)
    return Number.isNaN(parsed) ? undefined : parsed
}
