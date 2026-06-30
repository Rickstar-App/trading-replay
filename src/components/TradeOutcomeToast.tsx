import { useEffect, useState } from 'react';
import type { Trade } from '@/lib/types';

interface TradeOutcomeToastProps {
  trade: Trade | null;
  onDismiss: () => void;
}

export function TradeOutcomeToast({ trade, onDismiss }: TradeOutcomeToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!trade) {
      setVisible(false);
      return;
    }
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300); // let fade-out finish
    }, 3000);
    return () => clearTimeout(timer);
  }, [trade, onDismiss]);

  if (!trade) return null;

  const win = trade.outcome === 'target';
  const pnl = trade.pnl ?? 0;
  const pnlStr = (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toFixed(2);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 50,
        background: win ? 'var(--success)' : 'var(--error)',
        borderRadius: 6,
        padding: '10px 16px',
        color: '#fff',
        fontFamily: "'Inter', sans-serif",
        fontSize: '13px',
        fontWeight: 600,
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-8px)',
        transition: 'opacity 0.25s, transform 0.25s',
        pointerEvents: 'none',
        minWidth: 140,
      }}
    >
      <div>{win ? 'Target Hit' : 'Stopped Out'}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '15px', marginTop: 2 }}>
        {pnlStr}
      </div>
    </div>
  );
}
