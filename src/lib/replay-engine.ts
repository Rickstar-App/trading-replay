import type { Candle, Trade, Direction } from './types';

export function filterCandles(allCandles: Candle[], cursorTs: number): Candle[] {
  return allCandles.filter((c) => c.ts <= cursorTs);
}

export function resolveTradeAgainstCandle(trade: Trade, candle: Candle): Trade | null {
  const { direction, stopPrice, targetPrice, entryPrice, lotSize } = trade;

  let stopHit = false;
  let targetHit = false;

  if (direction === 'Long') {
    stopHit   = candle.low  <= stopPrice;
    targetHit = candle.high >= targetPrice;
  } else {
    stopHit   = candle.high >= stopPrice;
    targetHit = candle.low  <= targetPrice;
  }

  if (!stopHit && !targetHit) return null;

  // Worst-case fill: if both stop and target are hit in the same candle, stopped out
  const outcome = stopHit ? 'stopped' : 'target';
  const fillPrice = outcome === 'stopped' ? stopPrice : targetPrice;
  const dir = direction === 'Long' ? 1 : -1;
  const pnl = calculatePnl(fillPrice, entryPrice, lotSize, dir);

  return { ...trade, fillPrice, outcome, pnl };
}

export function calculatePnl(
  fillPrice: number,
  entryPrice: number,
  lotSize: number,
  direction: 1 | -1
): number {
  return (fillPrice - entryPrice) * lotSize * direction;
}

export function calculatePlannedRR(trade: Pick<Trade, 'direction' | 'entryPrice' | 'stopPrice' | 'targetPrice'>): number | null {
  const { direction, entryPrice, stopPrice, targetPrice } = trade;
  let risk: number;
  let reward: number;

  if (direction === 'Long') {
    risk   = entryPrice - stopPrice;
    reward = targetPrice - entryPrice;
  } else {
    risk   = stopPrice - entryPrice;
    reward = entryPrice - targetPrice;
  }

  if (risk <= 0) return null;
  return reward / risk;
}

export function getAutoFillEntryPrice(allCandles: Candle[], cursorTs: number): number | null {
  const visible = filterCandles(allCandles, cursorTs);
  if (visible.length === 0) return null;
  return visible[visible.length - 1].close;
}

export function getRRStats(
  direction: Direction,
  entryPrice: number,
  stopPrice: number,
  targetPrice: number,
  lotSize: number
): { risk: number; reward: number; rrRatio: number | null; notional: number } {
  const dir = direction === 'Long' ? 1 : -1;
  const risk   = Math.abs(entryPrice - stopPrice) * lotSize;
  const reward = Math.abs(targetPrice - entryPrice) * lotSize;
  const rrRatio = risk > 0 ? reward / risk : null;
  const notional = entryPrice * lotSize;
  return { risk: risk * dir, reward: reward * dir, rrRatio, notional };
}
