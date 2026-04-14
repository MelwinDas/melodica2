'use client';
import Link from 'next/link';
import SnapToGrid from './SnapToGrid';
import { SnapGrid } from '../lib/types';

interface Props {
  isPlaying: boolean;
  isRecording: boolean;
  bpm: number;
  backendAlive: boolean | null;
  snapGrid: SnapGrid;
  onSnapChange: (v: SnapGrid) => void;
  onPlay: () => void;
  onStop: () => void;
  onRecord: () => void;
  onBpmChange: (v: number) => void;
}

export default function TransportBar({
  isPlaying, isRecording, bpm, backendAlive,
  snapGrid, onSnapChange,
  onPlay, onStop, onRecord, onBpmChange,
}: Props) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 20px', height: 48, gap: 4,
    }}>
      {/* Logo */}
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, marginRight: 20 }}>
        <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple)', fontSize: 20 }}>piano</span>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>Melodica</span>
      </Link>

      {/* Menu items */}
      {['File', 'Edit', 'View', 'Track', 'Help'].map(item => (
        <button key={item} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary)', fontSize: 13, padding: '0 8px', height: 48,
        }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
        >{item}</button>
      ))}

      {/* Snap to grid */}
      <div style={{ marginLeft: 12 }}>
        <SnapToGrid value={snapGrid} onChange={onSnapChange} />
      </div>

      {/* Transport controls */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Record */}
        <button onClick={onRecord} title="Record" style={{
          background: isRecording ? 'rgba(239,68,68,0.2)' : 'var(--bg-card)',
          border: `1px solid ${isRecording ? '#ef4444' : 'var(--border)'}`,
          borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 5,
          color: isRecording ? '#ef4444' : 'var(--text-secondary)',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: isRecording ? '#ef4444' : 'var(--text-muted)',
            animation: isRecording ? 'pulse 1s infinite' : 'none',
          }} />
          <span style={{ fontSize: 12, fontWeight: 600 }}>REC</span>
        </button>

        {/* Stop */}
        <button onClick={onStop} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
          <span className="material-symbols-rounded" style={{ fontSize: 22 }}>stop</span>
        </button>

        {/* Play/Pause */}
        <button onClick={onPlay} style={{
          background: 'var(--accent-purple)', border: 'none', borderRadius: 8,
          padding: '5px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
          color: 'white', fontWeight: 700, fontSize: 13,
        }}>
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
            {isPlaying ? 'pause' : 'play_arrow'}
          </span>
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        {/* BPM */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: 8, padding: '4px 12px',
          display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>BPM</span>
          <input
            type="number" value={bpm}
            onChange={e => onBpmChange(Number(e.target.value))}
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: 13, fontWeight: 700,
              width: 36, textAlign: 'center',
            }}
          />
        </div>

        {/* Backend status */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', background: 'var(--bg-card)',
          border: '1px solid var(--border)', borderRadius: 8,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: backendAlive === null ? '#6b6890' : backendAlive ? '#10b981' : '#ef4444',
          }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {backendAlive ? 'AI Ready' : 'AI Offline'}
          </span>
        </div>
      </div>

      <Link href="/dashboard" style={{
        marginLeft: 12, color: 'var(--text-muted)', textDecoration: 'none',
        display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
      }}>
        <span className="material-symbols-rounded" style={{ fontSize: 16 }}>arrow_back</span>
        Dashboard
      </Link>
    </div>
  );
}
