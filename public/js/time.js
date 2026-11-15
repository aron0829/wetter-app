// Ortszeit-Hilfen.
// Open-Meteo liefert mit timezone=auto "naive" Ortszeit-Strings wie 2026-11-15T22:45.
// Diese Strings werden hier nur als Text bzw. über Date.UTC verrechnet – nie über
// new Date(string), weil das die Zeitzone des Geräts hineinmischen würde.

const WEEKDAYS = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August',
  'September', 'Oktober', 'November', 'Dezember'];

const pad = (n) => String(n).padStart(2, '0');
const formatters = new Map();

function formatterFor(timeZone) {
  const key = timeZone || 'UTC';
  if (!formatters.has(key)) {
    let fmt;
    try {
      fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: key, hourCycle: 'h23',
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
      });
    } catch {
      fmt = formatterFor('UTC');
    }
    formatters.set(key, fmt);
  }
  return formatters.get(key);
}

/** Jetzt (oder `date`) in der Zeitzone des Ortes als "YYYY-MM-DDTHH:MM". */
export function nowInZone(timeZone, date = new Date()) {
  const parts = {};
  for (const p of formatterFor(timeZone).formatToParts(date)) parts[p.type] = p.value;
  const hour = parts.hour === '24' ? '00' : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}`;
}

export const dateKey = (iso) => iso.slice(0, 10);
export const hourKey = (iso) => `${iso.slice(0, 13)}:00`;

/** Naiven ISO-String in Millisekunden umrechnen (als wäre er UTC) – nur für Differenzen. */
function toMs(iso) {
  const [date, time = '00:00'] = iso.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  return Date.UTC(y, m - 1, d, hh, mm);
}

export function addDays(key, n) {
  const d = new Date(toMs(key) + n * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function formatTime(iso) {
  return typeof iso === 'string' && iso.length >= 16 ? iso.slice(11, 16) : '–';
}

export function weekdayShort(key) {
  return WEEKDAYS[new Date(toMs(key)).getUTCDay()];
}

export function formatClock(timeZone, date = new Date()) {
  return nowInZone(timeZone, date).slice(11, 16);
}

/** "So., 15. November um 21:27" */
export function formatDateLine(timeZone, date = new Date()) {
  const iso = nowInZone(timeZone, date);
  const [, month, day] = iso.slice(0, 10).split('-').map(Number);
  return `${weekdayShort(iso.slice(0, 10))}, ${day}. ${MONTHS[month - 1]} um ${iso.slice(11, 16)}`;
}

export function formatUnix(unixSeconds, timeZone) {
  return formatClock(timeZone, new Date(unixSeconds * 1000));
}

export function minutesBetween(isoA, isoB) {
  return Math.round((toMs(isoB) - toMs(isoA)) / 60000);
}
