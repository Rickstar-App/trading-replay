import type { NextPage } from 'next';
import dynamic from 'next/dynamic';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Candle, Direction, SpeedMultiplier, Trade } from '@/lib/types';
import { useReplayEngine } from '@/hooks/useReplayEngine';
import { TradeForm } from '@/components/TradeForm';
import { SessionCompleteOverlay } from '@/components/SessionCompleteOverlay';
import { SpeedBadge } from '@/components/SpeedBadge';
import { TradeOutcomeToast } from '@/components/TradeOutcomeToast';
import { getAutoFillEntryPrice } from '@/lib/replay-engine';
import { generateEtTimeOptions, etToUtcMs } from '@/lib/time-utils';
import { TICKERS, getTickerConfig } from '@/lib/ticker-config';

// SSR bypass — Lightweight Charts requires browser APIs
const Chart = dynamic(
  () => import('@/components/Chart').then((m) => m.Chart),
  { ssr: false, loading: () => <ChartSkeleton /> }
);

const INTERVALS = ['1min', '5min', '15min'] as const;
type Interval = typeof INTERVALS[number];

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function ChartSkeleton() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--chrome)',
        color: 'var(--text-secondary)',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '14px',
      }}
    >
      <span className="loading-cursor">Loading session_</span>
    </div>
  );
}

// ─── Session picker ───────────────────────────────────────────────────────────

const ET_TIME_OPTIONS = generateEtTimeOptions();
// Default start time: 9:30 AM ET (market open)
const DEFAULT_ET_MINUTES = 9 * 60 + 30;

interface SessionPickerProps {
  onStart: (symbol: string, interval: Interval, date: string, etMinutes: number) => void;
  loading: boolean;
  error?: string;
}

const TICKER_GROUPS = [
  { label: 'US Equities', tickers: TICKERS.filter((t) => t.type === 'equity') },
  { label: 'Futures (24/5)', tickers: TICKERS.filter((t) => t.type === 'futures') },
  { label: 'Crypto (24/7)', tickers: TICKERS.filter((t) => t.type === 'crypto') },
];

function SessionPicker({ onStart, loading, error }: SessionPickerProps) {
  const [symbol, setSymbol] = useState(TICKERS[0].symbol);
  const [interval, setInterval] = useState<Interval>('5min');
  const [date, setDate] = useState('');
  const [etMinutes, setEtMinutes] = useState(DEFAULT_ET_MINUTES);

  const tickerConfig = TICKERS.find((t) => t.symbol === symbol);
  const canSubmit = !loading && date.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    onStart(symbol, interval, date, etMinutes);
  };

  const startTimeHint =
    tickerConfig?.dataSource === 'yf'
      ? 'Full overnight globex session shown as context before this time'
      : tickerConfig?.type === 'crypto'
      ? 'Earlier same-day candles shown as context before this time'
      : 'Previous day\'s regular session shown as context before this time';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        gap: 'var(--space-lg)',
        padding: 'var(--space-3xl)',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
          Chart Replay
        </div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Practice day trading in blind replay — no future candles visible
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)', width: 320 }}>
        <label style={pickerLabelStyle}>
          <span style={pickerLabelTextStyle}>Instrument</span>
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            style={{ ...pickerInputStyle, cursor: 'pointer' }}
          >
            {TICKER_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.tickers.map((t) => (
                  <option key={t.symbol} value={t.symbol}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <label style={pickerLabelStyle}>
          <span style={pickerLabelTextStyle}>Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            style={pickerInputStyle}
          />
          {tickerConfig?.type === 'crypto' && (
            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: 2 }}>
              Weekends are valid for crypto
            </span>
          )}
        </label>

        {/* Start time dropdown — 30-min intervals, 8:30 AM → 10:00 PM ET */}
        <label style={pickerLabelStyle}>
          <span style={pickerLabelTextStyle}>Replay start time (ET)</span>
          <select
            value={etMinutes}
            onChange={(e) => setEtMinutes(Number(e.target.value))}
            style={{ ...pickerInputStyle, cursor: 'pointer' }}
          >
            {ET_TIME_OPTIONS.map((opt) => (
              <option key={opt.etMinutes} value={opt.etMinutes}>
                {opt.label}
              </option>
            ))}
          </select>
          <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: 2 }}>
            {startTimeHint}
          </span>
        </label>

        <div>
          <span style={pickerLabelTextStyle}>Interval</span>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            {INTERVALS.map((iv) => (
              <button
                key={iv}
                type="button"
                onClick={() => setInterval(iv)}
                aria-pressed={interval === iv}
                style={{
                  flex: 1,
                  padding: '8px 0',
                  borderRadius: 4,
                  border: '1px solid var(--border)',
                  background: interval === iv ? 'var(--accent-blue)' : 'var(--surface)',
                  color: interval === iv ? '#fff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {iv}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ color: 'var(--error)', fontSize: '13px', padding: '8px 0' }}>{error}</div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            marginTop: 'var(--space-xs)',
            padding: '10px 0',
            background: 'var(--accent-green)',
            border: 'none',
            borderRadius: 4,
            color: '#fff',
            fontSize: '14px',
            fontWeight: 700,
            cursor: 'pointer',
            opacity: !canSubmit ? 0.5 : 1,
          }}
        >
          {loading ? 'Loading...' : 'Start Session'}
        </button>
      </div>
    </div>
  );
}

// ─── Progress status bar (T23) ────────────────────────────────────────────────

interface StatusBarProps {
  cursorTs: number;
  visibleCount: number;
  totalCount: number;
  isPlaying: boolean;
  pnl: number;
  tradeCount: number;
}

function StatusBar({ cursorTs, visibleCount, totalCount, isPlaying, pnl, tradeCount }: StatusBarProps) {
  const time = cursorTs
    ? new Date(cursorTs).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/New_York' })
    : '--:--:--';
  const pnlStr = (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toFixed(2);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-lg)',
        padding: '0 var(--space-md)',
        height: 32,
        background: 'var(--chrome)',
        borderTop: '1px solid var(--border)',
        fontSize: '11px',
        color: 'var(--text-secondary)',
        fontFamily: "'JetBrains Mono', monospace",
        flexShrink: 0,
      }}
    >
      <span style={{ color: isPlaying ? 'var(--accent-green)' : 'var(--text-secondary)' }}>
        {isPlaying ? '● Live Replay' : '⏸ Paused'}
      </span>
      <span>Candle: {time} ET</span>
      <span>Progress: {visibleCount}/{totalCount}</span>
      <span style={{ color: pnl >= 0 ? 'var(--success)' : 'var(--error)' }}>P&L: {pnlStr}</span>
      <span>Trades: {tradeCount}</span>
    </div>
  );
}

// ─── Top bar ──────────────────────────────────────────────────────────────────

interface TopBarProps {
  symbol: string;
  date: string;
  interval: string;
  isPlaying: boolean;
  speed: SpeedMultiplier;
  onTogglePlay: () => void;
  onSpeedChange: (s: SpeedMultiplier) => void;
  onReset: () => void;
  onNewSession: () => void;
  hasSession: boolean;
}

function TopBar({ symbol, date, interval, isPlaying, speed, onTogglePlay, onSpeedChange, onReset, onNewSession, hasSession }: TopBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-md)',
        padding: '0 var(--space-md)',
        height: 48,
        background: 'var(--chrome)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', minWidth: 80 }}>
        {hasSession ? `${symbol} · ${interval}` : 'Trading Replay'}
      </div>

      {hasSession && (
        <>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: "'JetBrains Mono', monospace" }}>
            {date}
          </div>

          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            style={{
              background: isPlaying ? 'var(--surface)' : 'var(--accent-green)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: '#fff',
              cursor: 'pointer',
              fontSize: '16px',
              padding: '4px 12px',
              lineHeight: 1,
            }}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          <SpeedBadge speed={speed} isPlaying={isPlaying} onChange={onSpeedChange} />

          <div style={{ flex: 1 }} />

          <button
            type="button"
            onClick={onReset}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '4px 10px',
            }}
          >
            ↩ Reset
          </button>

          <button
            type="button"
            onClick={onNewSession}
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '4px 10px',
            }}
          >
            ← Menu
          </button>
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const Home: NextPage = () => {
  const [allCandles, setAllCandles] = useState<Candle[]>([]);
  const [prevDayClose, setPrevDayClose] = useState<number | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionSymbol, setSessionSymbol] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionInterval, setSessionInterval] = useState<Interval>('5min');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [toastTrade, setToastTrade] = useState<Trade | null>(null);
  const [sessionStartWall, setSessionStartWall] = useState<number>(0);
  const [direction, setDirection] = useState<Direction>('Long');
  const [replayStartTs, setReplayStartTs] = useState<number | undefined>(undefined);
  const [sessionEtMinutes, setSessionEtMinutes] = useState<number | undefined>(undefined);

  const engine = useReplayEngine(allCandles, replayStartTs);
  const {
    visibleCandles, cursorTs, isPlaying, speedMultiplier,
    openTrade, closedTrades, sessionComplete,
    replayTotalCandles, replayVisibleCount,
    togglePlay, setSpeed, enterTrade, cancelTrade,
  } = engine;

  const hasSession = allCandles.length > 0;
  const totalPnl = closedTrades.reduce((s, t) => s + (t.pnl ?? 0), 0);

  // Detect newly resolved trades to show toast
  const prevClosedLenRef = useRef(0);
  useEffect(() => {
    if (closedTrades.length > prevClosedLenRef.current) {
      const latest = closedTrades[closedTrades.length - 1];
      setToastTrade(latest);
    }
    prevClosedLenRef.current = closedTrades.length;
  }, [closedTrades]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          if (hasSession) togglePlay();
          break;
        case 'Digit1':
          setSpeed(1);
          break;
        case 'Digit2':
          setSpeed(2);
          break;
        case 'Digit5':
          setSpeed(5);
          break;
        case 'Digit0':
          setSpeed(10);
          break;
        case 'KeyL':
          setDirection('Long');
          break;
        case 'KeyS':
          setDirection('Short');
          break;
        case 'Escape':
          if (openTrade) cancelTrade();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hasSession, togglePlay, setSpeed, openTrade, cancelTrade]);

  const loadSession = useCallback(async (symbol: string, interval: Interval, date: string, etMinutes?: number) => {
    setLoadingSession(true);
    setLoadError('');
    setAllCandles([]);
    setPrevDayClose(null);

    try {
      const ticker = getTickerConfig(symbol);
      const isCrypto = ticker?.type === 'crypto';

      // Crypto trades every day; equities and futures skip weekends
      const prevDate = isCrypto ? getPrevCalendarDay(date) : getPrevWeekday(date);

      const candleUrl = (d: string) => {
        const params = new URLSearchParams({ symbol, interval, date: d });
        if (ticker?.dataSource === 'yf') {
          return `/api/yf-candles?${params}`;
        }
        if (ticker?.type && ticker.type !== 'equity') params.set('type', ticker.type);
        if (ticker?.exchange) params.set('exchange', ticker.exchange);
        return `/api/candles?${params}`;
      };

      // Fetch today first, then prev day serially to avoid concurrent API calls
      // hitting the free-tier rate limit on first load.
      const res = await fetch(candleUrl(date));

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
        throw new Error(err.message ?? 'Failed to load session');
      }
      const data = await res.json();
      if (!data.candles || data.candles.length === 0) {
        throw new Error(`No data available for ${symbol} on ${date}`);
      }

      const prevRes = prevDate ? await fetch(candleUrl(prevDate)) : null;

      // Previous day context (best-effort — don't fail the session if unavailable)
      let prevCandles: Candle[] = [];
      if (prevRes && prevRes.ok) {
        const prevData = await prevRes.json().catch(() => null);
        if (prevData?.candles?.length) {
          prevCandles = prevData.candles;
          setPrevDayClose(prevCandles[prevCandles.length - 1].close);
        }
      }

      if (etMinutes !== undefined) {
        setReplayStartTs(etToUtcMs(date, etMinutes));
      } else {
        setReplayStartTs(undefined);
      }

      // Stitch: prev day session (all ts < replayStartTs → auto context) + today
      setAllCandles([...prevCandles, ...data.candles]);
      setSessionSymbol(symbol);
      setSessionDate(date);
      setSessionInterval(interval);
      setSessionEtMinutes(etMinutes);
      setSessionStartWall(Date.now());

      // Load available session dates for "Next Session" button
      fetch(`/api/sessions?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}`)
        .then((r) => r.json())
        .then((d) => setAvailableDates(d.dates ?? []))
        .catch(() => {});

    } catch (err) {
      setLoadError((err as Error).message);
    } finally {
      setLoadingSession(false);
    }
  }, []);

  const handleNextSession = useCallback(() => {
    const idx = availableDates.indexOf(sessionDate);
    if (idx >= 0 && idx < availableDates.length - 1) {
      loadSession(sessionSymbol, sessionInterval, availableDates[idx + 1], sessionEtMinutes);
    }
  }, [availableDates, sessionDate, sessionSymbol, sessionInterval, sessionEtMinutes, loadSession]);

  const handleNewSession = useCallback(() => {
    setAllCandles([]);
    setSessionSymbol('');
    setLoadError('');
  }, []);

  const handleReset = useCallback(() => {
    // Trigger engine reset by replacing the array reference
    setAllCandles((prev) => [...prev]);
  }, []);

  const suggestedEntry = hasSession ? getAutoFillEntryPrice(allCandles, cursorTs) : null;
  const nextSessionAvailable = !!availableDates[availableDates.indexOf(sessionDate) + 1];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--table)',
        color: 'var(--text-primary)',
        overflow: 'hidden',
      }}
    >
      <TopBar
        symbol={sessionSymbol}
        date={sessionDate}
        interval={sessionInterval}
        isPlaying={isPlaying}
        speed={speedMultiplier}
        onTogglePlay={togglePlay}
        onSpeedChange={setSpeed}
        onReset={handleReset}
        onNewSession={handleNewSession}
        hasSession={hasSession}
      />

      {/* Main content area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {!hasSession ? (
          <SessionPicker onStart={loadSession} loading={loadingSession} error={loadError} />
        ) : (
          <>
            {/* Chart area — takes remaining width */}
            <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Chart
                candles={visibleCandles}
                prevDayClose={prevDayClose}
                openTrade={openTrade}
              />
              {/* Trade outcome toast — positioned relative to chart area */}
              <TradeOutcomeToast trade={toastTrade} onDismiss={() => setToastTrade(null)} />
            </div>

            {/* Right-side ORDER ENTRY panel (D1 revised, T21) — fixed 280px */}
            <TradeForm
              suggestedEntry={suggestedEntry}
              onSubmit={enterTrade}
              onCancel={cancelTrade}
              disabled={openTrade !== null}
              activeDirection={direction}
              onDirectionChange={setDirection}
            />
          </>
        )}
      </div>

      {/* Progress status bar (T23) */}
      {hasSession && (
        <StatusBar
          cursorTs={cursorTs}
          visibleCount={replayVisibleCount}
          totalCount={replayTotalCandles}
          isPlaying={isPlaying}
          pnl={totalPnl}
          tradeCount={closedTrades.length}
        />
      )}

      {/* Session complete overlay (T10) */}
      {sessionComplete && (
        <SessionCompleteOverlay
          closedTrades={closedTrades}
          sessionDurationMs={Date.now() - sessionStartWall}
          onNewSession={handleNewSession}
          onNextSession={handleNextSession}
          hasNextSession={nextSessionAvailable}
        />
      )}
    </div>
  );
};

export default Home;

// ─── Utilities ────────────────────────────────────────────────────────────────

function getPrevWeekday(dateStr: string): string | null {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() - 2); // Sunday → Friday
  if (d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1); // Saturday → Friday
  return d.toISOString().slice(0, 10);
}

function getPrevCalendarDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// ─── Picker styles ────────────────────────────────────────────────────────────

const pickerLabelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const pickerLabelTextStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const pickerInputStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-primary)',
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: '14px',
  padding: '8px 10px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};
