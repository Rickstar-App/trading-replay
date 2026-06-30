import { useState, useRef, useCallback, useEffect } from 'react';
import type { Candle, Trade, SpeedMultiplier } from '@/lib/types';
import { filterCandles, resolveTradeAgainstCandle } from '@/lib/replay-engine';

export interface ReplayEngineResult {
  visibleCandles: Candle[];
  cursorTs: number;
  isPlaying: boolean;
  speedMultiplier: SpeedMultiplier;
  openTrade: Trade | null;
  closedTrades: Trade[];
  sessionComplete: boolean;
  totalCandles: number;
  replayTotalCandles: number;
  replayVisibleCount: number;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (speed: SpeedMultiplier) => void;
  enterTrade: (trade: Trade) => void;
  cancelTrade: () => void;
}

/**
 * @param allCandles - full day candles (oldest→newest)
 * @param replayStartTs - UTC ms to begin replay from; candles before this are
 *   shown immediately as static context. Defaults to allCandles[0].ts.
 */
export function useReplayEngine(allCandles: Candle[], replayStartTs?: number): ReplayEngineResult {
  // Start cursor 1ms before replayStartTs so the candle AT replayStartTs is the
  // first candle revealed through replay (not pre-shown as static context).
  const initialTs = replayStartTs != null ? replayStartTs - 1 : (allCandles[0]?.ts ?? 0);

  const [cursorTs, setCursorTs] = useState<number>(initialTs);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<SpeedMultiplier>(1);
  const [openTrade, setOpenTrade] = useState<Trade | null>(null);
  const [closedTrades, setClosedTrades] = useState<Trade[]>([]);
  const [sessionComplete, setSessionComplete] = useState(false);

  // Refs for rAF loop — avoid stale closures (Landmine #10)
  const cursorTsRef = useRef<number>(initialTs);
  const lastTickWallTimeRef = useRef<number>(Date.now());
  const isPlayingRef = useRef<boolean>(false);
  const speedMultiplierRef = useRef<SpeedMultiplier>(1);
  const sessionCompleteRef = useRef<boolean>(false);
  const openTradeRef = useRef<Trade | null>(null);
  const allCandlesRef = useRef<Candle[]>(allCandles);
  const rafRef = useRef<number | null>(null);
  // Track visible candle count to detect newly appeared candles on each tick
  const lastVisibleCountRef = useRef<number>(0);

  // New session or new startTs: cancel existing rAF, reset all state (Landmine #3)
  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    allCandlesRef.current = allCandles;
    const ts = replayStartTs != null ? replayStartTs - 1 : (allCandles[0]?.ts ?? 0);
    cursorTsRef.current = ts;
    setCursorTs(ts);
    isPlayingRef.current = false;
    setIsPlaying(false);
    sessionCompleteRef.current = false;
    setSessionComplete(false);
    openTradeRef.current = null;
    setOpenTrade(null);
    setClosedTrades([]);
    lastVisibleCountRef.current = 0;
  }, [allCandles, replayStartTs]);

  const tick = useCallback(() => {
    if (!isPlayingRef.current) return;

    const now = Date.now();
    const elapsed = Math.min(now - lastTickWallTimeRef.current, 200); // cap at 200ms to handle tab backgrounding
    lastTickWallTimeRef.current = now;

    const all = allCandlesRef.current;
    if (all.length === 0) return;

    const lastTs = all[all.length - 1].ts;
    let newCursorTs = cursorTsRef.current + elapsed * speedMultiplierRef.current;

    if (newCursorTs >= lastTs) {
      newCursorTs = lastTs;
      isPlayingRef.current = false;
      sessionCompleteRef.current = true;
      setIsPlaying(false);
      setSessionComplete(true);
    }

    cursorTsRef.current = newCursorTs;
    setCursorTs(newCursorTs);

    // Resolve open trade against any newly visible candles
    if (openTradeRef.current !== null) {
      const visible = filterCandles(all, newCursorTs);
      const startIdx = lastVisibleCountRef.current;
      for (let i = startIdx; i < visible.length; i++) {
        const resolved = resolveTradeAgainstCandle(openTradeRef.current, visible[i]);
        if (resolved !== null) {
          openTradeRef.current = null;
          setOpenTrade(null);
          setClosedTrades((prev) => [...prev, resolved]);
          lastVisibleCountRef.current = i + 1;
          break;
        }
      }
      if (openTradeRef.current !== null) {
        lastVisibleCountRef.current = filterCandles(all, newCursorTs).length;
      }
    } else {
      lastVisibleCountRef.current = filterCandles(all, newCursorTs).length;
    }

    if (isPlayingRef.current) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, []);

  const play = useCallback(() => {
    if (isPlayingRef.current || sessionCompleteRef.current) return;
    isPlayingRef.current = true;
    lastTickWallTimeRef.current = Date.now();
    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const pause = useCallback(() => {
    isPlayingRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlayingRef.current) {
      pause();
    } else {
      play();
    }
  }, [play, pause]);

  const setSpeed = useCallback((speed: SpeedMultiplier) => {
    speedMultiplierRef.current = speed;
    setSpeedMultiplier(speed);
  }, []);

  const enterTrade = useCallback((trade: Trade) => {
    openTradeRef.current = trade;
    setOpenTrade(trade);
    // Only resolve against candles appearing AFTER this moment
    lastVisibleCountRef.current = filterCandles(allCandlesRef.current, cursorTsRef.current).length;
  }, []);

  const cancelTrade = useCallback(() => {
    openTradeRef.current = null;
    setOpenTrade(null);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const visibleCandles = filterCandles(allCandles, cursorTs);
  // Candles strictly before the replay start — used for progress counting.
  // Use strict < so the candle AT replayStartTs is the first replay candle.
  const contextCandleCount = replayStartTs != null
    ? allCandles.filter((c) => c.ts < replayStartTs).length
    : 0;
  // Candles available to replay (from startTs onward)
  const replayTotalCandles = allCandles.length - contextCandleCount;
  // How many replay candles have been revealed so far
  const replayVisibleCount = Math.max(0, visibleCandles.length - contextCandleCount);

  return {
    visibleCandles,
    cursorTs,
    isPlaying,
    speedMultiplier,
    openTrade,
    closedTrades,
    sessionComplete,
    totalCandles: allCandles.length,
    replayTotalCandles,
    replayVisibleCount,
    play,
    pause,
    togglePlay,
    setSpeed,
    enterTrade,
    cancelTrade,
  };
}
