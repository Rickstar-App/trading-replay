// Browser-only — import via: const Chart = dynamic(() => import('@/components/Chart').then(m => m.Chart), { ssr: false })
import { useEffect, useRef } from 'react';
import {
  createChart,
  ColorType,
  LineStyle,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type IPriceLine,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { Candle, Trade } from '@/lib/types';

const C = {
  background: '#0d1117',
  text: '#8b949e',
  grid: '#21262d',
  border: '#30363d',
  candleUp: '#3fb950',
  candleDown: '#f85149',
  volUp: 'rgba(63,185,80,0.4)',
  volDown: 'rgba(248,81,73,0.4)',
  lineEntry: '#388bfd',
  lineTarget: '#3fb950',
  lineStop: '#f85149',
  lineRefDay: '#8b949e',
} as const;

interface ChartProps {
  candles: Candle[];
  prevDayClose?: number | null;
  openTrade?: Trade | null;
}

export function Chart({ candles, prevDayClose, openTrade }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const prevDayLineRef = useRef<IPriceLine | null>(null);
  const entryLineRef = useRef<IPriceLine | null>(null);
  const stopLineRef = useRef<IPriceLine | null>(null);
  const targetLineRef = useRef<IPriceLine | null>(null);

  // Mount: create chart instance
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight || 500,
      layout: {
        background: { type: ColorType.Solid, color: C.background },
        textColor: C.text,
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      },
      grid: {
        vertLines: { color: C.grid },
        horzLines: { color: C.grid },
      },
      rightPriceScale: { borderColor: C.border },
      timeScale: {
        borderColor: C.border,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: { mode: 1 },
      // Show all times in ET so they match real trading platforms
      localization: {
        timeFormatter: (time: number) =>
          new Date(time * 1000).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/New_York',
            hour12: false,
          }) + ' ET',
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: C.candleUp,
      downColor: C.candleDown,
      wickUpColor: C.candleUp,
      wickDownColor: C.candleDown,
      borderVisible: false,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      prevDayLineRef.current = null;
      entryLineRef.current = null;
      stopLineRef.current = null;
      targetLineRef.current = null;
    };
  }, []);

  // Update candle + volume data on each replay tick
  useEffect(() => {
    const cs = candleSeriesRef.current;
    const vs = volumeSeriesRef.current;
    if (!cs || !vs || candles.length === 0) return;

    const barData = candles.map((c) => ({
      time: Math.floor(c.ts / 1000) as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    const volData = candles.map((c) => ({
      time: Math.floor(c.ts / 1000) as UTCTimestamp,
      value: c.volume ?? 0,
      color: c.close >= c.open ? C.volUp : C.volDown,
    }));

    cs.setData(barData);
    vs.setData(volData);
  }, [candles]);

  // Pre-market reference line (prev day close), created on SERIES (not chart)
  useEffect(() => {
    const cs = candleSeriesRef.current;
    if (!cs) return;

    if (prevDayLineRef.current) {
      cs.removePriceLine(prevDayLineRef.current);
      prevDayLineRef.current = null;
    }

    if (prevDayClose != null) {
      prevDayLineRef.current = cs.createPriceLine({
        price: prevDayClose,
        color: C.lineRefDay,
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'prev close',
      });
    }
  }, [prevDayClose]);

  // Trade price lines (entry / stop / target)
  useEffect(() => {
    const cs = candleSeriesRef.current;
    if (!cs) return;

    // Remove existing trade lines
    if (entryLineRef.current) { cs.removePriceLine(entryLineRef.current); entryLineRef.current = null; }
    if (stopLineRef.current)  { cs.removePriceLine(stopLineRef.current);  stopLineRef.current  = null; }
    if (targetLineRef.current){ cs.removePriceLine(targetLineRef.current); targetLineRef.current = null; }

    if (!openTrade) return;

    entryLineRef.current = cs.createPriceLine({
      price: openTrade.entryPrice,
      color: C.lineEntry,
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: 'entry',
    });
    stopLineRef.current = cs.createPriceLine({
      price: openTrade.stopPrice,
      color: C.lineStop,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'stop',
    });
    targetLineRef.current = cs.createPriceLine({
      price: openTrade.targetPrice,
      color: C.lineTarget,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'target',
    });
  }, [openTrade]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
      aria-label="Price chart"
    />
  );
}
