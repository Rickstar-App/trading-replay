# Design System — Day Trading Chart Replay Practice Tool

> **Memorable thing:** "I saw the setup before it played out." The lasting feeling after
> using this tool should be that the user recognized a real pattern under live conditions
> — not replayed with a mask over the future, but genuinely blind. Every design decision
> serves this: the dark felt keeps focus on price action, the data reads precisely in mono,
> the UI gets out of the way when the trade is live.

---

## Product Context

- **What this is:** A truly blind day-trading replay tool. Candles form forward from the
  open — future data never reaches the client. Users practice reading 1-min, 5-min, and
  15-min candle charts, pause to enter trades, and let the replay resolve stop/target.
- **Who it's for:** Aspiring day traders preparing for funded evaluation accounts (prop
  firm challenges). They need to compress multiple trading days of practice into a single
  session, wherever and whenever — not tethered to live market hours.
- **Differentiator:** Every competitor (TradingView replay, demo brokers) loads the full
  chart and masks future data. The chart spoils the answer. This tool builds forward —
  future data does not exist on the client until the cursor reaches it.
- **Project type:** Web app — Next.js + Lightweight Charts + Twelve Data API. Deployed
  on Vercel (live at https://trading-replay-topaz.vercel.app/); cache is ephemeral per
  invocation on Vercel — users pick dates manually since session history does not persist.

---

## Aesthetic Direction

- **Direction:** Industrial/Utilitarian — same DNA as the poker app
- **Decoration level:** Minimal — typography and color do all the work; no gradients,
  no decorative blobs, no icon grids
- **Mood:** Serious software for serious practice. The chart is dark, the data is precise,
  the UI is invisible. This feels like a Bloomberg terminal at midnight, not a trading
  education website.
- **Anti-patterns to avoid:** Purple/violet gradients, 3-column feature grids, bubble
  border-radius on everything, gradient CTA buttons, bright backgrounds behind the chart.

---

## Typography

- **Prices / Data:** `JetBrains Mono` — all prices (568.50), P&L (+$150), R:R (1.5),
  lot sizes, progress counters, volume numbers. `font-variant-numeric: tabular-nums` on
  all price columns.
- **UI Copy:** `Inter` — labels, buttons, status bar text, form labels, error messages.
  Inter is intentionally invisible: the price data (Mono) is the product, the copy is
  scaffolding.
- **Loading:** Both fonts via Google Fonts CDN. Preconnect tags in `<head>`.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
```

- **Scale:**

| Role | Font | Size | Weight |
|------|------|------|--------|
| Price / P&L display | JetBrains Mono | 18px / 1.125rem | 700 |
| Form input values | JetBrains Mono | 14px / 0.875rem | 500 |
| R:R / stats numbers | JetBrains Mono | 13px / 0.8125rem | 500 |
| Status bar numbers | JetBrains Mono | 12px / 0.75rem | 400 |
| Section heading | Inter | 18px / 1.125rem | 600 |
| Button labels | Inter | 14px / 0.875rem | 500 |
| Form labels | Inter | 12px / 0.75rem | 500 |
| Secondary / muted | Inter | 13px / 0.8125rem | 400 |
| Loading state | JetBrains Mono | 14px / 0.875rem | 400 |

---

## Color

- **Approach:** Restrained — 2 accent colors (green, blue) against a deep green/dark
  neutral system. Color is rare and meaningful. Green = bullish/profit/target.
  Red = bearish/loss/stop. Blue = entry/neutral information.

```css
:root {
  /* Surfaces */
  --table:   #0a1a10;   /* chart felt — the trading canvas itself */
  --chrome:  #0d1117;   /* outermost background, top bar, status bar */
  --surface: #161b22;   /* panels, modals, right-side order entry */
  --border:  #30363d;   /* dividers, input borders, panel separators */

  /* Accents */
  --accent-green: #3fb950;  /* positive, correct, bullish */
  --accent-blue:  #388bfd;  /* entry price, current information, neutral info */

  /* Text */
  --text-primary:   #f0f6fc;  /* main readable text */
  --text-secondary: #8b949e;  /* labels, muted context, secondary info */

  /* Semantic */
  --success: #3fb950;   /* target hit, positive P&L */
  --warning: #d29922;   /* marginal R:R, edge cases */
  --error:   #f85149;   /* stopped out, negative P&L, bearish */

  /* ── Trading-specific additions ── */

  /* Candle colors */
  --candle-up:   #3fb950;  /* bullish candle body + wick (same as --success) */
  --candle-down: #f85149;  /* bearish candle body + wick (same as --error) */

  /* Volume histogram (lower opacity — stay secondary, don't compete with candles) */
  --vol-up:   rgba(63, 185, 80,  0.4);
  --vol-down: rgba(248, 81, 73,  0.4);

  /* Open trade price lines on chart */
  --line-entry:  #388bfd;   /* entry price line (same as --accent-blue) */
  --line-target: #3fb950;   /* target price line (same as --success) */
  --line-stop:   #f85149;   /* stop price line (same as --error) */

  /* Pre-market reference line */
  --line-refday: #8b949e;   /* prior day close, dashed (same as --text-secondary) */
}
```

- **Dark mode:** This IS the dark mode. There is no light mode. The dark chart green
  (`--table`) is the product's identity — identical reasoning to the poker app.
- **Contrast:** All body text (`--text-primary` on `--chrome`/`--surface`) must pass
  WCAG AA (4.5:1 minimum).

---

## Spacing

- **Base unit:** 4px — trading data is dense; tight spacing reads as authentic and
  professional.
- **Scale:**

```css
:root {
  --space-2xs: 2px;
  --space-xs:  4px;
  --space-sm:  8px;
  --space-md:  16px;
  --space-lg:  24px;
  --space-xl:  32px;
  --space-2xl: 48px;
  --space-3xl: 64px;
}
```

- **Touch targets:** Minimum 44px height on all interactive elements.

---

## Layout

- **Minimum viewport:** 1024px. Chart + right-side panel require width to be readable.
  No graceful degradation below 1024px in v1 (localhost desktop tool).

```
┌──────────────────────────────────────────────────────────────────────┐
│  TOP CONTROL BAR (48px)                                               │
│  [SPY] [2025-03-14] [1min|5min|15min]  [ ⏸ ]        [1x|2x|5x|10x] │
├──────────────────────────────────────┬───────────────────────────────┤
│                                       │  ORDER ENTRY (280px)          │
│  CHART AREA (~75% width)              │  [  LONG  ] [    SHORT    ]   │
│  $569.42  +2.42 (+0.43%)             │  ENTRY  [  568.50  ]          │
│  ┌──────────────────── [2x] ───────┐ │  STOP   [  566.00  ]          │
│  │  candlestick + volume           │ │  TARGET [  571.00  ]          │
│  │  price lines: entry/stop/target │ │  LOT    [  100     ]          │
│  └─────────────────────────────────┘ │  Risk $250  Reward $250       │
│                                       │  R:R 1.0   Notional $56,850  │
│                                       │  [ SUBMIT TRADE ]             │
├──────────────────────────────────────┴───────────────────────────────┤
│  STATUS BAR (28px)   ● Live Replay | Candle: 10:30 | 25/78 | P&L    │
└──────────────────────────────────────────────────────────────────────┘
```

- **Border radius:**
  - Inputs: `4px`
  - Buttons: `6px`
  - Panels / modals: `8px`
  - Toast overlays: `6px`
  - Segmented buttons: `6px` (outer), `4px` (inner segments)

---

## Lightweight Charts Theme

Passed to `createChart()` options object:

```typescript
import { ColorType } from 'lightweight-charts';

export const chartOptions = {
  layout: {
    background: { type: ColorType.Solid, color: '#0a1a10' },  // --table
    textColor: '#8b949e',                                       // --text-secondary
  },
  grid: {
    vertLines: { color: '#30363d' },  // --border
    horzLines: { color: '#30363d' },
  },
  crosshair: {
    vertLine: { color: '#8b949e' },
    horzLine: { color: '#8b949e' },
  },
  timeScale: {
    borderColor: '#30363d',
  },
};

export const candleSeriesOptions = {
  upColor:         '#3fb950',  // --candle-up
  downColor:       '#f85149',  // --candle-down
  borderUpColor:   '#3fb950',
  borderDownColor: '#f85149',
  wickUpColor:     '#3fb950',
  wickDownColor:   '#f85149',
};
```

---

## Motion

- **Approach:** Functional only — every animation serves feedback, not decoration.

| Interaction | Animation | Duration | Easing |
|---|---|---|---|
| Trade form panel (right side) | Slide in from right | 150ms | `ease-out` |
| Trade form panel (hide) | Slide out to right | 150ms | `ease-in` |
| Trade outcome toast | Fade in | 150ms | `ease-out` |
| Trade outcome toast (dismiss) | Fade out | 150ms | `ease-in` |
| Loading cursor blink | `blink 1s step-end infinite` | loop | — |

```css
:root {
  --ease-out:    cubic-bezier(0.0, 0.0, 0.2, 1.0);
  --ease-in:     cubic-bezier(0.4, 0.0, 1.0, 1.0);
  --ease-in-out: cubic-bezier(0.4, 0.0, 0.2, 1.0);

  --duration-micro:  75ms;
  --duration-short:  150ms;
  --duration-medium: 250ms;
  --duration-long:   400ms;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0; }
}
```

---

## Interaction Patterns

| Pattern | Spec |
|---|---|
| Segmented buttons | `[1min\|5min\|15min]`, `[LONG\|SHORT]`, `[1x\|2x\|5x\|10x]` — same visual pattern everywhere |
| LONG active state | `--candle-up: #3fb950` background, `--text-primary` text |
| SHORT active state | `--candle-down: #f85149` background, `--text-primary` text |
| Speed/interval active | `--accent-green` background, `--text-primary` text |
| Inactive segment | `--surface` background, `--text-secondary` text |
| Loading state | `"Loading session_"` in JetBrains Mono, centered in chart area, blinking cursor animation |
| Trade outcome toast | Top-right of chart area, 180px min-width, 3-sec auto-dismiss, no user dismiss required |
| Error banners | Full-width below top bar: blue (429 rate limit), red (503 data unavailable) |

---

## Accessibility

- **Keyboard:** Space = play/pause; 1/2/5/0 = speed (1×/2×/5×/10×); L/S = direction; Tab/Enter = form navigation
- **ARIA:** `role="toolbar"` on top bar; `aria-live="polite"` on speed badge; `role="alert"` on error banners
- **Labels:** Visible `<label>` ABOVE each form input — not placeholder-only
- **Focus ring:** Do not suppress `outline` on any interactive element
- **Color alone:** Never use color alone to indicate trade outcome — pair with text ("Target hit" / "Stopped out")

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-28 | Aesthetic: Industrial/Utilitarian, dark poker green | Same DNA as poker app; serious software for serious practice |
| 2026-06-28 | Typography: JetBrains Mono (prices/data) + Inter (UI copy) | Mono for price authenticity; Inter invisible scaffolding |
| 2026-06-28 | Color: poker app tokens adopted verbatim + 8 trading additions | Dark green felt + GitHub neutrals; trading tokens added for candles/lines |
| 2026-06-28 | Layout: right-side 280px ORDER ENTRY panel (D1 revised) | Gives more vertical chart space; visually approved via /design-shotgun Variant C |
| 2026-06-28 | R:R stats strip below form fields | Auto-calculated live; critical context for prop-firm evaluation practice |
| 2026-06-28 | Progress status bar at bottom | Candle time + N/78 progress + live P&L — real-time session state |
| 2026-06-28 | Trade outcome toast top-right of chart, 3-sec auto-dismiss (D3) | Non-blocking; doesn't interrupt chart view; fast feedback loop |
| 2026-06-28 | Segmented button pattern for all multi-choice controls (D6) | Consistent vocabulary: intervals, direction, speed all use the same component |
| 2026-06-28 | Loading state: "Loading session_" blinking cursor in JetBrains Mono (D5) | Terminal aesthetic; fits the dark tool identity; distinctive |
| 2026-06-28 | No light mode | Dark chart IS the identity — same decision as poker app |
| 2026-06-28 | Min viewport 1024px, no mobile in v1 | Localhost desktop tool; chart + right panel need width |
