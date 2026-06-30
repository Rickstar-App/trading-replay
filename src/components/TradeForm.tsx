import { useState, useEffect, useRef, type FormEvent } from 'react';
import type { Trade, Direction } from '@/lib/types';
import { getRRStats } from '@/lib/replay-engine';

interface TradeFormProps {
  suggestedEntry?: number | null;
  onSubmit: (trade: Trade) => void;
  onCancel: () => void;
  disabled?: boolean;
  activeDirection?: Direction;
  onDirectionChange?: (d: Direction) => void;
}

function fmt(n: number, decimals = 2) {
  return n.toFixed(decimals);
}

function fmtPnl(n: number) {
  const s = Math.abs(n).toFixed(2);
  return n >= 0 ? `+$${s}` : `-$${s}`;
}

export function TradeForm({
  suggestedEntry,
  onSubmit,
  onCancel,
  disabled = false,
  activeDirection = 'Long',
  onDirectionChange,
}: TradeFormProps) {
  const [direction, setDirection] = useState<Direction>(activeDirection);
  const [entry, setEntry] = useState('');
  const [stop, setStop] = useState('');
  const [target, setTarget] = useState('');
  const [lot, setLot] = useState('100');
  const [error, setError] = useState('');

  const entryRef = useRef<HTMLInputElement>(null);
  const prevDisabledRef = useRef(disabled);

  // Auto-fill entry from last visible candle close
  useEffect(() => {
    if (suggestedEntry != null) {
      setEntry(String(suggestedEntry));
    }
  }, [suggestedEntry]);

  // Sync direction prop
  useEffect(() => {
    setDirection(activeDirection);
  }, [activeDirection]);

  // Clear stop/target when a trade is canceled (disabled true → false)
  useEffect(() => {
    if (prevDisabledRef.current === true && disabled === false) {
      setStop('');
      setTarget('');
    }
    prevDisabledRef.current = disabled;
  }, [disabled]);

  const handleDirectionChange = (d: Direction) => {
    setDirection(d);
    onDirectionChange?.(d);
  };

  const entryNum  = parseFloat(entry)  || 0;
  const stopNum   = parseFloat(stop)   || 0;
  const targetNum = parseFloat(target) || 0;
  const lotNum    = parseFloat(lot)    || 0;

  const rrValid = entryNum > 0 && stopNum > 0 && targetNum > 0 && lotNum > 0;
  const rrStats = rrValid
    ? getRRStats(direction, entryNum, stopNum, targetNum, lotNum)
    : null;

  const stopInverted = direction === 'Long'
    ? stopNum >= entryNum
    : stopNum <= entryNum && stopNum > 0;

  const targetInverted = direction === 'Long'
    ? targetNum <= entryNum && targetNum > 0
    : targetNum >= entryNum && targetNum > 0;

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (disabled) return;

    if (!entryNum || !stopNum || !targetNum || !lotNum) {
      setError('All fields required');
      return;
    }
    if (lotNum <= 0) {
      setError('Lot size must be > 0');
      return;
    }

    setError('');
    onSubmit({
      direction,
      entryPrice: entryNum,
      stopPrice: stopNum,
      targetPrice: targetNum,
      lotSize: lotNum,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-sm)',
        padding: 'var(--space-md)',
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        width: '280px',
        flexShrink: 0,
        overflowY: 'auto',
        fontFamily: "'Inter', sans-serif",
      }}
      aria-label="Order entry"
    >
      <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 'var(--space-xs)' }}>
        Order Entry
      </div>

      {/* Direction toggle */}
      <div style={{ display: 'flex', gap: 2 }} role="group" aria-label="Direction">
        {(['Long', 'Short'] as Direction[]).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => handleDirectionChange(d)}
            disabled={disabled}
            aria-pressed={direction === d}
            style={{
              flex: 1,
              padding: '6px 0',
              fontSize: '13px',
              fontWeight: 600,
              border: '1px solid var(--border)',
              borderRadius: d === 'Long' ? '4px 0 0 4px' : '0 4px 4px 0',
              cursor: disabled ? 'not-allowed' : 'pointer',
              background: direction === d
                ? (d === 'Long' ? 'var(--accent-green)' : 'var(--error)')
                : 'var(--chrome)',
              color: direction === d ? '#fff' : 'var(--text-secondary)',
              transition: 'all 0.1s',
            }}
          >
            {d === 'Long' ? 'L' : 'S'}
          </button>
        ))}
      </div>

      {/* Entry */}
      <label style={labelStyle}>
        <span style={labelTextStyle}>Entry</span>
        <input
          ref={entryRef}
          type="number"
          step="0.01"
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          disabled={disabled}
          placeholder="0.00"
          style={inputStyle}
          autoFocus
        />
      </label>

      {/* Stop */}
      <label style={labelStyle}>
        <span style={{ ...labelTextStyle, color: stopInverted ? 'var(--warning)' : undefined }}>
          Stop {stopInverted ? '⚠' : ''}
        </span>
        <input
          type="number"
          step="0.01"
          value={stop}
          onChange={(e) => setStop(e.target.value)}
          disabled={disabled}
          placeholder="0.00"
          style={{ ...inputStyle, borderColor: stopInverted ? 'var(--warning)' : undefined }}
        />
      </label>

      {/* Target */}
      <label style={labelStyle}>
        <span style={{ ...labelTextStyle, color: targetInverted ? 'var(--warning)' : undefined }}>
          Target {targetInverted ? '⚠' : ''}
        </span>
        <input
          type="number"
          step="0.01"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          disabled={disabled}
          placeholder="0.00"
          style={{ ...inputStyle, borderColor: targetInverted ? 'var(--warning)' : undefined }}
        />
      </label>

      {/* Lot size */}
      <label style={labelStyle}>
        <span style={labelTextStyle}>Lot size</span>
        <input
          type="number"
          step="1"
          min="1"
          value={lot}
          onChange={(e) => setLot(e.target.value)}
          disabled={disabled}
          placeholder="100"
          style={inputStyle}
        />
      </label>

      {/* R:R stats strip (T22) */}
      {rrStats && (
        <div
          style={{
            background: 'var(--chrome)',
            borderRadius: 4,
            padding: 'var(--space-sm)',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4px 8px',
            fontSize: '11px',
          }}
        >
          <StatRow label="Risk"    value={`$${fmt(Math.abs(rrStats.risk))}`}    color="var(--error)" />
          <StatRow label="Reward"  value={`$${fmt(Math.abs(rrStats.reward))}`}  color="var(--success)" />
          <StatRow label="R:R"     value={rrStats.rrRatio != null ? `${fmt(rrStats.rrRatio, 1)}R` : '—'} />
          <StatRow label="Notional" value={`$${fmt(rrStats.notional, 0)}`} />
        </div>
      )}

      {error && (
        <div style={{ color: 'var(--error)', fontSize: '12px' }}>{error}</div>
      )}

      {/* Buttons */}
      {!disabled ? (
        <button
          type="submit"
          style={submitBtnStyle}
        >
          Enter Trade
        </button>
      ) : (
        <button
          type="button"
          onClick={onCancel}
          style={{ ...submitBtnStyle, background: 'var(--error)' }}
        >
          Cancel Trade
        </button>
      )}

      <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Space play/pause · 1 2 5 0 speed · L / S direction · Enter submit · Esc cancel
      </div>
    </form>
  );
}

function StatRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="mono" style={{ color: color ?? 'var(--text-primary)', textAlign: 'right' }}>{value}</span>
    </>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};

const labelTextStyle: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--chrome)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-primary)',
  fontFamily: "'JetBrains Mono', 'Courier New', monospace",
  fontSize: '14px',
  padding: '6px 8px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};

const submitBtnStyle: React.CSSProperties = {
  background: 'var(--accent-green)',
  border: 'none',
  borderRadius: 4,
  color: '#fff',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 600,
  padding: '8px 0',
  width: '100%',
  marginTop: 'var(--space-xs)',
};
