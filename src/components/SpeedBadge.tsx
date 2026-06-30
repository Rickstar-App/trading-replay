import type { SpeedMultiplier } from '@/lib/types';

interface SpeedBadgeProps {
  speed: SpeedMultiplier;
  isPlaying: boolean;
  onChange: (speed: SpeedMultiplier) => void;
}

const SPEEDS: SpeedMultiplier[] = [1, 2, 5, 10];

export function SpeedBadge({ speed, isPlaying, onChange }: SpeedBadgeProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 2,
        alignItems: 'center',
      }}
      role="group"
      aria-label="Playback speed"
    >
      {SPEEDS.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          aria-pressed={speed === s}
          style={{
            background: speed === s ? 'var(--accent-blue)' : 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 3,
            color: speed === s ? '#fff' : 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: 600,
            padding: '3px 7px',
            fontFamily: "'JetBrains Mono', monospace",
            transition: 'all 0.1s',
          }}
        >
          {s === 10 ? '10x' : `${s}x`}
        </button>
      ))}
    </div>
  );
}
