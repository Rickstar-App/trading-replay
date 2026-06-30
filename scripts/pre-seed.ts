/**
 * Pre-seed historical data for a symbol so the first session loads instantly.
 *
 * Usage:
 *   npx tsx scripts/pre-seed.ts --symbol SPY --interval 5min --days 30
 *
 * Requires TWELVE_DATA_API_KEY in .env.local (free tier: 800 req/day).
 * Free tier is rate-limited to 8 req/min — the script throttles automatically.
 */
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

config({ path: path.resolve(__dirname, '../.env.local') });

const API_KEY = process.env.TWELVE_DATA_API_KEY;
if (!API_KEY || API_KEY === 'your_key_here') {
  console.error('Set TWELVE_DATA_API_KEY in .env.local first.');
  process.exit(1);
}

const args = process.argv.slice(2);
function getArg(flag: string, def: string) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

const SYMBOL   = getArg('--symbol',   'SPY').toUpperCase();
const INTERVAL = getArg('--interval', '5min');
const DAYS     = parseInt(getArg('--days', '10'), 10);

const VALID_INTERVALS = ['1min', '5min', '15min'];
if (!VALID_INTERVALS.includes(INTERVAL)) {
  console.error(`Invalid interval "${INTERVAL}". Use: ${VALID_INTERVALS.join(', ')}`);
  process.exit(1);
}

function getPrevWeekdays(n: number): string[] {
  const dates: string[] = [];
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  while (dates.length < n) {
    d.setUTCDate(d.getUTCDate() - 1);
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) { // skip weekends
      dates.push(d.toISOString().slice(0, 10));
    }
  }
  return dates;
}

function getCachePath(symbol: string, interval: string, date: string): string {
  return path.join(__dirname, '..', 'data', symbol, interval, `${date}.json`);
}

async function fetchDay(date: string): Promise<boolean> {
  const cachePath = getCachePath(SYMBOL, INTERVAL, date);
  if (fs.existsSync(cachePath)) {
    console.log(`  SKIP ${date} (cached)`);
    return true;
  }

  const startDate = `${date} 09:30:00`;
  const endDate   = `${date} 16:00:00`;
  const url = `https://api.twelvedata.com/time_series?symbol=${SYMBOL}&interval=${INTERVAL}&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}&timezone=America/New_York&outputsize=5000&apikey=${API_KEY}`;

  const res = await fetch(url);

  if (res.status === 429) {
    console.warn(`  RATE LIMITED on ${date} — waiting 65s`);
    await new Promise((r) => setTimeout(r, 65_000));
    return fetchDay(date); // retry
  }

  const json = await res.json();

  if (json.status === 'error' || !json.values || json.values.length === 0) {
    console.warn(`  SKIP ${date}: ${json.message ?? 'no data'}`);
    return false;
  }

  const candles = (json.values as Array<{ datetime: string; open: string; high: string; low: string; close: string; volume: string }>)
    .reverse()
    .map((c) => ({
      ts:     new Date(c.datetime).getTime(),
      open:   parseFloat(c.open),
      high:   parseFloat(c.high),
      low:    parseFloat(c.low),
      close:  parseFloat(c.close),
      volume: parseInt(c.volume, 10),
    }));

  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(candles));
  console.log(`  OK    ${date} (${candles.length} candles)`);
  return true;
}

async function main() {
  const dates = getPrevWeekdays(DAYS);
  console.log(`Pre-seeding ${SYMBOL} ${INTERVAL} — ${dates.length} trading days`);

  for (let i = 0; i < dates.length; i++) {
    await fetchDay(dates[i]);
    // Stay well under the free tier 8 req/min limit
    if (i < dates.length - 1) {
      await new Promise((r) => setTimeout(r, 8_000));
    }
  }

  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
