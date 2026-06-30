import type { Trade } from '@/lib/types';
import { calculatePlannedRR } from '@/lib/replay-engine';

interface SessionCompleteOverlayProps {
  closedTrades: Trade[];
  sessionDurationMs: number;
  onNewSession: () => void;
  onNextSession: () => void;
  hasNextSession: boolean;
}

function fmtMs(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function fmtPnl(n: number) {
  return (n >= 0 ? '+' : '') + '$' + Math.abs(n).toFixed(2);
}

export function SessionCompleteOverlay({
  closedTrades,
  sessionDurationMs,
  onNewSession,
  onNextSession,
  hasNextSession,
}: SessionCompleteOverlayProps) {
  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const wins = closedTrades.filter((t) => t.outcome === 'target').length;
  const losses = closedTrades.filter((t) => t.outcome === 'stopped').length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(13,17,23,0.88)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '32px 40px',
          width: '560px',
          maxWidth: '90vw',
          maxHeight: '80vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-lg)',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
            Session Complete
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {fmtMs(sessionDurationMs)} · {closedTrades.length} trade{closedTrades.length !== 1 ? 's' : ''} · {wins}W / {losses}L
          </div>
        </div>

        {/* Summary row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <SummaryCard label="Net P&L" value={fmtPnl(totalPnl)} color={totalPnl >= 0 ? 'var(--success)' : 'var(--error)'} />
          <SummaryCard label="Win rate" value={closedTrades.length > 0 ? `${Math.round((wins / closedTrades.length) * 100)}%` : '—'} />
          <SummaryCard label="Avg R" value={closedTrades.length > 0 ? avgR(closedTrades) : '—'} />
        </div>

        {/* Per-trade table */}
        {closedTrades.length > 0 && (
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              Trade log
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Dir</th>
                  <th style={thStyle}>Entry</th>
                  <th style={thStyle}>Fill</th>
                  <th style={thStyle}>P&L</th>
                  <th style={thStyle}>Planned R</th>
                  <th style={thStyle}>Result</th>
                </tr>
              </thead>
              <tbody>
                {closedTrades.map((t, i) => {
                  const plannedRR = calculatePlannedRR(t);
                  const pnl = t.pnl ?? 0;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={tdStyle}>{i + 1}</td>
                      <td style={{ ...tdStyle, color: t.direction === 'Long' ? 'var(--success)' : 'var(--error)' }}>{t.direction}</td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{t.entryPrice.toFixed(2)}</td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{t.fillPrice?.toFixed(2) ?? '—'}</td>
                      <td style={{ ...tdStyle, color: pnl >= 0 ? 'var(--success)' : 'var(--error)', fontFamily: 'monospace' }}>{fmtPnl(pnl)}</td>
                      <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{plannedRR != null ? `${plannedRR.toFixed(1)}R` : '—'}</td>
                      <td style={{ ...tdStyle, color: t.outcome === 'target' ? 'var(--success)' : 'var(--error)' }}>
                        {t.outcome === 'target' ? 'Win' : 'Loss'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onNewSession} style={secondaryBtnStyle}>
            New Session
          </button>
          {hasNextSession && (
            <button onClick={onNextSession} style={primaryBtnStyle}>
              Next Session
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function avgR(trades: Trade[]): string {
  const rs = trades.map((t) => {
    if (!t.pnl || !t.entryPrice || !t.stopPrice) return null;
    const riskPerUnit = Math.abs(t.entryPrice - t.stopPrice);
    const riskTotal = riskPerUnit * t.lotSize;
    return riskTotal > 0 ? t.pnl / riskTotal : null;
  }).filter((r): r is number => r !== null);

  if (rs.length === 0) return '—';
  return (rs.reduce((s, r) => s + r, 0) / rs.length).toFixed(1) + 'R';
}

function SummaryCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'var(--chrome)', borderRadius: 6, padding: '12px 16px' }}>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: '20px', fontWeight: 700, color: color ?? 'var(--text-primary)', fontFamily: 'monospace' }}>{value}</div>
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '4px 8px', fontWeight: 500 };
const tdStyle: React.CSSProperties = { padding: '6px 8px', color: 'var(--text-primary)' };

const primaryBtnStyle: React.CSSProperties = {
  flex: 1,
  background: 'var(--accent-green)',
  border: 'none',
  borderRadius: 4,
  color: '#fff',
  cursor: 'pointer',
  fontSize: '14px',
  fontWeight: 600,
  padding: '10px 0',
};

const secondaryBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  background: 'transparent',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
};
