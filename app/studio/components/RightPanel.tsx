'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { GENRES, TimelineNote } from '../lib/types';
import { timelineToMidiBlob, parseMidiToTimeline, parseMidiToNoteEntries, storeMidiInLocalStorage, appendMidiToTimeline } from '../lib/midiIO';

const PianoNotation = dynamic(() => import('../../components/PianoNotation'), { ssr: false });

type StudioTab = 'ai-generate' | 'file-upload' | 'file-export';

// Slider sub-component
function Slider({ label, min, max, step, value, onChange, format }: {
  label: string; min: number; max: number; step: number; value: number;
  onChange: (v: number) => void; format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent-purple-light)', fontFamily: 'monospace' }}>
          {format ? format(value) : value}
        </span>
      </div>
      <div style={{ position: 'relative', height: 20, display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: 0, right: 0, height: 5, background: 'var(--bg-card)', borderRadius: 3 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #8b5cf6 0%, #14b8a6 100%)', borderRadius: 3 }} />
        </div>
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ position: 'absolute', left: 0, right: 0, width: '100%', opacity: 0, cursor: 'pointer', height: 20 }}
        />
        <div style={{
          position: 'absolute', left: `calc(${pct}% - 8px)`,
          width: 16, height: 16, borderRadius: '50%', background: 'white',
          boxShadow: '0 0 0 3px var(--accent-purple), 0 2px 8px rgba(0,0,0,0.4)',
          pointerEvents: 'none', transition: 'left 0.05s',
        }} />
      </div>
    </div>
  );
}

interface Props {
  notes: TimelineNote[];
  bpm: number;
  backendAlive: boolean | null;
  onLoadMidi: (buffer: ArrayBuffer, filename: string) => void;
  onAppendGenerated: (buffer: ArrayBuffer) => void;
  onExportMidi: () => Blob;
  recordAudioBlob: (ms: number) => Promise<Blob>;
}

export default function RightPanel({
  notes, bpm, backendAlive,
  onLoadMidi, onAppendGenerated, onExportMidi, recordAudioBlob,
}: Props) {
  const [tab, setTab] = useState<StudioTab>('ai-generate');

  // Upload state
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [midiMeta, setMidiMeta] = useState<{ tracks: number; notes: number; duration: number; bpm: number } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI generation state
  const [genLength, setGenLength] = useState(512);
  const [temperature, setTemperature] = useState(0.9);
  const [topK, setTopK] = useState(20);
  const [genre, setGenre] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);
  const [seedFile, setSeedFile] = useState<File | null>(null);
  const seedFileRef = useRef<HTMLInputElement>(null);
  const [generatedNotes, setGeneratedNotes] = useState<{ pitch: string; duration: string }[]>([]);
  const [generatedMidiBlob, setGeneratedMidiBlob] = useState<Blob | null>(null);

  // Export state
  const [exportFormat, setExportFormat] = useState<'midi' | 'mp3'>('midi');
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // ── File handling ─────────────────────────────────────────────────────
  const parseMidiFile = useCallback(async (file: File) => {
    setUploadedFile(file.name);
    setAnalyzing(true);
    try {
      const buf = await file.arrayBuffer();
      const { Midi } = await import('@tonejs/midi');
      const midi = new Midi(buf);
      let totalNotes = 0;
      for (const track of midi.tracks) totalNotes += track.notes.length;
      const lastNote = midi.tracks.flatMap(t => t.notes).reduce(
        (acc, n) => Math.max(acc, n.time + n.duration), 0
      );
      const parsedBpm = midi.header.tempos[0]?.bpm ?? 120;
      setMidiMeta({
        tracks: midi.tracks.filter(t => t.notes.length > 0).length,
        notes: totalNotes,
        duration: lastNote,
        bpm: parsedBpm,
      });

      storeMidiInLocalStorage(buf, file.name);
      onLoadMidi(buf, file.name);
    } catch (e) {
      console.error('MIDI parse error', e);
    } finally {
      setAnalyzing(false);
    }
  }, [onLoadMidi]);

  const handleFileDrop = useCallback((file: File) => {
    if (file.name.endsWith('.mid') || file.name.endsWith('.midi')) {
      parseMidiFile(file);
    }
  }, [parseMidiFile]);

  // ── AI generation ─────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!backendAlive) return;
    setGenerating(true);
    setGenError(null);
    setGenProgress(0);
    setGeneratedNotes([]);
    setGeneratedMidiBlob(null);

    const interval = setInterval(() => {
      setGenProgress(p => Math.min(p + 3, 90));
    }, 800);

    try {
      // Serialize current timeline as seed if we have notes
      let resolvedSeedFile: File | Blob | null = seedFile;
      if (!resolvedSeedFile && notes.length > 0) {
        const blob = timelineToMidiBlob({ notes, bpm, timeSignature: [4, 4] });
        resolvedSeedFile = new File([blob], 'timeline_seed.mid', { type: 'audio/midi' });
      }

      let res: Response;
      if (resolvedSeedFile) {
        const fd = new FormData();
        fd.append('file', resolvedSeedFile);
        fd.append('length', String(genLength));
        fd.append('temperature', String(temperature));
        fd.append('top_k', String(topK));
        fd.append('genre', String(genre));
        res = await fetch('http://localhost:8000/generate-with-seed', { method: 'POST', body: fd });
      } else {
        res = await fetch('http://localhost:8000/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ length: genLength, temperature, top_k: topK, genre }),
        });
      }

      clearInterval(interval);
      if (!res.ok) throw new Error(await res.text());
      setGenProgress(100);

      const arrayBuf = await res.arrayBuffer();
      const typedBlob = new Blob([arrayBuf], { type: 'audio/midi' });
      setGeneratedMidiBlob(typedBlob);

      // Parse for notation preview
      const noteEntries = parseMidiToNoteEntries(arrayBuf);
      setGeneratedNotes(noteEntries);

      // Concatenate: append generated notes after existing timeline
      onAppendGenerated(arrayBuf);

    } catch (e: unknown) {
      clearInterval(interval);
      setGenError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  // ── Export ─────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    setExportSuccess(false);
    try {
      let blob: Blob;
      let filename: string;

      if (exportFormat === 'midi') {
        if (notes.length > 0) {
          blob = onExportMidi();
          filename = 'melodica_export.mid';
        } else if (generatedMidiBlob) {
          blob = generatedMidiBlob;
          filename = `melodica_gen_${GENRES[genre].label.toLowerCase()}.mid`;
        } else {
          setExporting(false);
          alert('No MIDI data. Upload or generate first.');
          return;
        }
      } else {
        blob = await recordAudioBlob(3000);
        filename = 'melodica_export.mp3';
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportSuccess(true);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') console.error(e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ width: '45%', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'ai-generate' as StudioTab, label: 'AI Generate', icon: 'auto_awesome' },
          { id: 'file-upload' as StudioTab, label: 'Upload', icon: 'upload_file' },
          { id: 'file-export' as StudioTab, label: 'Export', icon: 'ios_share' },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer',
            background: tab === t.id ? 'rgba(139,92,246,0.1)' : 'transparent',
            color: tab === t.id ? 'var(--accent-purple-light)' : 'var(--text-secondary)',
            fontSize: 12, fontWeight: 600,
            borderBottom: tab === t.id ? '2px solid var(--accent-purple)' : '2px solid transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.2s',
          }}>
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

        {/* ── AI Generate ── */}
        {tab === 'ai-generate' && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>AI Studio Generation</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Generate music and append to the current timeline.
              {!backendAlive && (
                <span style={{ color: '#f87171', marginLeft: 6 }}>
                  Run: <code style={{ background: 'var(--bg-card)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>uvicorn api:app --reload</code> in Melo_API/
                </span>
              )}
            </p>

            {/* Genre */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Genre</label>
              <select value={genre} onChange={e => setGenre(Number(e.target.value))} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
                padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13, width: '100%', outline: 'none', cursor: 'pointer',
              }}>
                {GENRES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </div>

            {/* Length */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Length (tokens)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="number" value={genLength}
                  onChange={e => setGenLength(Math.max(64, Math.min(1024, Number(e.target.value))))}
                  min={64} max={1024}
                  style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
                    padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, width: 90,
                    outline: 'none', textAlign: 'center', fontWeight: 700,
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>64 – 1024</span>
              </div>
            </div>

            {/* Temperature */}
            <Slider label="Temperature" min={0.8} max={1.1} step={0.01} value={temperature}
              onChange={setTemperature} format={v => v.toFixed(2)} />

            {/* Top-K */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Top-K Sampling</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="number" value={topK}
                  onChange={e => setTopK(Math.max(1, Math.min(100, Number(e.target.value))))}
                  min={1} max={100}
                  style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8,
                    padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, width: 90,
                    outline: 'none', textAlign: 'center', fontWeight: 700,
                  }}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>1 – 100</span>
              </div>
            </div>

            {/* Seed file */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                Seed MIDI File <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional — timeline used if empty)</span>
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={() => seedFileRef.current?.click()} style={{
                  flex: 1, padding: '9px 14px', background: 'var(--bg-card)',
                  border: `1px solid ${seedFile ? 'var(--accent-teal)' : 'var(--border)'}`,
                  borderRadius: 8, cursor: 'pointer',
                  color: seedFile ? 'var(--accent-teal-light)' : 'var(--text-secondary)',
                  fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden',
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 15, flexShrink: 0 }}>
                    {seedFile ? 'audio_file' : 'upload_file'}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {seedFile ? seedFile.name : 'Select .mid file…'}
                  </span>
                </button>
                {seedFile && (
                  <button onClick={() => setSeedFile(null)} style={{
                    padding: '9px 10px', background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
                    cursor: 'pointer', color: '#f87171', fontSize: 12,
                  }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 15 }}>close</span>
                  </button>
                )}
              </div>
              <input ref={seedFileRef} type="file" accept=".mid,.midi" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) setSeedFile(f); e.target.value = ''; }}
              />
            </div>

            {/* Progress */}
            {generating && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ height: 6, background: 'var(--bg-card)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${genProgress}%`,
                    background: 'linear-gradient(90deg, #8b5cf6 0%, #14b8a6 100%)',
                    borderRadius: 4, transition: 'width 0.8s ease',
                  }} />
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  Generating… {genProgress}% — this can take 10–30 seconds
                </p>
              </div>
            )}

            {genError && (
              <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8 }}>
                <p style={{ fontSize: 12, color: '#f87171' }}>Error: {genError}</p>
              </div>
            )}

            <button onClick={handleGenerate} disabled={generating || !backendAlive} style={{
              width: '100%', padding: '13px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
              border: 'none', borderRadius: 10,
              cursor: generating || !backendAlive ? 'not-allowed' : 'pointer',
              color: 'white', fontWeight: 700, fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: !backendAlive ? 0.5 : 1,
              boxShadow: '0 4px 20px rgba(139,92,246,0.3)',
            }}>
              <span className="material-symbols-rounded" style={{ fontSize: 18, animation: generating ? 'spin 1s linear infinite' : 'none' }}>
                {generating ? 'refresh' : 'auto_awesome'}
              </span>
              {generating ? `Generating… (${genProgress}%)` : 'Generate & Append'}
            </button>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
              {notes.length > 0 ? 'Generated music will be appended after current timeline.' : 'Generated music will start at position 0:00.'}
            </p>

            {/* Generated output preview */}
            {generatedNotes.length > 0 && (
              <div style={{ marginTop: 24, background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.25)', borderRadius: 12, padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="material-symbols-rounded" style={{ color: 'var(--accent-teal)', fontSize: 18 }}>check_circle</span>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-teal-light)' }}>Appended to Timeline</p>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <span className="badge badge-teal" style={{ fontSize: 10 }}>{generatedNotes.length} notes</span>
                    {generatedMidiBlob && (
                      <button
                        onClick={() => {
                          const url = URL.createObjectURL(generatedMidiBlob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `melodica_gen_${GENRES[genre].label.toLowerCase()}.mid`;
                          a.style.display = 'none';
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          setTimeout(() => URL.revokeObjectURL(url), 5000);
                        }}
                        style={{
                          padding: '3px 10px', background: 'var(--bg-card)',
                          border: '1px solid var(--border)', borderRadius: 6,
                          cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 11,
                          display: 'flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        <span className="material-symbols-rounded" style={{ fontSize: 13 }}>download</span>
                        .mid
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ background: 'white', borderRadius: 8, padding: '12px', overflow: 'hidden' }}>
                  <PianoNotation notes={generatedNotes.slice(0, 8)} width={340} height={120} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── File Upload ── */}
        {tab === 'file-upload' && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Upload & Transcribe</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Upload a MIDI file to load into the piano roll editor.
            </p>

            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileDrop(f); }}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--accent-purple)' : uploadedFile ? 'var(--accent-teal)' : 'var(--border-light)'}`,
                borderRadius: 14, padding: '36px 24px', textAlign: 'center', cursor: 'pointer',
                background: dragOver ? 'rgba(139,92,246,0.06)' : uploadedFile ? 'rgba(20,184,166,0.05)' : 'var(--bg-card)',
                transition: 'all 0.2s', marginBottom: 20,
              }}
            >
              <input ref={fileInputRef} type="file" accept=".mid,.midi,.mp3" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileDrop(f); }} />
              <span className="material-symbols-rounded" style={{
                fontSize: 44, color: uploadedFile ? 'var(--accent-teal)' : 'var(--text-muted)', display: 'block', marginBottom: 10,
              }}>
                {uploadedFile ? 'audio_file' : 'upload_file'}
              </span>
              {uploadedFile ? (
                <>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-teal-light)', marginBottom: 4 }}>{uploadedFile}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    {analyzing ? '⏳ Parsing MIDI…' : '✓ Loaded — rendered in piano roll'}
                  </p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Drag and drop your file</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>MIDI: .mid .midi &nbsp;|&nbsp; Audio: .mp3</p>
                </>
              )}
            </div>

            {midiMeta && uploadedFile && (
              <div style={{ background: 'var(--bg-panel)', borderRadius: 12, padding: '16px', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>MIDI Info</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  {[
                    { label: 'Tracks', value: midiMeta.tracks, icon: 'queue_music' },
                    { label: 'Notes', value: midiMeta.notes, icon: 'music_note' },
                    { label: 'Duration', value: `${midiMeta.duration.toFixed(1)}s`, icon: 'timer' },
                    { label: 'Tempo', value: `${Math.round(midiMeta.bpm)} BPM`, icon: 'speed' },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="material-symbols-rounded" style={{ fontSize: 16, color: 'var(--accent-purple-light)' }}>{s.icon}</span>
                      <div>
                        <p style={{ fontSize: 16, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1 }}>{s.value}</p>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => window.location.href = '/sheet-music'}
                  className="btn-teal"
                  style={{ display: 'block', width: '100%', textAlign: 'center', padding: '11px', fontSize: 13, border: 'none', cursor: 'pointer', borderRadius: 10 }}
                >View Full Sheet Music</button>
              </div>
            )}
          </div>
        )}

        {/* ── Export ── */}
        {tab === 'file-export' && (
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Export Project</h3>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>Export your session in MIDI or MP3 format.</p>

            <div style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10 }}>Export Format</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {(['midi', 'mp3'] as const).map(fmt => (
                  <button key={fmt} onClick={() => setExportFormat(fmt)} style={{
                    padding: '18px', border: `2px solid ${exportFormat === fmt ? 'var(--accent-purple)' : 'var(--border)'}`,
                    borderRadius: 12, cursor: 'pointer', fontSize: 14, fontWeight: 800,
                    background: exportFormat === fmt ? 'rgba(139,92,246,0.15)' : 'var(--bg-card)',
                    color: exportFormat === fmt ? 'var(--accent-purple-light)' : 'var(--text-secondary)',
                    textTransform: 'uppercase', letterSpacing: '0.08em', transition: 'all 0.2s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 28 }}>{fmt === 'midi' ? 'piano' : 'audio_file'}</span>
                    {fmt.toUpperCase()}
                    <span style={{ fontSize: 10, fontWeight: 400, textTransform: 'none', color: 'var(--text-muted)' }}>
                      {fmt === 'midi' ? 'Music notation file' : 'Rendered audio file'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: 'var(--bg-panel)', borderRadius: 12, padding: '16px', border: '1px solid var(--border)', marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                {exportFormat === 'midi' ? 'MIDI Settings' : 'Audio Quality'}
              </p>
              {exportFormat === 'midi' ? (
                <>
                  <Slider label="Velocity" min={0} max={127} step={1} value={80} onChange={() => {}} />
                  <Slider label="Tempo (BPM)" min={60} max={200} step={1} value={bpm} onChange={() => {}} />
                </>
              ) : (
                <>
                  <Slider label="Bitrate (kbps)" min={128} max={320} step={32} value={256} onChange={() => {}} format={v => `${v} kbps`} />
                  <Slider label="Volume Normalize" min={-3} max={0} step={0.1} value={-0.1} onChange={() => {}} format={v => `${v.toFixed(1)} dBFS`} />
                </>
              )}
            </div>

            {exportSuccess && (
              <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="material-symbols-rounded" style={{ color: 'var(--accent-teal)', fontSize: 18 }}>check_circle</span>
                <p style={{ fontSize: 12, color: 'var(--accent-teal-light)', fontWeight: 600 }}>Export successful!</p>
              </div>
            )}

            <button onClick={handleExport} disabled={exporting} style={{
              width: '100%', padding: '13px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
              border: 'none', borderRadius: 10, cursor: exporting ? 'wait' : 'pointer',
              color: 'white', fontWeight: 700, fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 4px 20px rgba(139,92,246,0.3)',
            }}>
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{exporting ? 'hourglass_top' : 'ios_share'}</span>
              {exporting ? 'Exporting…' : `Export ${exportFormat.toUpperCase()}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
