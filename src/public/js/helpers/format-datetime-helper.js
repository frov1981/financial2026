function formatDateTime(value) {
    if (!value || typeof value !== 'string') {
        return { date: '', time: '', weekday: '', tag: '' }
    }

    const d = new Date(value)

    const timeZone = window.TIMEZONE || 'America/Guayaquil'

    const parts = new Intl.DateTimeFormat('es-EC', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'long',
        hour12: false
    }).formatToParts(d)

    const get = t => parts.find(p => p.type === t)?.value

    const date = `${get('year')}-${get('month')}-${get('day')}`
    const time = `${get('hour')}:${get('minute')}`
    const weekday = get('weekday') || ''

    return {
        date,
        time,
        weekday,
    }
}
