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
  onSave?: () => void;
  isSaving?: boolean;
}

export default function TransportBar({
  isPlaying, isRecording, bpm, backendAlive,
  snapGrid, onSnapChange,
  onPlay, onStop, onRecord, onBpmChange,
  onSave, isSaving,
}: Props) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 12px', height: 48, gap: 4,
      overflowX: 'auto', overflowY: 'hidden',
    }}>
      {/* Logo */}
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, marginRight: 12, flexShrink: 0 }}>
        <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple)', fontSize: 20 }}>piano</span>
        <span className="hide-mobile" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>Melodica</span>
      </Link>

      {/* Help Button */}
      <button
        id="tour-help-btn"
        onClick={() => window.dispatchEvent(new CustomEvent('melodica:start-tour'))}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-secondary)', fontSize: 13, padding: '0 8px', height: 48,
          display: 'flex', alignItems: 'center', gap: 4,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
      >
        <span className="material-symbols-rounded" style={{ fontSize: 16 }}>help</span>
        Help
      </button>

      {/* Transport controls */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Play/Stop Group */}
        <div data-tour="transport-playback" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-card)', padding: '2px 8px', borderRadius: 10, border: '1px solid var(--border)' }}>
          <button onClick={onStop} title="Stop" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 20 }}>stop</span>
          </button>
          
          <div style={{ width: 1, height: 16, background: 'var(--border)' }} />

          <button onClick={onPlay} style={{
            background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            color: 'var(--accent-purple-light)', fontWeight: 700, fontSize: 13,
          }}>
            <span className="material-symbols-rounded" style={{ fontSize: 22 }}>
              {isPlaying ? 'pause' : 'play_arrow'}
            </span>
            <span className="hide-mobile">
              {isPlaying ? 'PAUSE' : 'PLAY'}
            </span>
          </button>
        </div>

        {/* BPM */}
        <div style={{
          background: 'var(--bg-card)', borderRadius: 10, padding: '5px 12px',
          display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>BPM</span>
          <input
            type="number" value={bpm}
            min="10" max="500" step="1"
            onChange={e => onBpmChange(Number(e.target.value))}
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: 'var(--text-primary)', fontSize: 13, fontWeight: 700,
              width: 38, textAlign: 'center',
            }}
          />
        </div>

        {/* Backend status indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', background: 'var(--bg-card)',
          border: '1px solid var(--border)', borderRadius: 10,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: backendAlive === null ? '#6b6890' : backendAlive ? '#10b981' : '#ef4444',
            boxShadow: backendAlive ? '0 0 8px rgba(16,185,129,0.4)' : 'none',
          }} />
          <span className="hide-mobile" style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>
            {backendAlive ? 'AI READY' : 'AI OFFLINE'}
          </span>
        </div>
      </div>

      {onSave && (
        <button
          onClick={onSave}
          disabled={isSaving}
          style={{
            marginLeft: 20,
            background: 'var(--accent-teal)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '6px 14px',
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
            opacity: isSaving ? 0.6 : 1,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 18, animation: isSaving ? 'spin 2s linear infinite' : 'none' }}>
            {isSaving ? 'sync' : 'save'}
          </span>
          {isSaving ? 'SAVING...' : 'SAVE'}
        </button>
      )}

      <Link href="/dashboard" style={{
        marginLeft: 12, color: 'var(--text-muted)', textDecoration: 'none',
        display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, flexShrink: 0,
      }}>
        <span className="material-symbols-rounded" style={{ fontSize: 16 }}>arrow_back</span>
        <span className="hide-mobile">Dashboard</span>
      </Link>
    </div>
  );
}
