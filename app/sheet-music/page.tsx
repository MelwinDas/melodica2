'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Midi } from '@tonejs/midi';
import { midiBufferToMusicXml, noteEntriesToMusicXml } from '../utils/midiToMusicXml';

// OSMD and Tone are browser-only
const OsmdViewer = dynamic(() => import('../components/OsmdViewer'), { ssr: false });

interface NoteEntry { pitch: string; duration: string; }

// Semitone transpose (for the note-editor panel)
const SEMITONES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
function transposeNote(note: string, delta: number): string {
  const m = note.match(/^([A-G]#?)(\d)$/);
  if (!m) return note;
  const idx = SEMITONES.indexOf(m[1]);
  if (idx === -1) return note;
  let ni = idx + delta, oct = parseInt(m[2]);
  while (ni >= 12) { ni -= 12; oct++; }
  while (ni < 0) { ni += 12; oct--; }
  return `${SEMITONES[ni]}${oct}`;
}

// Build MusicXML from NoteEntry[]
function notesToXml(notes: NoteEntry[]): string {
  return noteEntriesToMusicXml(notes);
}

export default function SheetMusicPage() {
  const [zoom, setZoom] = useState(1.0);
  const [notes, setNotes] = useState<NoteEntry[]>([
    { pitch: 'C4', duration: 'q' }, { pitch: 'E4', duration: 'q' },
    { pitch: 'G4', duration: 'q' }, { pitch: 'B4', duration: 'q' },
    { pitch: 'D5', duration: 'q' }, { pitch: 'F5', duration: 'q' },
  ]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [musicXml, setMusicXml] = useState<string>('');

  // Hold original file blob for export fallback
  const sourceBlobRef = useRef<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Playback
  const [isPlaying, setIsPlaying] = useState(false);
  const synthRef = useRef<import('tone').PolySynth | null>(null);

  // Generate XML whenever notes change
  useEffect(() => {
    setMusicXml(notesToXml(notes));
  }, [notes]);

  // Load from localStorage (piano "Full View") on mount
  useEffect(() => {
    const stored = localStorage.getItem('melodica_piano_notes');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as NoteEntry[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setNotes(parsed);
          setUploadedName('Piano Recording');
          setIsDirty(false);
        }
      } catch { /* ignore */ }
      localStorage.removeItem('melodica_piano_notes');
    }
  }, []);

  // ── MIDI upload ─────────────────────────────────────────────────────────
  const handleMidiUpload = useCallback(async (file: File) => {
    setUploadedName(file.name);
    setIsDirty(false);
    try {
      const buf = await file.arrayBuffer();
      sourceBlobRef.current = new Blob([buf], { type: 'audio/midi' });

      // Build MusicXML directly from the raw MIDI buffer
      const xml = midiBufferToMusicXml(buf);
      setMusicXml(xml);

      // Also extract NoteEntry[] for the note pills editor
      const midi = new Midi(buf);
      const FLAT_TO_SHARP: Record<string, string> = {
        'Bb': 'A#', 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#',
      };
      const extracted: NoteEntry[] = [];
      for (const track of midi.tracks) {
        for (const note of track.notes) {
          const m = note.name.match(/^([A-G]b?)(\d)$/);
          let pitch = note.name;
          if (m && FLAT_TO_SHARP[m[1]]) pitch = `${FLAT_TO_SHARP[m[1]]}${m[2]}`;
          extracted.push({ pitch, duration: 'q' });
          if (extracted.length >= 64) break;
        }
        if (extracted.length > 0) break;
      }
      if (extracted.length > 0) setNotes(extracted);
    } catch (e) { console.error('[sheet-music] MIDI parse error', e); }
  }, []);

  // ── Note operations ─────────────────────────────────────────────────────
  const deleteSelected = useCallback(() => {
    if (selectedIdx === null) return;
    setNotes(p => p.filter((_, i) => i !== selectedIdx));
    setSelectedIdx(null); setIsDirty(true);
  }, [selectedIdx]);

  const transposeSelected = useCallback((delta: number) => {
    if (selectedIdx === null) return;
    setNotes(p => p.map((n, i) => i === selectedIdx ? { ...n, pitch: transposeNote(n.pitch, delta) } : n));
    setIsDirty(true);
  }, [selectedIdx]);

  const changeDuration = useCallback((dur: string) => {
    if (selectedIdx === null) return;
    setNotes(p => p.map((n, i) => i === selectedIdx ? { ...n, duration: dur } : n));
    setIsDirty(true);
  }, [selectedIdx]);

  // ── Playback ────────────────────────────────────────────────────────────
  const handlePlay = async () => {
    if (isPlaying) { synthRef.current?.dispose(); synthRef.current = null; setIsPlaying(false); return; }
    const Tone = await import('tone');
    await Tone.start();
    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.8 },
    }).toDestination();
    synthRef.current = synth;
    notes.slice(0, 64).forEach((n, i) => synth.triggerAttackRelease(n.pitch, '8n', Tone.now() + i * 0.35));
    setIsPlaying(true);
    setTimeout(() => { synth.dispose(); synthRef.current = null; setIsPlaying(false); }, notes.length * 350 + 800);
  };

  const handleStop = () => { synthRef.current?.dispose(); synthRef.current = null; setIsPlaying(false); };

  // ── Export MIDI ─────────────────────────────────────────────────────────
  const handleExport = async () => {
    let blob: Blob;
    const filename = (uploadedName ?? 'melodica_score').replace(/\.(mid|midi)$/i, '') + '_export.mid';

    if (!isDirty && sourceBlobRef.current) {
      blob = sourceBlobRef.current; // return the original unchanged file
    } else {
      const midi = new Midi();
      const track = midi.addTrack();
      notes.forEach((n, i) => {
        const STEP_TO_MIDI: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
        const mv = n.pitch.match(/^([A-G]#?)(\d)$/);
        const midiNum = mv ? (parseInt(mv[2]) + 1) * 12 + (STEP_TO_MIDI[mv[1]] ?? 0) : 60;
        track.addNote({ midi: midiNum, time: i * 0.5, duration: 0.4, velocity: 0.8 });
      });
      blob = new Blob([new Uint8Array(midi.toArray())], { type: 'audio/midi' });
    }

    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as Window & { showSaveFilePicker: (o: object) => Promise<FileSystemFileHandle> })
          .showSaveFilePicker({ suggestedName: filename, types: [{ description: 'MIDI', accept: { 'audio/midi': ['.mid'] } }] });
        const w = await handle.createWritable(); await w.write(blob); await w.close();
      } catch { /* AbortError */ }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', padding: '0 20px', display: 'flex', alignItems: 'center', height: 52, gap: 6 }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, marginRight: 20 }}>
          <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple)', fontSize: 22 }}>piano</span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18 }}>Melodica</span>
        </Link>
        {[{ label: 'Studio', href: '/studio' }, { label: 'Piano', href: '/piano' }].map(l => (
          <Link key={l.label} href={l.href}
            style={{ marginRight: 16, textDecoration: 'none', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >{l.label}</Link>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {isDirty && <span className="badge" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', borderColor: 'rgba(245,158,11,0.3)' }}>Unsaved</span>}

          {/* Play / Stop */}
          <button onClick={handlePlay} style={{ background: isPlaying ? 'rgba(20,184,166,0.15)' : 'var(--bg-card)', border: `1px solid ${isPlaying ? 'var(--accent-teal)' : 'var(--border)'}`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: isPlaying ? 'var(--accent-teal-light)' : 'var(--text-secondary)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>{isPlaying ? 'pause' : 'play_arrow'}</span>
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button onClick={handleStop} disabled={!isPlaying} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 11px', cursor: 'pointer', color: 'var(--text-secondary)', opacity: isPlaying ? 1 : 0.4 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>stop</span>
          </button>

          {/* Upload MIDI */}
          <button onClick={() => fileInputRef.current?.click()} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: uploadedName ? 'var(--accent-teal-light)' : 'var(--text-secondary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, maxWidth: 200, overflow: 'hidden' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 16, flexShrink: 0 }}>upload_file</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{uploadedName ?? 'Load MIDI'}</span>
          </button>
          <input ref={fileInputRef} type="file" accept=".mid,.midi" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleMidiUpload(f); e.currentTarget.value = ''; }}
          />

          {/* Export */}
          <button onClick={handleExport} style={{ background: 'var(--accent-purple)', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: 'white', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>ios_share</span>
            Export MIDI
          </button>
        </div>
      </nav>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left settings panel */}
        <div style={{ width: 210, background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)', padding: '18px 14px', overflowY: 'auto', flexShrink: 0 }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>Notation</h3>

          {/* Zoom */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Zoom</p>
              <span style={{ fontSize: 11, color: 'var(--accent-purple-light)' }}>{Math.round(zoom * 100)}%</span>
            </div>
            <input type="range" min={0.5} max={2.0} step={0.05} value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--accent-purple)' }} />
          </div>

          {/* Note editor */}
          {selectedIdx !== null && notes[selectedIdx] && (
            <div style={{ marginTop: 4, background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: 10, padding: '12px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-purple-light)', marginBottom: 10 }}>Edit Note #{selectedIdx + 1}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Pitch: <strong style={{ color: 'var(--text-primary)' }}>{notes[selectedIdx].pitch}</strong></p>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <button onClick={() => transposeSelected(1)} style={{ flex: 1, padding: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12 }}>↑ +1</button>
                <button onClick={() => transposeSelected(-1)} style={{ flex: 1, padding: '6px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12 }}>↓ -1</button>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Duration</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginBottom: 10 }}>
                {[['q', 'Quarter'], ['h', 'Half'], ['w', 'Whole'], ['8', 'Eighth']].map(([val, label]) => (
                  <button key={val} onClick={() => changeDuration(val)}
                    style={{ padding: '5px 4px', background: notes[selectedIdx]?.duration === val ? 'rgba(139,92,246,0.3)' : 'var(--bg-card)', border: `1px solid ${notes[selectedIdx]?.duration === val ? 'var(--accent-purple)' : 'var(--border)'}`, borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 10 }}>{label}</button>
                ))}
              </div>
              <button onClick={deleteSelected}
                style={{ width: '100%', padding: '7px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, cursor: 'pointer', color: '#f87171', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 14 }}>delete</span>Delete
              </button>
            </div>
          )}

          <div style={{ marginTop: 18, fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.9 }}>
            <strong style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Quick Help</strong>
            Click a note pill to select<br />
            ↑/↓ transpose by semitone<br />
            Del removes selected note
          </div>
        </div>

        {/* Sheet music area (OSMD) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px', background: '#f0eff8', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: 22, width: '100%', maxWidth: 860 }}>
            <h2 style={{ fontFamily: 'serif', fontSize: 22, color: '#1a1830', marginBottom: 4 }}>
              {uploadedName ? uploadedName.replace(/\.(mid|midi)$/i, '') : 'Melodica Score'}
            </h2>
            <p style={{ fontSize: 12, color: '#6b6890', fontStyle: 'italic' }}>
              {notes.length} notes · C Major · 4/4{isDirty && ' · ✎ Edited'}
            </p>
          </div>

          {/* OSMD sheet music — whole score */}
          <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '24px', width: '100%', maxWidth: 860, marginBottom: 20 }}>
            {musicXml ? (
              <OsmdViewer musicXml={musicXml} zoom={zoom} drawTitle={false} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}>
                <p style={{ color: '#9d99bb', fontSize: 14 }}>Generating notation…</p>
              </div>
            )}
          </div>

          {/* Note pills */}
          {notes.length > 0 && (
            <div style={{ background: 'white', borderRadius: 12, padding: '14px 20px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', width: '100%', maxWidth: 860, marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: '#6b6890', marginBottom: 10, fontWeight: 600 }}>NOTES — click to select &amp; edit</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {notes.map((n, i) => (
                  <button key={i} onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
                    style={{
                      padding: '3px 10px', borderRadius: 6, fontSize: 11, fontFamily: 'monospace', cursor: 'pointer',
                      background: selectedIdx === i ? 'rgba(139,92,246,0.25)' : '#f0eeff',
                      border: `1px solid ${selectedIdx === i ? '#8b5cf6' : '#c5c0e8'}`,
                      color: selectedIdx === i ? '#6d28d9' : '#4a4870',
                      fontWeight: selectedIdx === i ? 700 : 400, transition: 'all 0.15s',
                    }}
                  >{n.pitch}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
