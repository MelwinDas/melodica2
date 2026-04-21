'use client';
import { useState, useCallback } from 'react';

const WHITE_NOTES = ['C','D','E','F','G','A','B'];
const BLACK_MAP: Record<number, string> = { 0:'C#', 1:'D#', 3:'F#', 4:'G#', 5:'A#' };
const OCTAVES = [2, 3, 4, 5, 6];
const WHITE_KEY_H = 140;
const BLACK_KEY_H = 86;

interface Props {
  pressedKeys: Set<string>;
  onNoteOn: (midi: number, velocity: number) => void;
  onNoteOff: (midi: number) => void;
}

const STEP: Record<string, number> = {
  C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11
};
const noteToMidi = (note: string, oct: number) => (oct + 1) * 12 + (STEP[note] ?? 0);

/** Map Y position within a key (0=top, keyHeight=bottom) to velocity.
 *  Top of key = hard strike (122), bottom = soft (38). */
function yToVelocity(y: number, keyH: number): number {
  const ratio = Math.max(0, Math.min(1, y / keyH));
  // Near bottom (ratio=1) = soft; near top (ratio=0) = hard — classic piano mechanic
  return Math.round(122 - ratio * 84);
}

export default function VirtualPiano({ pressedKeys, onNoteOn, onNoteOff }: Props) {
  const [showLabels, setShowLabels] = useState(true);

  const handleWhiteDown = useCallback((e: React.MouseEvent, midi: number) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    onNoteOn(midi, yToVelocity(y, WHITE_KEY_H));
  }, [onNoteOn]);

  const handleBlackDown = useCallback((e: React.MouseEvent, midi: number) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    onNoteOn(midi, yToVelocity(y, BLACK_KEY_H));
  }, [onNoteOn]);

  const handleTouchDown = useCallback((e: React.TouchEvent, midi: number, keyH: number) => {
    e.preventDefault();
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const y = e.touches[0].clientY - rect.top;
    onNoteOn(midi, yToVelocity(y, keyH));
  }, [onNoteOn]);

  return (
    <div style={{
      background: 'var(--bg-secondary)', borderRadius: 14,
      border: '1px solid var(--border-light)', padding: '12px 16px 10px',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      width: '100%', maxWidth: '100%'
    }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, width: '100%', justifyContent: 'center' }}>
        <button
          onClick={() => setShowLabels(v => !v)}
          style={{
            background: showLabels ? 'rgba(139,92,246,0.15)' : 'var(--bg-card)',
            border: `1px solid ${showLabels ? 'var(--accent-purple)' : 'var(--border)'}`,
            borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
            color: showLabels ? 'var(--accent-purple-light)' : 'var(--text-muted)',
            fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
            transition: 'all 0.15s',
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>label</span>
          {showLabels ? 'Labels On' : 'Labels Off'}
        </button>
        <span className="hide-mobile" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          Click top → loud · Click bottom → soft · QWERTY: A–L
        </span>
      </div>

      {/* Keyboard */}
      <div style={{ 
        display: 'flex', gap: 0, position: 'relative', userSelect: 'none', 
        width: '100%', overflowX: 'auto', paddingBottom: 8,
        touchAction: 'pan-x', /* allow horizontal scroll but block vertical */
        WebkitOverflowScrolling: 'touch',
      }}>
        <div style={{ display: 'flex', minWidth: 'max-content', margin: '0 auto' }}>
        {OCTAVES.map(oct =>
          WHITE_NOTES.map((note, i) => {
            const midi   = noteToMidi(note, oct);
            const midiStr = String(midi);
            const isPressed = pressedKeys.has(midiStr);

            return (
              <div key={`${note}${oct}`} style={{ position: 'relative', marginRight: 2 }}>
                {/* White key */}
                <div
                  onMouseDown={e => handleWhiteDown(e, midi)}
                  onMouseUp={() => onNoteOff(midi)}
                  onMouseLeave={() => { if (pressedKeys.has(midiStr)) onNoteOff(midi); }}
                  onTouchStart={e => handleTouchDown(e, midi, WHITE_KEY_H)}
                  onTouchEnd={e => { e.preventDefault(); onNoteOff(midi); }}
                  className={isPressed ? 'piano-key-glow' : ''}
                  style={{
                    width: 42, height: WHITE_KEY_H, borderRadius: '0 0 7px 7px',
                    background: isPressed
                      ? 'linear-gradient(180deg, #8b5cf6 0%, #ec4899 100%)'
                      : 'linear-gradient(180deg, #f0eeff 0%, #d8d4f0 100%)',
                    border: `1px solid ${isPressed ? '#8b5cf6' : '#b0aad0'}`,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                    paddingBottom: 7, fontSize: 9, fontWeight: 700,
                    color: isPressed ? 'white' : '#8880b0',
                    transition: 'background 0.06s, transform 0.06s',
                    transform: isPressed ? 'scaleY(0.97)' : 'scaleY(1)',
                    transformOrigin: 'top',
                    touchAction: 'none',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {showLabels && `${note}${oct}`}
                </div>

                {/* Black key */}
                {BLACK_MAP[i] !== undefined && (() => {
                  const bNote    = BLACK_MAP[i];
                  const bMidi    = noteToMidi(bNote, oct);
                  const bPressed = pressedKeys.has(String(bMidi));
                  return (
                    <div
                      onMouseDown={e => handleBlackDown(e, bMidi)}
                      onMouseUp={e => { e.stopPropagation(); onNoteOff(bMidi); }}
                      onMouseLeave={() => { if (pressedKeys.has(String(bMidi))) onNoteOff(bMidi); }}
                      onTouchStart={e => { e.stopPropagation(); handleTouchDown(e, bMidi, BLACK_KEY_H); }}
                      onTouchEnd={e => { e.preventDefault(); e.stopPropagation(); onNoteOff(bMidi); }}
                      className={bPressed ? 'piano-key-glow' : ''}
                      style={{
                        position: 'absolute', top: 0, left: 27, zIndex: 2,
                        width: 26, height: BLACK_KEY_H, borderRadius: '0 0 5px 5px',
                        background: bPressed
                          ? 'linear-gradient(180deg, #8b5cf6 0%, #ec4899 100%)'
                          : 'linear-gradient(180deg, #22203a 0%, #0d0c1a 100%)',
                        border: '1px solid #3a3860',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                        paddingBottom: 5,
                        transition: 'background 0.06s',
                        touchAction: 'none',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      {showLabels && (
                        <span style={{ fontSize: 7, color: bPressed ? 'white' : '#666', fontWeight: 700 }}>
                          {bNote}{oct}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          })
        )}
        </div>
      </div>
    </div>
  );
}
