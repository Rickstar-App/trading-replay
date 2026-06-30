export type InstrumentType = 'equity' | 'futures' | 'crypto';

export interface TickerConfig {
  symbol: string;
  label: string;
  type: InstrumentType;
  exchange?: string;    // Twelve Data exchange param (futures only, ignored when dataSource=yf)
  dataSource?: 'twelvedata' | 'yf';
}

// Session windows (America/New_York timezone, passed to Twelve Data):
//   equity  → 09:30:00 – 20:00:00 on date D (Mon–Fri only)
//   futures → 18:00:00 on (D-1 calendar) – 17:00:00 on D (Sun 6 PM opens Mon session)
//   crypto  → 00:00:00 – 23:59:00 on date D, every day including weekends
export const TICKERS: TickerConfig[] = [
  // US Equities — regular session 9:30 AM – 4:00 PM ET, Mon–Fri
  { symbol: 'SPY',     label: 'SPY  — S&P 500 ETF',           type: 'equity' },
  { symbol: 'QQQ',     label: 'QQQ  — Nasdaq 100 ETF',        type: 'equity' },
  { symbol: 'IWM',     label: 'IWM  — Russell 2000 ETF',      type: 'equity' },
  { symbol: 'AAPL',    label: 'AAPL — Apple',                  type: 'equity' },
  { symbol: 'TSLA',    label: 'TSLA — Tesla',                  type: 'equity' },
  { symbol: 'NVDA',    label: 'NVDA — Nvidia',                 type: 'equity' },
  // CME E-mini / Micro — Sun 6 PM ET – Fri 5 PM ET, 1-hr maintenance break 5–6 PM daily
  // dataSource: 'yf' → full overnight globex session via Databento GLBX.MDP3
  { symbol: 'ES',  label: 'ES  — S&P 500 Futures (CME)',  type: 'futures', exchange: 'CME',   dataSource: 'yf' },
  { symbol: 'NQ',  label: 'NQ  — Nasdaq Futures (CME)',   type: 'futures', exchange: 'CME',   dataSource: 'yf' },
  { symbol: 'MES', label: 'MES — Micro S&P 500 (CME)',    type: 'futures', exchange: 'CME',   dataSource: 'yf' },
  { symbol: 'MNQ', label: 'MNQ — Micro Nasdaq (CME)',     type: 'futures', exchange: 'CME',   dataSource: 'yf' },
  // COMEX / NYMEX — same 24/5 globex schedule, also on GLBX.MDP3
  { symbol: 'GC',  label: 'GC  — Gold Futures (COMEX)',   type: 'futures', exchange: 'COMEX', dataSource: 'yf' },
  { symbol: 'CL',  label: 'CL  — Crude Oil (NYMEX)',      type: 'futures', exchange: 'NYMEX', dataSource: 'yf' },
  // Crypto — 24/7, weekends included, no maintenance windows
  { symbol: 'BTC/USD', label: 'BTC/USD — Bitcoin',            type: 'crypto' },
  { symbol: 'ETH/USD', label: 'ETH/USD — Ethereum',           type: 'crypto' },
];

export function getTickerConfig(symbol: string): TickerConfig | undefined {
  return TICKERS.find((t) => t.symbol === symbol);
}

/** Crypto trades every calendar day; everything else skips weekends. */
export function allowsWeekends(type: InstrumentType): boolean {
  return type === 'crypto';
}
