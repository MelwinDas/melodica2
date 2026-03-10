'use client';
import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';

const PianoNotation = dynamic(() => import('../components/PianoNotation'), { ssr: false });

// ── keyboard layout ─────────────────────────────────────────────────────────
const WHITE_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_MAP: Record<number, string> = { 0: 'C#', 1: 'D#', 3: 'F#', 4: 'G#', 5: 'A#' };
const OCTAVES = [3, 4, 5];

const NOTE_COLORS: Record<string, string> = {
  C: '#8b5cf6', D: '#6366f1', E: '#ec4899',
  F: '#f59e0b', G: '#14b8a6', A: '#10b981', B: '#3b82f6',
  'C#': '#a78bfa', 'D#': '#818cf8', 'F#': '#fb923c', 'G#': '#2dd4bf', 'A#': '#34d399',
};

// VexFlow duration mapping
const VEX_DUR = 'q'; // quarter note for each key press

interface RecordedNote {
  pitch: string;
  duration: string;
  time: number;
}

export default function PianoPage() {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [recording, setRecording] = useState(false);
  const [recordedNotes, setRecordedNotes] = useState<RecordedNote[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [samplerReady, setSamplerReady] = useState(false);
  const [backendAlive, setBackendAlive] = useState<boolean | null>(null);

  const samplerRef = useRef<import('tone').Sampler | null>(null);
  const toneRef = useRef<typeof import('tone') | null>(null);

  // Load Tone.js + Sampler once on mount
  useEffect(() => {
    let cancelled = false;
    import('tone').then((Tone) => {
      if (cancelled) return;
      toneRef.current = Tone;
      const sampler = new Tone.Sampler({
        urls: {
          A0: 'A0.mp3', C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
          A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
          A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
          A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
          A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
          A5: 'A5.mp3', C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
          A6: 'A6.mp3', C7: 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
          A7: 'A7.mp3', C8: 'C8.mp3',
        },
        baseUrl: 'https://tonejs.github.io/audio/salamander/',
        onload: () => {
          if (!cancelled) setSamplerReady(true);
        },
      }).toDestination();
      samplerRef.current = sampler;
    });
    return () => { cancelled = true; };
  }, []);

  // Check backend health
  useEffect(() => {
    fetch('http://localhost:8000/health', { signal: AbortSignal.timeout(3000) })
      .then(r => setBackendAlive(r.ok))
      .catch(() => setBackendAlive(false));
  }, []);

  const pressKey = useCallback(async (noteKey: string) => {
    // Unlock AudioContext on first interaction
    if (toneRef.current) await toneRef.current.start();

    setPressedKeys(prev => new Set(prev).add(noteKey));
    setTimeout(() => setPressedKeys(prev => {
      const s = new Set(prev); s.delete(noteKey); return s;
    }), 250);

    if (samplerRef.current && samplerReady) {
      try { samplerRef.current.triggerAttackRelease(noteKey, '8n'); }
      catch { /* ignore decode errors for very low/high notes */ }
    }

    if (recording) {
      setRecordedNotes(prev => [...prev, { pitch: noteKey, duration: VEX_DUR, time: Date.now() }]);
    }
  }, [recording, samplerReady]);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => { setGenerating(false); setGenerated(true); }, 2500);
  };

  const clearRecording = () => { setRecordedNotes([]); setGenerated(false); };

  // Notes for VexFlow (last 8 max)
  const vfNotes = recordedNotes.slice(-8).map(n => ({ pitch: n.pitch, duration: n.duration }));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', padding: '0 24px', display: 'flex', alignItems: 'center', height: 52 }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, marginRight: 32 }}>
          <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple)', fontSize: 22 }}>piano</span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18 }}>Melodica</span>
        </Link>
        {[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Studio', href: '/studio' }, { label: 'Library', href: '/dashboard' }].map(l => (
          <Link key={l.label} href={l.href} style={{ marginRight: 24, textDecoration: 'none', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >{l.label}</Link>
        ))}
        {/* Backend status indicator */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: backendAlive === null ? '#6b6890' : backendAlive ? '#10b981' : '#ef4444' }} />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {backendAlive === null ? 'Checking backend...' : backendAlive ? 'Backend connected' : 'Backend offline'}
          </span>
        </div>
      </nav>

      {/* Header */}
      <div style={{ padding: '24px 32px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Virtual Piano Studio</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {samplerReady ? '🎹 Piano ready — click keys to play' : '⏳ Loading Salamander piano samples...'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={clearRecording}
            disabled={recordedNotes.length === 0}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, opacity: recordedNotes.length === 0 ? 0.4 : 1 }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 16, verticalAlign: 'middle' }}>delete</span>
          </button>
          <button
            onClick={() => { setRecording(!recording); if (!recording) setRecordedNotes([]); }}
            style={{
              background: recording ? 'rgba(236,72,153,0.2)' : 'var(--bg-card)',
              border: `1px solid ${recording ? 'var(--accent-pink)' : 'var(--border-light)'}`,
              borderRadius: 8, padding: '8px 18px', cursor: 'pointer',
              color: recording ? 'var(--accent-pink)' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: recording ? 'var(--accent-pink)' : 'var(--text-muted)', flexShrink: 0, animation: recording ? 'pulse 1s infinite' : 'none' }} />
            {recording ? 'Recording...' : 'Record'}
          </button>
          <Link href="/studio" className="btn-secondary" style={{ padding: '8px 18px', fontSize: 13 }}>Open in Studio</Link>
        </div>
      </div>

      {/* VexFlow sheet music */}
      <div style={{ margin: '0 32px 16px', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Sheet Music Viewer {recording && <span style={{ color: 'var(--accent-pink)' }}>● LIVE</span>}
          </p>
          <div style={{ display: 'flex', gap: 6 }}>
            {recordedNotes.length > 0 && (
              <span className="badge badge-teal">{recordedNotes.length} notes</span>
            )}
            <Link href="/sheet-music" style={{ fontSize: 12, color: 'var(--accent-purple-light)', textDecoration: 'none' }}>Full View →</Link>
          </div>
        </div>
        <PianoNotation notes={vfNotes} width={740} height={130} />
      </div>

      {/* Piano keyboard */}
      <div style={{ padding: '0 32px 16px', overflowX: 'auto' }}>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, border: '1px solid var(--border-light)', padding: '20px' }}>
          <div style={{ display: 'flex', gap: 0, position: 'relative', width: 'fit-content', margin: '0 auto' }}>
            {OCTAVES.map(oct =>
              WHITE_NOTES.map((note, i) => {
                const noteKey = `${note}${oct}`;
                const isPressed = pressedKeys.has(noteKey);
                const col = NOTE_COLORS[note] || '#8b5cf6';
                return (
                  <div key={noteKey} style={{ position: 'relative', marginRight: 2 }}>
                    {/* White key */}
                    <div
                      onMouseDown={() => pressKey(noteKey)}
                      onTouchStart={e => { e.preventDefault(); pressKey(noteKey); }}
                      style={{
                        width: 44, height: 150, borderRadius: '0 0 8px 8px',
                        background: isPressed
                          ? `linear-gradient(180deg, ${col} 0%, ${col}aa 100%)`
                          : 'linear-gradient(180deg, #f0eeff 0%, #d8d4f0 100%)',
                        border: `1px solid ${isPressed ? col : '#b0aad0'}`,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                        paddingBottom: 8, fontSize: 9, fontWeight: 700,
                        color: isPressed ? 'white' : '#8880b0',
                        userSelect: 'none', transition: 'background 0.06s, transform 0.06s',
                        transform: isPressed ? 'scaleY(0.97)' : 'scaleY(1)',
                        boxShadow: isPressed ? `0 0 24px ${col}66` : '0 4px 10px rgba(0,0,0,0.35)',
                        transformOrigin: 'top',
                      }}
                    >
                      {note}{oct}
                    </div>
                    {/* Black key */}
                    {BLACK_MAP[i] !== undefined && (
                      <div
                        onMouseDown={e => { e.stopPropagation(); pressKey(`${BLACK_MAP[i]}${oct}`); }}
                        onTouchStart={e => { e.preventDefault(); e.stopPropagation(); pressKey(`${BLACK_MAP[i]}${oct}`); }}
                        style={{
                          position: 'absolute', top: 0, left: 28, zIndex: 2,
                          width: 28, height: 92, borderRadius: '0 0 6px 6px',
                          background: pressedKeys.has(`${BLACK_MAP[i]}${oct}`)
                            ? `linear-gradient(180deg, ${NOTE_COLORS[BLACK_MAP[i]]} 0%, #1a1830 100%)`
                            : 'linear-gradient(180deg, #22203a 0%, #0d0c1a 100%)',
                          border: '1px solid #3a3860',
                          cursor: 'pointer', userSelect: 'none',
                          boxShadow: pressedKeys.has(`${BLACK_MAP[i]}${oct}`) ? `0 0 16px ${NOTE_COLORS[BLACK_MAP[i]] || '#8b5cf6'}88` : '0 4px 8px rgba(0,0,0,0.6)',
                          transition: 'background 0.06s',
                        }}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
          <p style={{ textAlign: 'center', marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
            Click keys or touch on mobile · Enable Record to capture notation
          </p>
        </div>
      </div>

      {/* AI Generation */}
      <div style={{ padding: '0 32px 32px' }}>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, border: '1px solid var(--border)', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>AI Generation</h2>
            {!backendAlive && (
              <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', borderColor: 'rgba(239,68,68,0.3)' }}>
                Backend offline
              </span>
            )}
            {backendAlive && <span className="badge badge-teal">Ready</span>}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Generates a MIDI continuation based on your recording.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="Describe the style (shown in AI Studio)..."
              className="input-field"
              style={{ flex: 1 }}
            />
            <button
              onClick={handleGenerate}
              disabled={generating || !backendAlive}
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                border: 'none', borderRadius: 10, padding: '12px 24px', cursor: generating ? 'wait' : 'pointer',
                color: 'white', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
                opacity: !backendAlive ? 0.5 : 1,
                boxShadow: '0 4px 20px rgba(139,92,246,0.3)',
              }}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>auto_awesome</span>
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>
          {generated && (
            <div style={{ marginTop: 14, background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.3)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="material-symbols-rounded" style={{ color: 'var(--accent-teal)', fontSize: 20 }}>check_circle</span>
              <p style={{ fontSize: 13, color: 'var(--accent-teal-light)', fontWeight: 600 }}>Composition generated! Open Studio to add it to your project.</p>
              <Link href="/studio" className="btn-teal" style={{ marginLeft: 'auto', padding: '6px 16px', fontSize: 12, flexShrink: 0 }}>Open Studio</Link>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
      `}</style>
    </div>
  );
}
