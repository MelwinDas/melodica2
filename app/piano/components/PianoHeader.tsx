'use client';
import Link from 'next/link';

interface Props {
  isPlaying: boolean;
  isRecording: boolean;
  recordingPaused: boolean;
  position: { bars: number; beats: number; ticks: number };
  bpm: number;
  metronomeEnabled: boolean;
  metronomeFlash: boolean;
  backendAlive: boolean | null;
  trackCount: number;
  onRecord: () => void;
  onPauseRecord: () => void;
  onResumeRecord: () => void;
  onStopRecord: () => void;
  onPlayAll: () => void;
  onStop: () => void;
  onBpmChange: (v: number) => void;
  timeSignature: string;
  onTimeSignatureChange: (ts: string) => void;
  onMetronomeToggle: () => void;
  onOpenStudio: () => void;
  onToggleSidebar?: () => void;
}

export default function PianoHeader({
  isPlaying, isRecording, recordingPaused, position, bpm, timeSignature,
  metronomeEnabled, metronomeFlash, backendAlive, trackCount,
  onRecord, onPauseRecord, onResumeRecord, onStopRecord,
  onPlayAll, onStop, onBpmChange, onTimeSignatureChange, onMetronomeToggle, onOpenStudio, onToggleSidebar
}: Props) {
  const pad = (n: number, d = 2) => String(n).padStart(d, '0');

  return (
    <header style={{
      height: 'var(--header-h)',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 12px', gap: 6, zIndex: 100, flexShrink: 0,
      overflowX: 'auto', overflowY: 'hidden',
    }}>
      {/* Logo / Menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 8, flexShrink: 0 }}>
        {onToggleSidebar && (
          <button className="show-mobile hamburger-btn" onClick={onToggleSidebar} style={{ padding: 4, marginRight: 4 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 24 }}>menu</span>
          </button>
        )}
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple)', fontSize: 20 }}>piano</span>
          <span className="hide-mobile" style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>Melodica</span>
        </Link>
      </div>

      <div style={{ flex: 1 }} />

      {/* ── TRANSPORT CENTER ─────────────────────────────────────────── */}
      <div data-tour="recording-controls" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>

        {/* ── GENERAL PLAYBACK CONTROLS ──────────────────────────────── */}
        {!isRecording && !recordingPaused && (
          <>
            {/* Stop */}
            <button onClick={onStop} className="transport-btn" title="Stop">
              <span className="material-symbols-rounded" style={{ fontSize: 20 }}>stop</span>
            </button>

            {/* Play All Tracks */}
            <button
              onClick={onPlayAll}
              disabled={trackCount === 0 && !isPlaying}
              className="transport-btn play-btn"
              title="Play All Tracks"
            >
              <span className="material-symbols-rounded" style={{ fontSize: 22 }}>
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          </>
        )}

        {/* ── RECORDING STATE CONTROLS (STABLE WRAPPER) ──────────────── */}
        <div data-tour="piano-record-btn" style={{ display: 'flex', gap: 5 }}>
          {isRecording ? (
            <>
              {/* Pause Record */}
              <button
                onClick={onPauseRecord}
                className="transport-btn"
                title="Pause Recording"
                style={{ gap: 5 }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>pause</span>
                <span style={{ fontSize: 11, fontWeight: 700 }}>Pause Rec</span>
              </button>
              {/* Stop Record */}
              <button
                onClick={onStopRecord}
                className="transport-btn record active"
                title="Stop Recording"
                style={{ gap: 5 }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>stop</span>
                <span style={{ fontSize: 11, fontWeight: 700 }}>Stop Rec</span>
              </button>
            </>
          ) : recordingPaused ? (
            <>
              {/* Resume Record */}
              <button
                onClick={onResumeRecord}
                className="transport-btn active"
                title="Resume Recording"
                style={{ gap: 5, borderColor: 'var(--accent-pink)' }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--accent-pink)' }}>fiber_manual_record</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-pink)' }}>Resume Rec</span>
              </button>
              {/* Discard / Stop */}
              <button
                onClick={onStopRecord}
                className="transport-btn"
                title="Finalize Recording"
                style={{ gap: 5 }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>stop</span>
                <span style={{ fontSize: 11, fontWeight: 700 }}>Done</span>
              </button>
            </>
          ) : (
            <button
              onClick={onRecord}
              className="transport-btn record"
              title={trackCount > 0 ? 'Record New Track (overdub)' : 'Record'}
              style={{ gap: 5 }}
            >
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: '#ef4444', flexShrink: 0,
              }} />
              <span style={{ fontSize: 11, fontWeight: 700 }}>
                {trackCount > 0 ? `REC +${trackCount}` : 'REC'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ── LCD TIME ─────────────────────────────────────────────────── */}
      <div className="lcd-display" style={{ margin: '0 8px' }}>
        {pad(position.bars)}:{pad(position.beats)}:{pad(position.ticks, 3)}
      </div>

      {/* ── BPM ──────────────────────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: 8, padding: '4px 10px',
        display: 'flex', alignItems: 'center', gap: 5, border: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>BPM</span>
        <input
          type="number" value={bpm} min={10} max={500}
          onChange={e => onBpmChange(Math.max(10, Math.min(500, Math.round(Number(e.target.value)))))}
          disabled={isRecording}
          style={{
            background: 'none', border: 'none', outline: 'none',
            color: isRecording ? 'var(--text-muted)' : 'var(--text-primary)',
            fontSize: 14, fontWeight: 800, width: 40, textAlign: 'center',
            fontFamily: "'Space Grotesk', monospace",
          }}
        />
      </div>

      {/* ── TIME SIGNATURE ───────────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg-card)', borderRadius: 8, padding: '4px 10px',
        display: 'flex', alignItems: 'center', gap: 5, border: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>SIG</span>
        <select
          value={timeSignature}
          onChange={e => onTimeSignatureChange(e.target.value)}
          disabled={isRecording}
          style={{
            background: 'none', border: 'none', outline: 'none', cursor: 'pointer',
            color: isRecording ? 'var(--text-muted)' : 'var(--text-primary)',
            fontSize: 14, fontWeight: 800, fontFamily: "'Space Grotesk', monospace",
            appearance: 'none', paddingRight: 4,
          }}
        >
          <option value="4/4">4/4</option>
          <option value="3/4">3/4</option>
          <option value="2/4">2/4</option>
        </select>
      </div>

      {/* ── METRONOME ────────────────────────────────────────────────── */}
      <button
        data-tour="piano-metronome-btn"
        onClick={onMetronomeToggle}
        className={`transport-btn ${metronomeEnabled ? 'active' : ''}`}
        title="Metronome"
        style={{ gap: 5 }}
      >
        <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
          {metronomeEnabled ? 'volume_up' : 'volume_off'}
        </span>
        <div
          className={`metro-led ${metronomeFlash ? 'flash' : ''}`}
          style={{ opacity: metronomeEnabled ? (metronomeFlash ? 1 : 0.3) : 0.1 }}
        />
      </button>

      <div style={{ flex: 1 }} />

      {/* ── RIGHT: STATUS + STUDIO ───────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Track count badge */}
        {trackCount > 0 && (
          <div style={{
            background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.25)',
            borderRadius: 6, padding: '3px 8px',
            fontSize: 11, color: 'var(--accent-teal-light)', fontWeight: 700,
          }}>
            {trackCount} track{trackCount !== 1 ? 's' : ''}
          </div>
        )}

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
          <span className="hide-mobile" style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {backendAlive ? 'Backend Connected' : 'Backend Offline'}
          </span>
        </div>

        {/* Help / Tour */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('melodica:start-piano-tour'))}
          className="transport-btn"
          title="Start Recording Tour"
          style={{ padding: '6px 10px', gap: 5, background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>help</span>
          Help
        </button>

        {/* Open in Studio */}
        <button
          onClick={onOpenStudio}
          className="transport-btn"
          style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', border: 'none', color: 'white', padding: '6px 14px', fontWeight: 700, fontSize: 12, gap: 5, flexShrink: 0 }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>open_in_new</span>
          <span className="hide-mobile">Open in Studio</span>
        </button>
      </div>
    </header>
  );
}
