'use client';
import Link from 'next/link';
import { useState } from 'react';

const MEASURES = 4;
const BEATS = 4;
const NOTES = ['C5','B4','A4','G4','F4','E4','D4','C4','B3','A3','G3'];

const sampleNotes = [
  { row: 0, col: 0, dur: 1 }, { row: 2, col: 1, dur: 1 }, { row: 4, col: 2, dur: 2 },
  { row: 1, col: 4, dur: 1 }, { row: 3, col: 5, dur: 1 }, { row: 5, col: 6, dur: 1 },
  { row: 2, col: 8, dur: 2 }, { row: 0, col: 10, dur: 1 }, { row: 6, col: 11, dur: 1 },
  { row: 4, col: 12, dur: 2 }, { row: 1, col: 14, dur: 1 }, { row: 7, col: 15, dur: 1 },
];

export default function SheetMusicPage() {
  const [layout, setLayout] = useState<'grand' | 'single'>('grand');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [zoom, setZoom] = useState(100);

  const handlePlay = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      let p = 0;
      const interval = setInterval(() => {
        p += 1;
        setPlayhead(p);
        if (p >= MEASURES * BEATS * 4) { clearInterval(interval); setIsPlaying(false); setPlayhead(0); }
      }, 80);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', padding: '0 24px', display: 'flex', alignItems: 'center', height: 52 }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, marginRight: 24 }}>
          <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple)', fontSize: 22 }}>piano</span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18 }}>Melodica</span>
        </Link>
        {[{ label: 'Studio', href: '/studio' }, { label: 'Library', href: '/dashboard' }, { label: 'Export', href: '/studio' }].map(l => (
          <Link key={l.label} href={l.href} style={{ marginRight: 24, textDecoration: 'none', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >{l.label}</Link>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={handlePlay} style={{ background: isPlaying ? 'rgba(236,72,153,0.2)' : 'var(--accent-purple)', border: 'none', borderRadius: 8, padding: '7px 18px', cursor: 'pointer', color: 'white', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{isPlaying ? 'pause' : 'play_arrow'}</span>
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <Link href="/studio" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>ios_share</span>
            Export
          </Link>
        </div>
      </nav>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Settings panel */}
        <div style={{ width: 240, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', padding: '20px 16px', overflowY: 'auto', flexShrink: 0 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Notation Settings</h3>

          {/* Layout */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>Layout</p>
            {[
              { id: 'grand', label: 'Grand Staff', desc: 'Piano layout' },
              { id: 'single', label: 'Single Staff', desc: 'Melody line' },
            ].map(l => (
              <div key={l.id} onClick={() => setLayout(l.id as 'grand' | 'single')} style={{ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 6, background: layout === l.id ? 'rgba(139,92,246,0.15)' : 'var(--bg-card)', border: `1px solid ${layout === l.id ? 'rgba(139,92,246,0.3)' : 'var(--border)'}`, transition: 'all 0.2s' }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: layout === l.id ? 'var(--accent-purple-light)' : 'var(--text-primary)', marginBottom: 2 }}>{l.label}</p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.desc}</p>
              </div>
            ))}
          </div>

          {/* Properties */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10 }}>Properties</p>
            {[['Time Signature', '4/4'], ['Key Signature', 'C Major'], ['Clef', 'Treble'], ['Tempo', '128 BPM']].map(([label, val]) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
                <select style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12, width: '100%', outline: 'none' }}>
                  <option>{val}</option>
                </select>
              </div>
            ))}
          </div>

          {/* Zoom */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Zoom</p>
              <span style={{ fontSize: 11, color: 'var(--accent-purple-light)' }}>{zoom}%</span>
            </div>
            <input type="range" min={50} max={200} value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent-purple)' }} />
          </div>
        </div>

        {/* Sheet music viewer */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px', background: '#f8f7ff' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <h2 style={{ fontFamily: 'serif', fontSize: 22, color: '#1a1830', marginBottom: 4 }}>Neon Nights Synthwave</h2>
              <p style={{ fontSize: 12, color: '#6b6890', fontStyle: 'italic' }}>Generated by Melodica AI · 128 BPM · C Major</p>
            </div>

            {/* Staff */}
            {[0, 1].map(staffIdx => (
              <div key={staffIdx} style={{ marginBottom: 48 }}>
                <div style={{ position: 'relative', height: layout === 'grand' ? 120 : 80, background: 'white', borderRadius: 4, padding: '16px 32px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  {/* Staff lines */}
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} style={{ position: 'absolute', left: 16, right: 16, top: `${20 + i * 12}px`, height: 1, background: '#1a1830', opacity: 0.6 }} />
                  ))}

                  {/* Clef symbol */}
                  <div style={{ position: 'absolute', left: 20, top: 8, fontSize: 56, color: '#1a1830', fontFamily: 'serif', lineHeight: 1 }}>𝄞</div>

                  {/* Time signature */}
                  <div style={{ position: 'absolute', left: 52, top: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: 18, fontWeight: 900, color: '#1a1830', lineHeight: 1 }}>4</span>
                    <span style={{ fontSize: 18, fontWeight: 900, color: '#1a1830', lineHeight: 1 }}>4</span>
                  </div>

                  {/* Bar lines */}
                  {Array.from({ length: MEASURES + 1 }).map((_, i) => (
                    <div key={i} style={{ position: 'absolute', left: `${75 + i * (85 / MEASURES)}%`, top: 20, height: 48, width: 1.5, background: '#1a1830', opacity: 0.5 }} />
                  ))}

                  {/* Playhead */}
                  {isPlaying && (
                    <div style={{ position: 'absolute', left: `${75 + (playhead / (MEASURES * BEATS * 4)) * 85}%`, top: 16, height: 56, width: 2, background: 'var(--accent-purple)', opacity: 0.8, transition: 'left 0.08s linear' }} />
                  )}

                  {/* Notes */}
                  {sampleNotes.filter((_, i) => i % 2 === staffIdx % 2).map((n, i) => (
                    <div key={i} style={{
                      position: 'absolute',
                      left: `${78 + (n.col / (MEASURES * BEATS)) * 80}%`,
                      top: `${20 + n.row * 6}px`,
                      width: `${n.dur * 18}px`, height: 10, borderRadius: 10,
                      background: '#1a1830', opacity: 0.85,
                      display: 'flex', alignItems: 'center',
                    }} />
                  ))}

                  {/* Bass staff (grand staff) */}
                  {layout === 'grand' && (
                    <>
                      <div style={{ position: 'absolute', left: 16, top: 80, right: 16, height: 1, background: '#1a1830', opacity: 0.2 }} />
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} style={{ position: 'absolute', left: 16, right: 16, top: `${88 + i * 12}px`, height: 1, background: '#1a1830', opacity: 0.6 }} />
                      ))}
                      <div style={{ position: 'absolute', left: 22, top: 78, fontSize: 38, color: '#1a1830', fontFamily: 'serif' }}>𝄢</div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
