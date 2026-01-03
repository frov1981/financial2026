"use strict";
// utils/dateUtils.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatDateForInputLocal = formatDateForInputLocal;
exports.formatDateForSystemLocal = formatDateForSystemLocal;
/**
 * Convierte un objeto Date (UTC) a un string
 * con formato "YYYY-MM-DDTHH:mm" ajustado a la zona horaria local.
 *
 * @param date Fecha en UTC
 * @param timeZone Zona horaria IANA (ej: "America/Guayaquil")
 * @returns string para usar en <input type="datetime-local">
 */
function formatDateForInputLocal(date, timeZone = 'America/Guayaquil') {
    // Convertimos la fecha a string en la zona horaria indicada
    const tzString = date.toLocaleString('en-US', { timeZone });
    const tzDate = new Date(tzString);
    const pad = (n) => n.toString().padStart(2, '0');
    const year = tzDate.getFullYear();
    const month = pad(tzDate.getMonth() + 1);
    const day = pad(tzDate.getDate());
    const hours = pad(tzDate.getHours());
    const minutes = pad(tzDate.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
}
function formatDateForSystemLocal(date, timeZone = 'America/Guayaquil') {
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
    const pad = (n) => n.toString().padStart(2, '0');
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
