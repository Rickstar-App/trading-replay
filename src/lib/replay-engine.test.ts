import { describe, it, expect } from 'vitest';
import {
  filterCandles,
  resolveTradeAgainstCandle,
  calculatePnl,
} from './replay-engine';
import type { Candle, Trade } from './types';

function candle(ts: number, low: number, high: number, close = 100): Candle {
  return { ts, open: close, high, low, close, volume: 1000 };
}

function longTrade(entry: number, stop: number, target: number): Trade {
  return { direction: 'Long', entryPrice: entry, stopPrice: stop, targetPrice: target, lotSize: 100 };
}

function shortTrade(entry: number, stop: number, target: number): Trade {
  return { direction: 'Short', entryPrice: entry, stopPrice: stop, targetPrice: target, lotSize: 100 };
}

// ─── filterCandles ───────────────────────────────────────────────────────────

describe('filterCandles', () => {
  const candles: Candle[] = [
    candle(100, 99, 101),
    candle(200, 199, 201),
    candle(300, 299, 301),
    candle(400, 399, 401),
  ];

  it('returns all candles when cursorTs >= last ts', () => {
    expect(filterCandles(candles, 400)).toHaveLength(4);
  });

  it('returns only candles at or before cursorTs', () => {
    expect(filterCandles(candles, 200)).toHaveLength(2);
  });

  it('includes the candle exactly at cursorTs (boundary inclusive)', () => {
    const result = filterCandles(candles, 100);
    expect(result).toHaveLength(1);
    expect(result[0].ts).toBe(100);
  });

  it('returns empty array when cursorTs < first candle ts', () => {
    expect(filterCandles(candles, 50)).toHaveLength(0);
  });
});

// ─── resolveTradeAgainstCandle ────────────────────────────────────────────────

describe('resolveTradeAgainstCandle', () => {
  it('returns null when candle does not touch stop or target (Long)', () => {
    const trade = longTrade(100, 95, 110);
    const c = candle(1, 98, 108);
    expect(resolveTradeAgainstCandle(trade, c)).toBeNull();
  });

  it('resolves Long to target when high >= targetPrice and stop not hit', () => {
    const trade = longTrade(100, 95, 110);
    const c = candle(1, 98, 112);
    const result = resolveTradeAgainstCandle(trade, c);
    expect(result?.outcome).toBe('target');
    expect(result?.fillPrice).toBe(110);
  });

  it('resolves Long to stopped when low <= stopPrice', () => {
    const trade = longTrade(100, 95, 110);
    const c = candle(1, 94, 105);
    const result = resolveTradeAgainstCandle(trade, c);
    expect(result?.outcome).toBe('stopped');
    expect(result?.fillPrice).toBe(95);
  });

  it('worst-case fill: Long stopped when single candle spans both stop and target', () => {
    const trade = longTrade(100, 95, 110);
    const c = candle(1, 93, 115);
    const result = resolveTradeAgainstCandle(trade, c);
    expect(result?.outcome).toBe('stopped');
    expect(result?.fillPrice).toBe(95);
  });

  it('resolves Short to target when low <= targetPrice and stop not hit', () => {
    const trade = shortTrade(100, 108, 90);
    const c = candle(1, 88, 105);
    const result = resolveTradeAgainstCandle(trade, c);
    expect(result?.outcome).toBe('target');
    expect(result?.fillPrice).toBe(90);
  });

  it('resolves Short to stopped when high >= stopPrice', () => {
    const trade = shortTrade(100, 108, 90);
    const c = candle(1, 97, 110);
    const result = resolveTradeAgainstCandle(trade, c);
    expect(result?.outcome).toBe('stopped');
    expect(result?.fillPrice).toBe(108);
  });

  it('worst-case fill: Short stopped when single candle spans both stop and target', () => {
    const trade = shortTrade(100, 108, 90);
    const c = candle(1, 85, 112);
    const result = resolveTradeAgainstCandle(trade, c);
    expect(result?.outcome).toBe('stopped');
    expect(result?.fillPrice).toBe(108);
  });
});

// ─── calculatePnl ─────────────────────────────────────────────────────────────

describe('calculatePnl', () => {
  it('calculates profit for a Long winner', () => {
    // Bought at 100, filled at 110, 100 lots
    expect(calculatePnl(110, 100, 100, 1)).toBe(1000);
  });

  it('calculates loss for a Long loser', () => {
    // Bought at 100, stopped at 95, 100 lots
    expect(calculatePnl(95, 100, 100, 1)).toBe(-500);
  });

  it('calculates profit for a Short winner', () => {
    // Shorted at 100, filled at 90, 100 lots
    expect(calculatePnl(90, 100, 100, -1)).toBe(1000);
  });

  it('calculates loss for a Short loser', () => {
    // Shorted at 100, stopped at 108, 100 lots
    expect(calculatePnl(108, 100, 100, -1)).toBe(-800);
  });

  it('returns 0 when fillPrice equals entryPrice', () => {
    expect(calculatePnl(100, 100, 50, 1)).toBe(0);
  });
});
