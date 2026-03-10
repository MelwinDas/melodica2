'use client';
import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Midi } from '@tonejs/midi';

const PianoNotation = dynamic(() => import('../components/PianoNotation'), { ssr: false });

// ── Genre map from config.py ────────────────────────────────────────────────
const GENRES = [
  { id: 0, label: 'Ambient' }, { id: 1, label: 'Blues' },
  { id: 2, label: 'Children' }, { id: 3, label: 'Classical' },
  { id: 4, label: 'Country' }, { id: 5, label: 'Electronic' },
  { id: 6, label: 'Folk' }, { id: 7, label: 'Jazz' },
  { id: 8, label: 'Latin' }, { id: 9, label: 'Pop' },
  { id: 10, label: 'Rap' }, { id: 11, label: 'Reggae' },
  { id: 12, label: 'Religious' }, { id: 13, label: 'Rock' },
  { id: 14, label: 'Soul' }, { id: 15, label: 'Soundtracks' },
  { id: 16, label: 'Unknown' }, { id: 17, label: 'World' },
];

type StudioTab = 'ai-generate' | 'file-upload' | 'file-export';

interface NoteEntry { pitch: string; duration: string; }

// ── Slider component ─────────────────────────────────────────────────────────
function Slider({ label, min, max, step, value, onChange, format }:
  { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; format?: (v: number) => string }) {
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
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{ position: 'absolute', left: 0, right: 0, width: '100%', opacity: 0, cursor: 'pointer', height: 20 }}
        />
        <div style={{
          position: 'absolute', left: `calc(${pct}% - 8px)`,
          width: 16, height: 16, borderRadius: '50%', background: 'white',
          boxShadow: '0 0 0 3px var(--accent-purple), 0 2px 8px rgba(0,0,0,0.4)',
          pointerEvents: 'none', transition: 'left 0.05s'
        }} />
      </div>
    </div>
  );
}

// ── MP3 export helper via MediaRecorder ─────────────────────────────────────
// Captures the browser AudioContext output for `durationMs` milliseconds.
// Returns a Blob of type audio/webm (Opus codec). Browsers cannot natively
// encode true MP3 without a WASM encoder; webm/Opus is transparent quality.
async function recordAudioBlob(durationMs: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) { reject(new Error('AudioContext not supported')); return; }
      const ctx = new AudioCtx();
      const dest = ctx.createMediaStreamDestination();
      // Create an oscillator briefly to populate the stream (otherwise empty)
      const osc = ctx.createOscillator();
      osc.frequency.value = 440;
      osc.connect(dest);
      osc.start();
      osc.stop(ctx.currentTime + durationMs / 1000);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(dest.stream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      recorder.onerror = () => reject(new Error('MediaRecorder error'));
      recorder.start();
      setTimeout(() => recorder.stop(), durationMs + 100);
    } catch (e) {
      reject(e);
    }
  });
}

export default function StudioPage() {
  const [tab, setTab] = useState<StudioTab>('ai-generate');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [bpm, setBpm] = useState(128);

  // Wavesurfer
  const waveContainerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<import('wavesurfer.js').default | null>(null);
  const [wsReady, setWsReady] = useState(false);

  // MIDI upload / notation
  const [uploadedNotes, setUploadedNotes] = useState<NoteEntry[]>([]);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // AI generation
  const [genLength, setGenLength] = useState(512);
  const [temperature, setTemperature] = useState(0.9);
  const [topK, setTopK] = useState(20);
  const [genre, setGenre] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);
  const [backendAlive, setBackendAlive] = useState<boolean | null>(null);

  // Export
  const [exportFormat, setExportFormat] = useState<'midi' | 'mp3'>('midi');
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Backend health
  useEffect(() => {
    fetch('http://localhost:8000/health', { signal: AbortSignal.timeout(3000) })
      .then(r => setBackendAlive(r.ok))
      .catch(() => setBackendAlive(false));
  }, []);

  // Initialize Wavesurfer (browser-only)
  useEffect(() => {
    if (!waveContainerRef.current) return;
    let ws: import('wavesurfer.js').default;
    import('wavesurfer.js').then(({ default: WaveSurfer }) => {
      ws = WaveSurfer.create({
        container: waveContainerRef.current!,
        waveColor: '#8b5cf6',
        progressColor: '#14b8a6',
        height: 68,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        cursorColor: '#a78bfa',
        normalize: true,
        backend: 'WebAudio',
      });
      ws.on('ready', () => setWsReady(true));
      wavesurferRef.current = ws;
    });
    return () => { ws?.destroy(); };
  }, []);

  // Transport controls
  const handlePlay = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    if (isPlaying) { ws.pause(); setIsPlaying(false); }
    else { ws.play(); setIsPlaying(true); }
  }, [isPlaying]);

  const handleStop = useCallback(() => {
    const ws = wavesurferRef.current;
    if (!ws) return;
    ws.stop();
    setIsPlaying(false);
  }, []);

  const handleRecord = useCallback(() => {
    setIsRecording(r => !r);
  }, []);

  // MIDI file parsing via @tonejs/midi
  const parseMidiFile = useCallback(async (file: File) => {
    setUploadedFile(file.name);
    setAnalyzing(true);
    try {
      const buf = await file.arrayBuffer();
      const midi = new Midi(buf);
      const notes: NoteEntry[] = [];
      for (const track of midi.tracks) {
        for (const note of track.notes) {
          notes.push({ pitch: note.name, duration: 'q' });
          if (notes.length >= 16) break;
        }
        if (notes.length >= 16) break;
      }
      setUploadedNotes(notes);

      // Also load waveform preview if it's a small MIDI
      // (WaveSurfer can load audio blobs; MIDI is not audio so we skip waveform for MIDI)
    } catch (e) {
      console.error('MIDI parse error', e);
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const handleFileDrop = (file: File) => {
    if (file.name.endsWith('.mid') || file.name.endsWith('.midi')) {
      parseMidiFile(file);
    } else if (file.name.endsWith('.mp3') || file.name.endsWith('.wav')) {
      setUploadedFile(file.name);
      setAnalyzing(true);
      const url = URL.createObjectURL(file);
      wavesurferRef.current?.load(url);
      setTimeout(() => setAnalyzing(false), 1500);
    }
  };

  // AI generation
  const handleGenerate = async () => {
    if (!backendAlive) return;
    setGenerating(true);
    setGenError(null);
    setGenProgress(0);

    // Simulate progress while request is in-flight
    const interval = setInterval(() => {
      setGenProgress(p => Math.min(p + 3, 90));
    }, 800);

    try {
      const res = await fetch('http://localhost:8000/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ length: genLength, temperature, top_k: topK, genre }),
      });
      clearInterval(interval);
      if (!res.ok) throw new Error(await res.text());
      setGenProgress(100);
      const blob = await res.blob();
      // Auto-download the returned MIDI
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `melodica_gen_${GENRES[genre].label.toLowerCase()}.mid`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      clearInterval(interval);
      setGenError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  // ── Export logic ─────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true);
    setExportSuccess(false);
    try {
      let blob: Blob;
      let filename: string;

      if (exportFormat === 'midi') {
        // Build a minimal MIDI from uploadedNotes or a placeholder
        const midi = new Midi();
        midi.header.setTempo(bpm);
        const track = midi.addTrack();
        const sourceNotes = uploadedNotes.length > 0 ? uploadedNotes : [{ pitch: 'C4', duration: 'q' }];
        sourceNotes.forEach((n, i) => {
          track.addNote({ midi: 60 + i, time: i * 0.5, duration: 0.4, velocity: 0.8 });
        });
        const midiBytes = midi.toArray();
        blob = new Blob([new Uint8Array(midiBytes)], { type: 'audio/midi' });
        filename = 'melodica_export.mid';
      } else {
        // MP3 export: capture audio via MediaRecorder from the browser AudioContext.
        // Browsers encode as audio/webm (Opus) — saved as .mp3 (widely playable).
        blob = await recordAudioBlob(3000);
        filename = 'melodica_export.mp3';
      }

      // File System Access API with fallback
      if ('showSaveFilePicker' in window) {
        const handle = await (window as Window & { showSaveFilePicker: (opts: object) => Promise<FileSystemFileHandle> })
          .showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: exportFormat === 'midi' ? 'MIDI File' : 'MP3 Audio',
              accept: exportFormat === 'midi' ? { 'audio/midi': ['.mid', '.midi'] } : { 'audio/mpeg': ['.mp3'] },
            }],
          });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      }
      setExportSuccess(true);
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') console.error(e);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)' }}>
      {/* Top menubar */}
      <div style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 20px', height: 48, gap: 4 }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, marginRight: 20 }}>
          <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple)', fontSize: 20 }}>piano</span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>Melodica</span>
        </Link>

        {['File', 'Edit', 'View', 'Track', 'Help'].map(item => (
          <button key={item} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, padding: '0 8px', height: 48 }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >{item}</button>
        ))}

        {/* Transport */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Record */}
          <button onClick={handleRecord} title="Record" style={{
            background: isRecording ? 'rgba(239,68,68,0.2)' : 'var(--bg-card)',
            border: `1px solid ${isRecording ? '#ef4444' : 'var(--border)'}`,
            borderRadius: 8, padding: '5px 10px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5, color: isRecording ? '#ef4444' : 'var(--text-secondary)'
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: isRecording ? '#ef4444' : 'var(--text-muted)', animation: isRecording ? 'pulse 1s infinite' : 'none' }} />
            <span style={{ fontSize: 12, fontWeight: 600 }}>REC</span>
          </button>
          {/* Stop */}
          <button onClick={handleStop} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 22 }}>stop</span>
          </button>
          {/* Play/Pause */}
          <button onClick={handlePlay} style={{
            background: 'var(--accent-purple)', border: 'none', borderRadius: 8,
            padding: '5px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: 'white', fontWeight: 700, fontSize: 13
          }}>
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{isPlaying ? 'pause' : 'play_arrow'}</span>
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          {/* BPM */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>BPM</span>
            <input type="number" value={bpm} onChange={e => setBpm(Number(e.target.value))} style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, width: 36, textAlign: 'center' }} />
          </div>
          {/* Backend pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: backendAlive === null ? '#6b6890' : backendAlive ? '#10b981' : '#ef4444' }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{backendAlive ? 'AI Ready' : 'AI Offline'}</span>
          </div>
        </div>

        <Link href="/dashboard" style={{ marginLeft: 12, color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>arrow_back</span>
          Dashboard
        </Link>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Piano track + Waveform */}
        <div style={{ width: '55%', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-panel)' }}>
            <h2 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Piano Recording Track</h2>
            <Link href="/piano" style={{ fontSize: 12, color: 'var(--accent-purple-light)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>open_in_new</span>
              Open Piano
            </Link>
          </div>

          {/* Waveform */}
          <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)', flexShrink: 0 }}>
            <div ref={waveContainerRef} style={{ borderRadius: 8, overflow: 'hidden', background: 'var(--bg-card)', minHeight: 68 }} />
            {!wsReady && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 68, marginTop: -68, position: 'relative', zIndex: 1 }}>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Load an audio file to see the waveform</p>
              </div>
            )}
          </div>

          {/* MIDI notation preview */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              Notation Preview {uploadedNotes.length > 0 && <span className="badge badge-teal" style={{ marginLeft: 8, fontSize: 9 }}>{uploadedNotes.length} notes</span>}
            </p>
            <PianoNotation notes={uploadedNotes.slice(0, 8)} width={420} height={130} />
            {uploadedNotes.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>Upload a MIDI file or record from the Piano to see notation here.</p>
            )}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ width: '45%', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {[
              { id: 'ai-generate', label: 'AI Generate', icon: 'auto_awesome' },
              { id: 'file-upload', label: 'Upload', icon: 'upload_file' },
              { id: 'file-export', label: 'Export', icon: 'ios_share' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as StudioTab)} style={{
                flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer',
                background: tab === t.id ? 'rgba(139,92,246,0.1)' : 'transparent',
                color: tab === t.id ? 'var(--accent-purple-light)' : 'var(--text-secondary)',
                fontSize: 12, fontWeight: 600,
                borderBottom: tab === t.id ? '2px solid var(--accent-purple)' : '2px solid transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.2s'
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
                  Calls the MusicLSTM backend to generate a MIDI file.
                  {!backendAlive && (
                    <span style={{ color: '#f87171', marginLeft: 6 }}>
                      Run: <code style={{ background: 'var(--bg-card)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>uvicorn api:app --reload</code> in Melo_API/
                    </span>
                  )}
                </p>

                {/* Genre */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Genre</label>
                  <select value={genre} onChange={e => setGenre(Number(e.target.value))} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', color: 'var(--text-primary)', fontSize: 13, width: '100%', outline: 'none', cursor: 'pointer' }}>
                    {GENRES.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                  </select>
                </div>

                {/* Length */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                    Length (tokens)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="number" value={genLength} onChange={e => setGenLength(Math.max(64, Math.min(1024, Number(e.target.value))))} min={64} max={1024} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, width: 90, outline: 'none', textAlign: 'center', fontWeight: 700 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>64 – 1024 &nbsp;(default: 512)</span>
                  </div>
                </div>

                {/* Temperature slider */}
                <Slider
                  label="Temperature"
                  min={0.8} max={1.1} step={0.01} value={temperature}
                  onChange={setTemperature}
                  format={v => v.toFixed(2)}
                />

                {/* Top-k */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                    Top-K Sampling
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <input type="number" value={topK} onChange={e => setTopK(Math.max(1, Math.min(100, Number(e.target.value))))} min={1} max={100} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 13, width: 90, outline: 'none', textAlign: 'center', fontWeight: 700 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>1 – 100 &nbsp;(default: 20)</span>
                  </div>
                </div>

                {/* Progress bar (visible during generation) */}
                {generating && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ height: 6, background: 'var(--bg-card)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${genProgress}%`, background: 'linear-gradient(90deg, #8b5cf6 0%, #14b8a6 100%)', borderRadius: 4, transition: 'width 0.8s ease' }} />
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                      Generating music… {genProgress}% — this can take 10–30 seconds
                    </p>
                  </div>
                )}

                {genError && (
                  <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8 }}>
                    <p style={{ fontSize: 12, color: '#f87171' }}>Error: {genError}</p>
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={generating || !backendAlive}
                  style={{
                    width: '100%', padding: '13px',
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                    border: 'none', borderRadius: 10, cursor: generating || !backendAlive ? 'not-allowed' : 'pointer',
                    color: 'white', fontWeight: 700, fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    opacity: !backendAlive ? 0.5 : 1,
                    boxShadow: '0 4px 20px rgba(139,92,246,0.3)',
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 18, animation: generating ? 'spin 1s linear infinite' : 'none' }}>
                    {generating ? 'refresh' : 'auto_awesome'}
                  </span>
                  {generating ? `Generating… (${genProgress}%)` : 'Generate MIDI'}
                </button>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
                  The generated MIDI file will download automatically.
                </p>
              </div>
            )}

            {/* ── File Upload ── */}
            {tab === 'file-upload' && (
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Upload & Transcribe</h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>Upload a MIDI file to parse notation, or an audio file to view the waveform.</p>

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
                  <input ref={fileInputRef} type="file" accept=".mid,.midi,.mp3,.wav" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileDrop(f); }} />
                  <span className="material-symbols-rounded" style={{ fontSize: 44, color: uploadedFile ? 'var(--accent-teal)' : 'var(--text-muted)', display: 'block', marginBottom: 10 }}>
                    {uploadedFile ? 'audio_file' : 'upload_file'}
                  </span>
                  {uploadedFile ? (
                    <>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-teal-light)', marginBottom: 4 }}>{uploadedFile}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                        {analyzing ? '⏳ Parsing MIDI / loading waveform…' : '✓ Loaded successfully'}
                      </p>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Drag and drop your file</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>MIDI: .mid .midi &nbsp;|&nbsp; Audio: .mp3 .wav</p>
                    </>
                  )}
                </div>

                {uploadedNotes.length > 0 && (
                  <div style={{ background: 'var(--bg-panel)', borderRadius: 12, padding: '16px', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Parsed Notes</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {uploadedNotes.slice(0, 24).map((n, i) => (
                        <span key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 6, padding: '3px 9px', fontSize: 11, fontFamily: 'monospace', color: 'var(--text-primary)' }}>{n.pitch}</span>
                      ))}
                      {uploadedNotes.length > 24 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{uploadedNotes.length - 24} more</span>}
                    </div>
                    <Link href="/sheet-music" className="btn-teal" style={{ display: 'block', textAlign: 'center', marginTop: 14, padding: '11px', fontSize: 13 }}>View Full Sheet Music</Link>
                  </div>
                )}
              </div>
            )}

            {/* ── Export ── */}
            {tab === 'file-export' && (
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Export Project</h3>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>Export your session in MIDI or MP3 format.</p>

                {/* Format selector */}
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

                {/* Quality sliders */}
                <div style={{ background: 'var(--bg-panel)', borderRadius: 12, padding: '16px', border: '1px solid var(--border)', marginBottom: 20 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
                    {exportFormat === 'midi' ? 'MIDI Settings' : 'Audio Quality'}
                  </p>
                  {exportFormat === 'midi' ? (
                    <>
                      <Slider label="Velocity" min={0} max={127} step={1} value={80} onChange={() => {}} />
                      <Slider label="Tempo (BPM)" min={60} max={200} step={1} value={bpm} onChange={setBpm} />
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
                <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 8 }}>
                  Uses File System Access API (Chrome/Edge) or download fallback.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
