'use client';
import { SnapGrid } from '../lib/types';

interface Props {
  value: SnapGrid;
  onChange: (v: SnapGrid) => void;
}

const OPTIONS: { value: SnapGrid; label: string }[] = [
  { value: 'off', label: 'Free' },
  { value: '1/4', label: '1/4' },
  { value: '1/8', label: '1/8' },
  { value: '1/16', label: '1/16' },
  { value: '1/32', label: '1/32' },
];

export default function SnapToGrid({ value, onChange }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'var(--bg-card)', borderRadius: 6, padding: 2 }}>
      <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '0 6px', fontWeight: 600 }}>SNAP</span>
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '3px 8px',
            fontSize: 10,
            fontWeight: 700,
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            background: value === opt.value ? 'rgba(139,92,246,0.25)' : 'transparent',
            color: value === opt.value ? 'var(--accent-purple-light)' : 'var(--text-muted)',
            transition: 'all 0.15s',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
