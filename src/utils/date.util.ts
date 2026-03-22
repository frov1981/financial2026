import { DateTime } from 'luxon';

export const parseLocalDateToUTC = (localDate: string, timezone: string): Date => {
  const dt = DateTime.fromISO(localDate, { zone: timezone }).toUTC().toJSDate()
  return dt
}

export function formatDateForInputLocal(date: Date, timeZone: string = 'America/Guayaquil'): string {
  const dt = DateTime.fromJSDate(date, { zone: 'utc' }).setZone(timeZone).toFormat("yyyy-MM-dd'T'HH:mm")
  return dt
}

export function formatDateForSystemLocal(date: Date, timeZone: string = 'America/Guayaquil'): string {
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
  const pad3 = (n: number) => n.toString().padStart(3, '0');

  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  const hour = parts.find(p => p.type === 'hour')?.value;
  const minute = parts.find(p => p.type === 'minute')?.value;
  const second = parts.find(p => p.type === 'second')?.value;
  const milliseconds = pad3(date.getMilliseconds());

  return `${year}-${month}-${day} ${hour}:${minute}:${second}.${milliseconds}`;
}
