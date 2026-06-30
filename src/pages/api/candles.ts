import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { validateSymbol, validateInterval, validateDate, getCachePath } from '@/lib/api-utils';
import { parseEtDatetime } from '@/lib/time-utils';
import type { Candle, CandlesResponse, ApiError } from '@/lib/types';
import type { InstrumentType } from '@/lib/ticker-config';

if (!process.env.TWELVE_DATA_API_KEY) {
  throw new Error('TWELVE_DATA_API_KEY not set in .env.local');
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CandlesResponse | ApiError>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed', message: 'GET only' });
  }

  const { symbol, date, interval, cache_only, type, exchange } = req.query;

  if (
    typeof symbol !== 'string' || !validateSymbol(symbol) ||
    typeof interval !== 'string' || !validateInterval(interval) ||
    typeof date !== 'string' || !validateDate(date)
  ) {
    return res.status(400).json({ error: 'invalid_params', message: 'Invalid symbol, interval, or date' });
  }

  // Instrument type drives the session window (defaults to equity)
  const instrumentType: InstrumentType =
    typeof type === 'string' && ['futures', 'crypto'].includes(type)
      ? (type as InstrumentType)
      : 'equity';
  const exchangeCode =
    typeof exchange === 'string' && /^[A-Z]{1,10}$/i.test(exchange) ? exchange : undefined;

  const cachePath = getCachePath(symbol, interval, date);

  // Cache hit
  if (fs.existsSync(cachePath)) {
    try {
      const raw = fs.readFileSync(cachePath, 'utf-8');
      const candles: Candle[] = JSON.parse(raw);
      return res.status(200).json({ candles });
    } catch {
      fs.unlinkSync(cachePath);
    }
  }

  if (cache_only === 'true') {
    return res.status(404).json({ error: 'cache_miss', message: 'Not in cache' });
  }

  // ── Session window per instrument type ────────────────────────────────────
  //
  //   equity  → 9:30 AM – 8 PM ET on date D (regular + extended hours if TD returns them)
  //   futures → 6 PM ET (D-1 calendar) – 5 PM ET on D  (overnight globex + RTH)
  //   crypto  → midnight – 11:59 PM ET on date D (full 24-hour day, 7 days/week)

  let startDate: string;
  let endDate: string;

  if (instrumentType === 'futures') {
    const prevDay = prevCalendarDay(date);
    const prevDayDate = new Date(prevDay + 'T12:00:00Z');
    // If prevDay is Sunday (day 0), Twelve Data rejects the Sunday start date.
    // Fall back to 09:30 on the session date itself (free tier returns RTH only anyway).
    startDate = prevDayDate.getUTCDay() === 0 ? `${date} 09:30:00` : `${prevDay} 18:00:00`;
    endDate   = `${date} 17:00:00`;
  } else if (instrumentType === 'crypto') {
    startDate = `${date} 00:00:00`;
    endDate   = `${date} 23:59:00`;
  } else {
    // equity (and forex-style spot prices)
    startDate = `${date} 09:30:00`;
    endDate   = `${date} 20:00:00`;
  }

  // ── Build Twelve Data URL ──────────────────────────────────────────────────

  const apiKey = process.env.TWELVE_DATA_API_KEY;
  const params = new URLSearchParams({
    symbol:     symbol.toUpperCase(),
    interval,
    start_date: startDate,
    end_date:   endDate,
    timezone:   'America/New_York',
    outputsize: '5000',
    apikey:     apiKey!,
  });
  if (exchangeCode) params.set('exchange', exchangeCode);

  const url = `https://api.twelvedata.com/time_series?${params}`;

  let fetchRes: Response;
  try {
    fetchRes = await fetch(url);
  } catch {
    return res.status(503).json({ error: 'network_error', message: 'Failed to reach Twelve Data' });
  }

  if (fetchRes.status === 429) {
    return res.status(429).json({ error: 'rate_limited', message: 'Rate limited — wait 60 seconds and try again' });
  }

  const json = await fetchRes.json();

  if (json.status === 'error' || !json.values || json.values.length === 0) {
    return res.status(503).json({
      error: 'data_unavailable',
      message: json.message ?? `No data for ${symbol} on ${date}`,
    });
  }

  // Twelve Data returns newest-to-oldest — reverse to oldest-to-newest
  const candles: Candle[] = (json.values as TwelveDataCandle[])
    .reverse()
    .map((c) => ({
      ts:     parseEtDatetime(c.datetime),
      open:   parseFloat(c.open),
      high:   parseFloat(c.high),
      low:    parseFloat(c.low),
      close:  parseFloat(c.close),
      volume: parseInt(c.volume, 10) || 0,
    }));

  const cacheDir = path.dirname(cachePath);
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(candles));

  return res.status(200).json({ candles });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface TwelveDataCandle {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

function prevCalendarDay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
