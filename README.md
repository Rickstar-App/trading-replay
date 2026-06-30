# Chart Replay

A truly blind day-trading replay tool. Candles build forward from the session open — future data never reaches the browser. Practice reading price action, entering trades, and resolving stops and targets under realistic conditions.

**[Try it live →](https://trading-replay-topaz.vercel.app/)**

---

## What makes this different

Every other replay tool (TradingView replay, demo brokers) loads the full chart and masks future candles. The chart layout spoils the answer. Chart Replay builds forward — future candles do not exist on the client until the cursor reaches them.

---

## Features

- **Blind replay** — candles render one at a time at a configurable speed (1×, 2×, 5×, 10×)
- **Order entry** — Long/Short direction, entry/stop/target prices, lot size
- **Live R:R stats** — risk, reward, R:R ratio, and notional value calculated in real time
- **Trade resolution** — replay auto-stops when price hits your stop or target; P&L shown immediately
- **Session controls** — play/pause (Space), speed, reset, and return to instrument picker
- **Keyboard shortcuts** — Space play/pause · 1 2 5 0 speed · L / S direction · Enter submit · Esc cancel

### Supported instruments

| Category | Symbols |
|---|---|
| US Equities | SPY, QQQ, IWM, AAPL, TSLA, NVDA |
| CME Futures | ES, NQ, MES, MNQ |
| COMEX / NYMEX | GC (Gold), CL (Crude Oil) |
| Crypto | BTC/USD, ETH/USD |

### Intervals

1-min · 5-min · 15-min

---

## Data availability

| Instrument | Source | 1-min lookback | 5-min / 15-min lookback |
|---|---|---|---|
| Equities | Twelve Data | ~1 year | ~1 year |
| Futures | Yahoo Finance | 7 days | 60 days |
| Crypto | Twelve Data | ~1 year | ~1 year |

Futures data covers the full overnight Globex session (6 PM ET prior day → 5 PM ET session date). Equities cover regular + extended hours (9:30 AM – 8 PM ET).

---

## Running locally

```bash
git clone https://github.com/Rickstar-App/trading-replay.git
cd trading-replay
npm install
```

Create `.env.local` with your [Twelve Data](https://twelvedata.com) API key (free tier, no card required):

```
TWELVE_DATA_API_KEY=your_key_here
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Candle data is cached to `data/` on first fetch — subsequent loads for the same symbol/date are instant.

---

## Tech stack

- [Next.js](https://nextjs.org) — Pages Router, API routes
- [Lightweight Charts v5](https://tradingview.github.io/lightweight-charts/) — candlestick + volume rendering
- [Twelve Data](https://twelvedata.com) — equities and crypto OHLCV data
- [Yahoo Finance Chart API](https://query1.finance.yahoo.com) — futures (no key required)
- TypeScript throughout

---

## Keyboard reference

| Key | Action |
|---|---|
| Space | Play / Pause |
| 1 | 1× speed |
| 2 | 2× speed |
| 5 | 5× speed |
| 0 | 10× speed |
| L | Long direction |
| S | Short direction |
| Enter | Submit trade |
| Esc | Cancel open trade |

---

## License

MIT
