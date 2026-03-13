export function parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') {
        return value
    }
    if (typeof value === 'string') {
        if (value.toLowerCase() === 'true') return true
        if (value.toLowerCase() === 'false') return false
    }
    if (typeof value === 'number') {
        if (value === 1) return true
        if (value === 0) return false
    }
    return false
}