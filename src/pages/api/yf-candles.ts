import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { validateInterval, validateDate } from '@/lib/api-utils';
import { etToUtcMs } from '@/lib/time-utils';
import type { Candle, CandlesResponse, ApiError } from '@/lib/types';

// Yahoo Finance futures symbols (continuous front-month)
const YF_SYMBOL: Record<string, string> = {
  ES:  'ES=F',
  NQ:  'NQ=F',
  MES: 'MES=F',
  MNQ: 'MNQ=F',
  GC:  'GC=F',
  CL:  'CL=F',
};

// Yahoo Finance interval notation
const YF_INTERVAL: Record<string, string> = {
  '1min': '1m',
  '5min': '5m',
  '15min': '15m',
};

// Yahoo Finance lookback limits per interval
const MAX_LOOKBACK_DAYS: Record<string, number> = {
  '1m': 7,
  '5m': 60,
  '15m': 60,
};

function getCachePath(symbol: string, interval: string, date: string): string {
  return path.join(process.cwd(), 'data', 'YF', symbol.toUpperCase(), interval, `${date}.json`);
}

function prevCalendarDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CandlesResponse | ApiError>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed', message: 'GET only' });
  }

  const { symbol, interval, date, cache_only } = req.query;

  if (
    typeof symbol   !== 'string' ||
    typeof interval !== 'string' || !validateInterval(interval) ||
    typeof date     !== 'string' || !validateDate(date)
  ) {
    return res.status(400).json({ error: 'invalid_params', message: 'Invalid symbol, interval, or date' });
  }

  const yfSymbol = YF_SYMBOL[symbol.toUpperCase()];
  if (!yfSymbol) {
    return res.status(400).json({
      error:   'unsupported_symbol',
      message: `${symbol} is not available via Yahoo Finance`,
    });
  }

  const yfInterval = YF_INTERVAL[interval];
  const maxDays    = MAX_LOOKBACK_DAYS[yfInterval] ?? 7;

  // Enforce lookback window — Yahoo Finance only keeps a rolling window
  const dateMs    = new Date(date + 'T12:00:00Z').getTime();
  const daysAgo   = (Date.now() - dateMs) / 86_400_000;
  if (daysAgo > maxDays + 1) {
    const tip = interval === '1min'
      ? 'Switch to 5-min for up to 60 days of history.'
      : `Yahoo Finance only keeps ${maxDays} days of ${interval} data.`;
    return res.status(503).json({
      error:   'data_unavailable',
      message: `${symbol} ${interval} data is not available for ${date} — ${tip}`,
    });
  }

  const cachePath = getCachePath(symbol, interval, date);

  if (fs.existsSync(cachePath)) {
    try {
      const candles: Candle[] = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      return res.status(200).json({ candles });
    } catch {
      fs.unlinkSync(cachePath);
    }
  }

  if (cache_only === 'true') {
    return res.status(404).json({ error: 'cache_miss', message: 'Not in cache' });
  }

  // Full CME Globex session: 6 PM ET prior calendar day → 5 PM ET on date
  const prevDay = prevCalendarDay(date);
  const period1 = Math.floor(etToUtcMs(prevDay, 18 * 60) / 1000); // Unix seconds
  const period2 = Math.floor(etToUtcMs(date,    17 * 60) / 1000);

  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSymbol)}` +
    `?interval=${yfInterval}&period1=${period1}&period2=${period2}`;

  let fetchRes: Response;
  try {
    fetchRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });
  } catch {
    return res.status(503).json({ error: 'network_error', message: 'Failed to reach Yahoo Finance' });
  }

  if (!fetchRes.ok) {
    return res.status(503).json({
      error:   'data_unavailable',
      message: `Yahoo Finance returned HTTP ${fetchRes.status} for ${symbol}`,
    });
  }

  const json = await fetchRes.json();

  if (json.chart?.error) {
    return res.status(503).json({
      error:   'data_unavailable',
      message: json.chart.error.description ?? `No data for ${symbol} on ${date}`,
    });
  }

  const result = json.chart?.result?.[0];
  if (!result?.timestamp?.length) {
    return res.status(503).json({
      error:   'data_unavailable',
      message: `No candles returned by Yahoo Finance for ${symbol} on ${date}`,
    });
  }

  const timestamps: number[]  = result.timestamp;
  const q = result.indicators.quote[0] as {
    open: (number | null)[];
    high: (number | null)[];
    low:  (number | null)[];
    close:(number | null)[];
    volume:(number | null)[];
  };

  const candles: Candle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const o = q.open[i], h = q.high[i], l = q.low[i], c = q.close[i];
    if (o == null || h == null || l == null || c == null) continue;
    candles.push({
      ts:     timestamps[i] * 1000,
      open:   o,
      high:   h,
      low:    l,
      close:  c,
      volume: q.volume[i] ?? 0,
    });
  }

  if (candles.length === 0) {
    return res.status(503).json({
      error:   'data_unavailable',
      message: `Yahoo Finance returned no valid bars for ${symbol} on ${date}`,
    });
  }

  candles.sort((a, b) => a.ts - b.ts);

  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(candles));

  return res.status(200).json({ candles });
}
