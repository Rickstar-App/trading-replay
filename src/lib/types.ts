export type Interval = '1min' | '5min' | '15min';
export type SpeedMultiplier = 1 | 2 | 5 | 10;
export type Direction = 'Long' | 'Short';
export type TradeOutcome = 'target' | 'stopped';

export interface Candle {
  ts: number;     // Unix milliseconds, oldest-to-newest (server normalizes)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Trade {
  direction: Direction;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  lotSize: number;
  fillPrice?: number;
  outcome?: TradeOutcome;
  pnl?: number;
}

export interface ReplayState {
  allCandles: Candle[];       // complete day, never mutates after session load
  cursorTs: number;           // current "now" in the replay (Unix ms)
  isPlaying: boolean;
  speedMultiplier: SpeedMultiplier;
  openTrade: Trade | null;
  closedTrades: Trade[];
}

export interface SessionsResponse {
  dates: string[];            // sorted YYYY-MM-DD strings
}

export interface CandlesResponse {
  candles: Candle[];
}

export interface ApiError {
  error: string;
  message: string;
}
