'use client';
import Link from 'next/link';
import { useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Midi } from '@tonejs/midi';

const PianoNotation = dynamic(() => import('../components/PianoNotation'), { ssr: false });

interface NoteEntry { pitch: string; duration: string; }

// ── Note editing helpers ─────────────────────────────────────────────────────
const SEMITONES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function transposeNote(note: string, semitones: number): string {
  const match = note.match(/^([A-G]#?)(\d)$/);
  if (!match) return note;
  const [, letter, octStr] = match;
  const semIdx = SEMITONES.indexOf(letter);
  if (semIdx === -1) return note;
  let newSem = semIdx + semitones;
  let newOct = parseInt(octStr);
  while (newSem >= 12) { newSem -= 12; newOct++; }
  while (newSem < 0) { newSem += 12; newOct--; }
  return `${SEMITONES[newSem]}${newOct}`;
}

export default function SheetMusicPage() {
  const [layout, setLayout] = useState<'grand' | 'single'>('grand');
  const [zoom, setZoom] = useState(100);
  const [notes, setNotes] = useState<NoteEntry[]>([
    { pitch: 'C4', duration: 'q' }, { pitch: 'E4', duration: 'q' },
    { pitch: 'G4', duration: 'q' }, { pitch: 'B4', duration: 'q' },
    { pitch: 'D5', duration: 'q' }, { pitch: 'F5', duration: 'q' },
  ]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  // Note operations
  const deleteSelected = useCallback(() => {
    if (selectedIdx === null) return;
    setNotes(prev => prev.filter((_, i) => i !== selectedIdx));
    setSelectedIdx(null);
    setIsDirty(true);
  }, [selectedIdx]);

  const transposeSelected = useCallback((delta: number) => {
    if (selectedIdx === null) return;
    setNotes(prev => prev.map((n, i) =>
      i === selectedIdx ? { ...n, pitch: transposeNote(n.pitch, delta) } : n
    ));
    setIsDirty(true);
  }, [selectedIdx]);

  const changeDuration = useCallback((dur: string) => {
    if (selectedIdx === null) return;
    setNotes(prev => prev.map((n, i) => i === selectedIdx ? { ...n, duration: dur } : n));
    setIsDirty(true);
  }, [selectedIdx]);

  // MIDI upload
  const handleMidiUpload = async (file: File) => {
    setUploadedName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const midi = new Midi(buf);
      const parsed: NoteEntry[] = [];
      for (const track of midi.tracks) {
        for (const note of track.notes) {
          parsed.push({ pitch: note.name, duration: 'q' });
          if (parsed.length >= 24) break;
        }
        if (parsed.length >= 24) break;
      }
      setNotes(parsed);
      setSelectedIdx(null);
      setIsDirty(false);
    } catch (e) {
      console.error(e);
    }
  };

  // Export MIDI
  const handleExport = async () => {
    const midi = new Midi();
    const track = midi.addTrack();
    notes.forEach((n, i) => track.addNote({ midi: 60 + i, time: i * 0.5, duration: 0.4, velocity: 0.8 }));
    const bytes = new Uint8Array(midi.toArray());
    const blob = new Blob([bytes], { type: 'audio/midi' });
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as Window & { showSaveFilePicker: (o: object) => Promise<FileSystemFileHandle> })
          .showSaveFilePicker({ suggestedName: 'sheet_export.mid', types: [{ description: 'MIDI', accept: { 'audio/midi': ['.mid'] } }] });
        const w = await handle.createWritable();
        await w.write(blob);
        await w.close();
      } catch { /* AbortError = user dismissed */ }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'sheet_export.mid'; a.click();
      URL.revokeObjectURL(url);
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
        {[{ label: 'Studio', href: '/studio' }, { label: 'Piano', href: '/piano' }, { label: 'Dashboard', href: '/dashboard' }].map(l => (
          <Link key={l.label} href={l.href} style={{ marginRight: 24, textDecoration: 'none', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >{l.label}</Link>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {isDirty && <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', borderColor: 'rgba(245,158,11,0.3)' }}>Unsaved</span>}
          <button onClick={() => fileInputRef.current?.click()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>upload_file</span>
            {uploadedName ?? 'Load MIDI'}
          </button>
          <input ref={fileInputRef} type="file" accept=".mid,.midi" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleMidiUpload(f); }} />
          <button onClick={handleExport} style={{ background: 'var(--accent-purple)', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: 'white', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>ios_share</span>
            Export MIDI
          </button>
        </div>
      </nav>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Settings panel */}
        <div style={{ width: 220, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', padding: '20px 14px', overflowY: 'auto', flexShrink: 0 }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Notation</h3>

          {/* Layout */}
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Staff Layout</p>
          {[{ id: 'grand', label: 'Grand Staff' }, { id: 'single', label: 'Single Staff' }].map(l => (
            <div key={l.id} onClick={() => setLayout(l.id as 'grand' | 'single')} style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', marginBottom: 6, background: layout === l.id ? 'rgba(139,92,246,0.15)' : 'var(--bg-card)', border: `1px solid ${layout === l.id ? 'rgba(139,92,246,0.3)' : 'var(--border)'}`, transition: 'all 0.2s' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: layout === l.id ? 'var(--accent-purple-light)' : 'var(--text-primary)' }}>{l.label}</p>
            </div>
          ))}

          {/* Properties */}
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Properties</p>
            {[['Time', '4/4'], ['Key', 'C Major'], ['Clef', 'Treble']].map(([k, v]) => (
              <div key={k} style={{ marginBottom: 8 }}>
                <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 3 }}>{k}</p>
                <select style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 8px', color: 'var(--text-primary)', fontSize: 12, width: '100%', outline: 'none' }}><option>{v}</option></select>
              </div>
            ))}
          </div>

          {/* Zoom */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Zoom</p>
              <span style={{ fontSize: 11, color: 'var(--accent-purple-light)' }}>{zoom}%</span>
            </div>
            <input type="range" min={50} max={180} value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent-purple)' }} />
          </div>

          {/* Note editor (when a note is selected) */}
          {selectedIdx !== null && (
            <div style={{ marginTop: 20, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10, padding: '12px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-purple-light)', marginBottom: 10 }}>Edit Note #{selectedIdx + 1}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Pitch: <strong style={{ color: 'var(--text-primary)' }}>{notes[selectedIdx].pitch}</strong></p>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <button onClick={() => transposeSelected(1)} style={{ flex: 1, padding: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12 }}>↑ +1</button>
                <button onClick={() => transposeSelected(-1)} style={{ flex: 1, padding: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12 }}>↓ -1</button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Duration</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
                {[['q', 'Quarter'], ['h', 'Half'], ['w', 'Whole'], ['8', 'Eighth']].map(([val, label]) => (
                  <button key={val} onClick={() => changeDuration(val)} style={{ padding: '5px 4px', background: notes[selectedIdx].duration === val ? 'rgba(139,92,246,0.3)' : 'var(--bg-card)', border: `1px solid ${notes[selectedIdx].duration === val ? 'var(--accent-purple)' : 'var(--border)'}`, borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 10 }}>{label}</button>
                ))}
              </div>
              <button onClick={deleteSelected} style={{ width: '100%', padding: '7px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, cursor: 'pointer', color: '#f87171', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 14 }}>delete</span>Delete Note
              </button>
            </div>
          )}

          {/* Keyboard shortcuts hint */}
          <div style={{ marginTop: 20, fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.8 }}>
            <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Shortcuts</strong>
            Click VexFlow area to select note<br />
            ↑/↓ — Transpose<br />
            Del — Delete note
          </div>
        </div>

        {/* Sheet viewer */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px', background: '#f9f8ff', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center', width: '100%', maxWidth: 820 }}>
            {/* Score title */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <h2 style={{ fontFamily: 'serif', fontSize: 22, color: '#1a1830', marginBottom: 4 }}>
                {uploadedName ? uploadedName.replace(/\.(mid|midi)$/, '') : 'Melodica Score'}
              </h2>
              <p style={{ fontSize: 12, color: '#6b6890', fontStyle: 'italic' }}>
                {notes.length} notes · C Major · 4/4
                {isDirty && ' · ✎ Edited'}
              </p>
            </div>

            {/* VexFlow notation */}
            <div style={{ background: 'white', borderRadius: 12, padding: '24px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', cursor: 'pointer' }}>
              <PianoNotation notes={notes} width={760} height={layout === 'grand' ? 180 : 130} />
              {notes.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {notes.map((n, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
                      style={{
                        padding: '3px 10px', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', cursor: 'pointer',
                        background: selectedIdx === i ? 'rgba(139,92,246,0.25)' : '#f0eeff',
                        border: `1px solid ${selectedIdx === i ? '#8b5cf6' : '#c5c0e8'}`,
                        color: selectedIdx === i ? '#6d28d9' : '#4a4870',
                        fontWeight: selectedIdx === i ? 700 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      {n.pitch}
                    </button>
                  ))}
                </div>
              )}
              <p style={{ fontSize: 11, color: '#9b9bc0', marginTop: 10, textAlign: 'center' }}>
                Click a note pill to select it, then use the panel on the left to edit
              </p>
            </div>

            {/* Bass staff (grand mode) */}
            {layout === 'grand' && (
              <div style={{ background: 'white', borderRadius: 12, padding: '24px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', marginTop: 20 }}>
                <p style={{ fontSize: 11, color: '#9b9bc0', marginBottom: 10, textAlign: 'center' }}>Bass Staff (Accompaniment)</p>
                <PianoNotation notes={[]} width={760} height={100} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
