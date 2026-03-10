'use client';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';

const WHITE_KEYS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const BLACK_KEYS: Record<number, string> = { 0: 'C#', 1: 'D#', 3: 'F#', 4: 'G#', 5: 'A#' };
const OCTAVES = [3, 4, 5];

const NOTE_COLORS: Record<string, string> = {
  'C': '#8b5cf6', 'D': '#6366f1', 'E': '#ec4899',
  'F': '#f59e0b', 'G': '#14b8a6', 'A': '#10b981', 'B': '#3b82f6',
};

export default function PianoPage() {
  const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set());
  const [recording, setRecording] = useState(false);
  const [recordedNotes, setRecordedNotes] = useState<{ note: string; time: number }[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  const pressKey = useCallback((note: string) => {
    setPressedKeys(prev => new Set(prev).add(note));
    if (recording) {
      setRecordedNotes(prev => [...prev, { note, time: Date.now() }]);
    }
    setTimeout(() => {
      setPressedKeys(prev => { const s = new Set(prev); s.delete(note); return s; });
    }, 300);
  }, [recording]);

  const handleGenerate = () => {
    setGenerating(true);
    setTimeout(() => { setGenerating(false); setGenerated(true); }, 2500);
  };

  const navLinks = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Studio', href: '/studio' },
    { label: 'Library', href: '/dashboard/library' },
    { label: 'Settings', href: '#' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', padding: '0 24px', display: 'flex', alignItems: 'center', height: 52 }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, marginRight: 32 }}>
          <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple)', fontSize: 22 }}>piano</span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18 }}>Melodica</span>
        </Link>
        {navLinks.map(l => (
          <Link key={l.href} href={l.href} style={{ marginRight: 24, textDecoration: 'none', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >{l.label}</Link>
        ))}
      </nav>

      {/* Header */}
      <div style={{ padding: '28px 32px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Virtual Piano Studio</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Play, record, and generate music with AI</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => { setRecording(!recording); if (!recording) setRecordedNotes([]); }}
            style={{
              background: recording ? 'rgba(236,72,153,0.2)' : 'var(--bg-card)',
              border: `1px solid ${recording ? 'var(--accent-pink)' : 'var(--border-light)'}`,
              borderRadius: 8, padding: '8px 18px', cursor: 'pointer',
              color: recording ? 'var(--accent-pink)' : 'var(--text-secondary)',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, transition: 'all 0.2s'
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: recording ? 'var(--accent-pink)' : 'var(--text-muted)', animation: recording ? 'pulse 1s infinite' : 'none' }} />
            {recording ? 'Recording...' : 'Record'}
          </button>
          <Link href="/studio" className="btn-secondary" style={{ padding: '8px 18px', fontSize: 13 }}>Open in Studio</Link>
        </div>
      </div>

      {/* Sheet music display */}
      <div style={{ margin: '20px 32px', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', padding: '20px', minHeight: 80 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Sheet Music Viewer {recording && <span style={{ color: 'var(--accent-pink)', marginLeft: 8 }}>● Recording</span>}
          </p>
          <Link href="/sheet-music" style={{ fontSize: 12, color: 'var(--accent-purple-light)', textDecoration: 'none' }}>View Full →</Link>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 40 }}>
          {/* Staff lines */}
          <div style={{ flex: 1, position: 'relative', height: 60 }}>
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: `${i * 12}px`, height: 1, background: 'var(--border-light)' }} />
            ))}
            {/* Recorded notes as dots */}
            {recordedNotes.slice(-16).map((n, i) => (
              <div key={i} style={{
                position: 'absolute', width: 16, height: 16, borderRadius: '50%',
                background: NOTE_COLORS[n.note.replace('#', '')] || '#8b5cf6',
                left: `${i * 7}%`, top: Math.floor(Math.random() * 4) * 12 - 4,
                border: '2px solid var(--bg-card)'
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* Piano keyboard */}
      <div style={{ padding: '0 32px 20px' }}>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, border: '1px solid var(--border-light)', padding: '20px', overflowX: 'auto' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Virtual Keyboard</p>
          <div style={{ display: 'flex', gap: 2, position: 'relative', width: 'fit-content', margin: '0 auto' }}>
            {OCTAVES.map(oct => (
              WHITE_KEYS.map((note, i) => {
                const noteKey = `${note}${oct}`;
                const isPressed = pressedKeys.has(noteKey);
                return (
                  <div key={noteKey} style={{ position: 'relative' }}>
                    {/* White key */}
                    <div
                      onMouseDown={() => pressKey(noteKey)}
                      style={{
                        width: 40, height: 140, borderRadius: '0 0 8px 8px',
                        background: isPressed
                          ? `linear-gradient(180deg, ${NOTE_COLORS[note]} 0%, ${NOTE_COLORS[note]}88 100%)`
                          : 'linear-gradient(180deg, #f0eeff 0%, #d8d4f0 100%)',
                        border: '1px solid #b0aad0', cursor: 'pointer',
                        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                        paddingBottom: 8, fontSize: 10, color: isPressed ? 'white' : '#6b6890',
                        fontWeight: 600, userSelect: 'none', transition: 'all 0.08s',
                        boxShadow: isPressed ? `0 0 20px ${NOTE_COLORS[note]}88` : '0 4px 8px rgba(0,0,0,0.3)'
                      }}
                    >
                      {note}{oct}
                    </div>
                    {/* Black key */}
                    {BLACK_KEYS[i] !== undefined && (
                      <div
                        onMouseDown={e => { e.stopPropagation(); pressKey(`${BLACK_KEYS[i]}${oct}`); }}
                        style={{
                          position: 'absolute', top: 0, left: 25, zIndex: 2,
                          width: 28, height: 88, borderRadius: '0 0 6px 6px',
                          background: pressedKeys.has(`${BLACK_KEYS[i]}${oct}`)
                            ? `linear-gradient(180deg, ${NOTE_COLORS[BLACK_KEYS[i][0]]} 0%, #0d0c1a 100%)`
                            : 'linear-gradient(180deg, #1a1830 0%, #0d0c1a 100%)',
                          border: '1px solid #2d2a4a', cursor: 'pointer', userSelect: 'none', transition: 'all 0.08s',
                          boxShadow: pressedKeys.has(`${BLACK_KEYS[i]}${oct}`) ? `0 0 16px ${NOTE_COLORS[BLACK_KEYS[i][0]]}88` : 'none'
                        }}
                      />
                    )}
                  </div>
                );
              })
            ))}
          </div>
        </div>
      </div>

      {/* AI Generator */}
      <div style={{ padding: '0 32px 32px' }}>
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 16, border: '1px solid var(--border)', padding: '24px' }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>AI Generation</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>Generates based on your current recording</p>
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="Describe the continuation you want..."
              className="input-field"
              style={{ flex: 1 }}
            />
            <button onClick={handleGenerate} disabled={generating} style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', border: 'none', borderRadius: 10, padding: '12px 24px', cursor: generating ? 'wait' : 'pointer', color: 'white', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, boxShadow: '0 4px 20px rgba(139,92,246,0.3)' }}>
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>auto_awesome</span>
              {generating ? 'Generating...' : 'Generate'}
            </button>
          </div>
          {generated && (
            <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.3)', borderRadius: 10, padding: '12px 16px' }}>
              <span className="material-symbols-rounded" style={{ color: 'var(--accent-teal)', fontSize: 20 }}>check_circle</span>
              <p style={{ fontSize: 13, color: 'var(--accent-teal-light)', fontWeight: 600 }}>Composition generated! Click Add to Project to save.</p>
              <button className="btn-teal" style={{ marginLeft: 'auto', padding: '6px 16px', fontSize: 12, flexShrink: 0 }}>Add to Project</button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}
