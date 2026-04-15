'use client';
import type { QuantizeGrid, CountInMode } from '../hooks/usePianoEngine';

interface Props {
  quantize: QuantizeGrid;
  countIn: CountInMode;
  countInActive: boolean;
  countInBeat: number;
  lastVelocity: number;
  trackCount: number;
  allNoteCount: number;
  onQuantizeChange: (v: QuantizeGrid) => void;
  onCountInChange: (v: CountInMode) => void;
  onTrimSilence: () => void;
  onClearAll: () => void;
}

export default function QuickEditSidebar({
  quantize, countIn, countInActive, countInBeat,
  lastVelocity, trackCount, allNoteCount,
  onQuantizeChange, onCountInChange,
  onTrimSilence, onClearAll,
}: Props) {
  const velPct = Math.round((lastVelocity / 127) * 100);

  // Visual metronome dots: total beats in count-in
  const totalBeats  = countIn === 'off' ? 0 : countIn === '1bar' ? 4 : 8;
  // Which beat within the current bar (0-indexed)
  const beatInBar   = (countInBeat - 1) % 4;
  // Which bar we're on
  const currentBar  = Math.ceil(countInBeat / 4);
  const numBars     = countIn === '2bar' ? 2 : 1;

  return (
    <aside data-tour="quick-edit-sidebar" className="sidebar-glass">

      {/* ── Visual Metronome (count-in only) ──────────────────────── */}
      {countInActive && (
        <div style={{
          background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 10, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <span style={{
            fontSize: 8, fontWeight: 800, color: 'var(--accent-gold)',
            textTransform: 'uppercase', letterSpacing: '0.12em', textAlign: 'center',
          }}>Count In</span>
          {/* Beat dots per bar */}
          {Array.from({ length: numBars }).map((_, barIdx) => (
            <div key={barIdx} style={{ display: 'flex', justifyContent: 'center', gap: 5 }}>
              {[0,1,2,3].map(b => {
                const globalBeat = barIdx * 4 + b + 1;
                const isActive   = globalBeat === countInBeat;
                const isPast     = globalBeat < countInBeat;
                return (
                  <div
                    key={b}
                    style={{
                      width: 16, height: 16, borderRadius: '50%',
                      background: isActive
                        ? 'var(--accent-gold)'
                        : isPast
                          ? 'rgba(245,158,11,0.3)'
                          : 'var(--bg-hover)',
                      border: `2px solid ${isActive ? 'var(--accent-gold)' : isPast ? 'rgba(245,158,11,0.2)' : 'var(--border)'}`,
                      boxShadow: isActive ? '0 0 10px rgba(245,158,11,0.6)' : 'none',
                      transition: 'all 0.08s ease',
                      transform: isActive ? 'scale(1.2)' : 'scale(1)',
                    }}
                  />
                );
              })}
            </div>
          ))}
          {/* Beat fraction label */}
          <div style={{ textAlign: 'center', fontFamily: "'Space Grotesk', monospace", fontSize: 18, fontWeight: 900, color: 'var(--accent-gold)' }}>
            {currentBar}/{numBars}
          </div>
        </div>
      )}

      {/* ── Quantize ─────────────────────────────────────────────── */}
      <div data-tour="piano-quantize">
        <label style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 5 }}>
          Quantize
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {(['off','1/8','1/16','1/32'] as QuantizeGrid[]).map(q => (
            <button
              key={q}
              onClick={() => onQuantizeChange(q)}
              style={{
                background: quantize === q ? 'rgba(139,92,246,0.2)' : 'var(--bg-card)',
                border: `1px solid ${quantize === q ? 'var(--accent-purple)' : 'var(--border)'}`,
                borderRadius: 7, padding: '5px 8px', cursor: 'pointer',
                color: quantize === q ? 'var(--accent-purple-light)' : 'var(--text-secondary)',
                fontSize: 11, fontWeight: 700, textAlign: 'left',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'all 0.12s',
              }}
            >
              {q === 'off' ? 'Off' : q}
              {quantize === q && <span className="material-symbols-rounded" style={{ fontSize: 13 }}>check</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Count-In ─────────────────────────────────────────────── */}
      <div data-tour="piano-count-in">
        <label style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 5 }}>
          Count-In
        </label>
        <select
          value={countIn}
          onChange={e => onCountInChange(e.target.value as CountInMode)}
          style={{
            width: '100%', background: 'var(--bg-card)',
            border: '1px solid var(--border)', borderRadius: 8,
            padding: '7px 10px', color: 'var(--text-primary)',
            fontSize: 12, cursor: 'pointer', outline: 'none',
          }}
        >
          <option value="off">Off</option>
          <option value="1bar">1 Bar</option>
          <option value="2bar">2 Bar</option>
        </select>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '2px 0' }} />

      {/* ── Velocity Meter ───────────────────────────────────────── */}
      <div data-tour="piano-velocity">
        <label style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.12em', display: 'block', marginBottom: 5 }}>
          Velocity
        </label>
        <div className="velocity-meter">
          <div className="velocity-meter-fill" style={{ height: `${velPct}%` }} />
          <div style={{
            position: 'absolute', bottom: 6, left: 0, right: 0, textAlign: 'center',
            fontSize: 20, fontWeight: 900, fontFamily: "'Space Grotesk', monospace",
            color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.6)', zIndex: 2,
          }}>
            {lastVelocity}
          </div>
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '2px 0' }} />

      {/* ── Stats ────────────────────────────────────────────────── */}
      {allNoteCount > 0 && (
        <div style={{
          background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.25)',
          borderRadius: 8, padding: '8px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "'Space Grotesk', monospace", color: 'var(--accent-teal-light)' }}>
            {allNoteCount}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
            {trackCount > 1 ? `${trackCount} tracks` : 'notes'}
          </div>
        </div>
      )}

      {/* ── Trim + Clear ─────────────────────────────────────────── */}
      {allNoteCount > 0 && (
        <>
          <button
            onClick={onTrimSilence}
            style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '7px 10px', cursor: 'pointer',
              color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              width: '100%', transition: 'all 0.15s',
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>content_cut</span>
            Trim Silence
          </button>
          <button
            onClick={onClearAll}
            style={{
              background: 'transparent', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 8, padding: '7px 10px', cursor: 'pointer',
              color: '#f87171', fontSize: 11, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              width: '100%', transition: 'all 0.15s',
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>delete</span>
            Clear All
          </button>
        </>
      )}
    </aside>
  );
}
