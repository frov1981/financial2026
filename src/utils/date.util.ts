import { DateTime } from 'luxon';
import { logger } from './logger.util';

export const parseLocalDateToUTC = (
  localDate: string,
  timezone: string
): Date => {
  logger.debug(`parseLocalDateToUTC: LocalDate: ['${localDate}'] with timezone ['${timezone}']`)
  const dt = DateTime.fromISO(localDate, { zone: timezone }).toUTC().toJSDate()
  logger.debug(`parseLocalDateToUTC: Parsed date in UTC: [${dt.toISOString()}]`)
  return dt
}

/*
export function formatDateForInputLocal(
  date: Date,
  timeZone: string = 'America/Guayaquil'
): string {
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date)

  const get = (t: string) => parts.find(p => p.type === t)?.value

  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}*/
export function formatDateForInputLocal(
  date: Date,
  timeZone: string = 'America/Guayaquil'
): string {
  logger.debug(`formatDateForInputLocal: Input date: ['${date.toISOString()}'] with timezone ['${timeZone}']`)
  const dt = DateTime.fromJSDate(date, { zone: 'utc' }).setZone(timeZone).toFormat("yyyy-MM-dd'T'HH:mm")
  logger.debug(`formatDateForInputLocal: Formatted date:  [${dt}]`)
  return dt
}

export function formatDateForSystemLocal(
    date: Date,
    timeZone: string = 'America/Guayaquil'
): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(date);

    const pad = (n: number) => n.toString().padStart(2, '0');

    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    const hour = parts.find(p => p.type === 'hour')?.value;
    const minute = parts.find(p => p.type === 'minute')?.value;
    const second = parts.find(p => p.type === 'second')?.value;

    // Los milisegundos se toman directamente del objeto original
    const milliseconds = pad(date.getMilliseconds());

    return `${year}-${month}-${day} ${hour}:${minute}:${second}.${milliseconds}`;
}

