import path from 'path';
import type { Interval } from './types';

// Accepts plain symbols (SPY, AAPL) and forex/crypto pairs (BTC/USD, EUR/USD)
export function validateSymbol(s: string): boolean {
  return /^[A-Z0-9]{1,10}(\/[A-Z0-9]{1,10})?$/i.test(s);
}

export function validateInterval(i: string): i is Interval {
  return ['1min', '5min', '15min'].includes(i);
}

export function validateDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

// Sanitize slashes in symbols like BTC/USD → BTC_USD for filesystem safety
function safeSymbol(symbol: string): string {
  return symbol.replace(/\//g, '_').toUpperCase();
}

function cacheRoot(): string {
  // Vercel serverless: only /tmp is writable; local dev: project data/ dir
  return process.env.VERCEL ? '/tmp/trading-replay-cache' : path.join(process.cwd(), 'data');
}

export function getCachePath(symbol: string, interval: string, date: string): string {
  return path.join(cacheRoot(), safeSymbol(symbol), interval, `${date}.json`);
}

export function getCacheDir(symbol: string, interval: string): string {
  return path.join(cacheRoot(), safeSymbol(symbol), interval);
}

export const VALID_INTERVALS: Interval[] = ['1min', '5min', '15min'];
