import { SCRIPT_NAME } from './config.js';

let _cachedMonthMap = null;

export function isValidDate(day, month, year, hour, minute) {
  return (
    Number.isInteger(day) && day >= 1 && day <= 31 &&
    Number.isInteger(month) && month >= 0 && month <= 11 &&
    Number.isInteger(year) && year >= 2020 && year <= 2100 &&
    Number.isInteger(hour) && hour >= 0 && hour <= 23 &&
    Number.isInteger(minute) && minute >= 0 && minute <= 59
  );
}

export function buildMonthMap() {
  const locale = (document.documentElement.lang || navigator.language || 'en')
    .replace(/[-_].*$/, '');

  const map = new Map();

  try {
    for (const fmtType of ['short', 'long']) {
      const fmt = new Intl.DateTimeFormat(locale, { month: fmtType });
      for (let m = 0; m < 12; m++) {
        const name = fmt.format(new Date(2024, m, 15))
          .normalize('NFD')
          .replace(/[^a-zA-Z]/g, '')
          .toLowerCase();
        if (name && !map.has(name)) {
          map.set(name, m);
        }
      }
    }
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] Intl failed for locale "${locale}":`, e);
  }

  if (map.size === 0) {
    [
      ['jan', 0], ['january', 0], ['feb', 1], ['february', 1],
      ['mar', 2], ['march', 2], ['apr', 3], ['april', 3],
      ['may', 4], ['jun', 5], ['june', 5],
      ['jul', 6], ['july', 6], ['aug', 7], ['august', 7],
      ['sep', 8], ['september', 8], ['oct', 9], ['october', 9],
      ['nov', 10], ['november', 10], ['dec', 11], ['december', 11],
    ].forEach(([k, v]) => map.set(k, v));
  }

  return map;
}

export function parseDateFromLabel(label) {
  if (!_cachedMonthMap) _cachedMonthMap = buildMonthMap();
  const monthMap = _cachedMonthMap;

  const monthKeys = [...monthMap.keys()].sort((a, b) => b.length - a.length);
  const monthPattern = monthKeys.join('|');

  const monthRe = new RegExp(`(${monthPattern})`, 'i');
  const monthMatch = label.match(monthRe);
  if (!monthMatch) return null;

  const matchedMonth = monthMatch[1].toLowerCase().replace(/[^a-z]/g, '');
  const monthIndex = monthMap.get(matchedMonth);
  if (monthIndex === undefined) return null;

  // Pattern 1: day-month-year
  const re1 = new RegExp(
    `(\\d{1,2})\\.?\\s*(?:de\\s+)?(?:${monthPattern})\\S*\\s*(?:de\\s+)?(\\d{4})?\\s*.*?(\\d{1,2}):(\\d{2})`,
    'i'
  );
  let match = label.match(re1);
  if (match) {
    const day = parseInt(match[1], 10);
    const year = match[2] ? parseInt(match[2], 10) : new Date().getFullYear();
    const hour = parseInt(match[3], 10);
    const minute = parseInt(match[4], 10);
    if (isValidDate(day, monthIndex, year, hour, minute)) {
      return { year, month: monthIndex, day, hour, minute, date: new Date(year, monthIndex, day, hour, minute) };
    }
  }

  // Pattern 2: month-day-year (US style)
  const re2 = new RegExp(
    `(?:${monthPattern})\\S*\\s+(\\d{1,2}),?\\s*(?:\\S+\\s+)?(\\d{4})?\\s*.*?(\\d{1,2}):(\\d{2})(?:\\s*(AM|PM))?`,
    'i'
  );
  match = label.match(re2);
  if (match) {
    const day = parseInt(match[1], 10);
    const year = match[2] ? parseInt(match[2], 10) : new Date().getFullYear();
    let hour = parseInt(match[3], 10);
    const minute = parseInt(match[4], 10);
    const ampm = match[5] ? match[5].toUpperCase() : null;
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    if (isValidDate(day, monthIndex, year, hour, minute)) {
      return { year, month: monthIndex, day, hour, minute, date: new Date(year, monthIndex, day, hour, minute) };
    }
  }

  return null;
}
