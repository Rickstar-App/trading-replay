/**
 * ET (America/New_York) time helpers.
 * All times stored as "minutes since midnight ET" (etMinutes).
 */

export interface EtTimeOption {
  label: string;   // "8:30 AM ET"
  etMinutes: number; // 510 for 8:30 AM
}

// Dropdown range: 8:30 AM ET → 10:00 PM ET, every 30 min
const RANGE_START = 8 * 60 + 30;  // 510
const RANGE_END   = 22 * 60;       // 1320

export function generateEtTimeOptions(): EtTimeOption[] {
  const opts: EtTimeOption[] = [];
  for (let m = RANGE_START; m <= RANGE_END; m += 30) {
    opts.push({ label: formatEtMinutes(m), etMinutes: m });
  }
  return opts;
}

export function formatEtMinutes(etMinutes: number): string {
  const totalH = Math.floor(etMinutes / 60);
  const m      = etMinutes % 60;
  const ampm   = totalH >= 12 ? 'PM' : 'AM';
  const displayH = totalH % 12 === 0 ? 12 : totalH % 12;
  return `${displayH}:${String(m).padStart(2, '0')} ${ampm} ET`;
}

/**
 * Convert a YYYY-MM-DD date + ET minutes-since-midnight → UTC milliseconds.
 * Handles DST automatically (US rules: second Sunday March → first Sunday November).
 */
export function etToUtcMs(dateStr: string, etMinutes: number): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  const h = Math.floor(etMinutes / 60);
  const m = etMinutes % 60;

  const dst = isEDT(year, month, day, h);
  const offsetH = dst ? 4 : 5; // hours to ADD to ET to get UTC (ET = UTC − offset)

  return Date.UTC(year, month - 1, day, h + offsetH, m, 0);
}

/**
 * Convert a UTC ms timestamp → ET minutes-since-midnight on a given date.
 * Useful for displaying the cursor position in ET.
 */
export function utcMsToEtMinutes(utcMs: number): number {
  const d = new Date(utcMs);
  // Use Intl to extract hour/minute in ET
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour:   'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(d);

  const h = parseInt(parts.find(p => p.type === 'hour')!.value, 10);
  const m = parseInt(parts.find(p => p.type === 'minute')!.value, 10);
  // hour12:false can return 24 for midnight — normalise
  return (h === 24 ? 0 : h) * 60 + m;
}

/**
 * Parse a Twelve Data datetime string (in America/New_York timezone) to UTC ms.
 * `new Date("2026-06-25 09:30:00")` uses local machine timezone — wrong on
 * non-ET machines. This function applies the correct ET offset regardless of
 * what timezone the server is in.
 */
export function parseEtDatetime(datetime: string): number {
  const [datePart, timePart] = datetime.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [h, m, s] = (timePart ?? '00:00:00').split(':').map(Number);
  const offsetH = isEDT(year, month, day, h) ? 4 : 5;
  return Date.UTC(year, month - 1, day, h + offsetH, m, s ?? 0);
}

// ─── DST detection (US rules) ─────────────────────────────────────────────────

function isEDT(year: number, month: number, day: number, etHour: number): boolean {
  if (month < 3 || month > 11) return false; // Jan, Feb, Dec → EST
  if (month > 3 && month < 11) return true;  // Apr–Oct → EDT

  if (month === 3) {
    // DST starts: second Sunday in March at 2:00 AM
    const secondSun = secondSundayOfMonth(year, 3);
    if (day > secondSun) return true;
    if (day < secondSun) return false;
    return etHour >= 2;
  }

  // month === 11
  // DST ends: first Sunday in November at 2:00 AM
  const firstSun = firstSundayOfMonth(year, 11);
  if (day < firstSun) return true;
  if (day > firstSun) return false;
  return etHour < 2;
}

function firstSundayOfMonth(year: number, month: number): number {
  // month: 1-based
  const dow = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
  return dow === 0 ? 1 : 8 - dow;
}

function secondSundayOfMonth(year: number, month: number): number {
  return firstSundayOfMonth(year, month) + 7;
}
