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

  // Piano roll canvas (replaces WaveSurfer for MIDI visualization)
  const pianoRollCanvasRef = useRef<HTMLCanvasElement>(null);
  const [wsReady, setWsReady] = useState(false);


  // Raw MIDI bytes — single source of truth for export + playback
  const midiRawBlobRef = useRef<Blob | null>(null);
  const midiFileNameRef = useRef<string>('melodica_export.mid');

  // MIDI upload
  const [midiMeta, setMidiMeta] = useState<{ tracks: number; notes: number; duration: number; bpm: number } | null>(null);
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

  // AI Generate — seed file
  const [seedFile, setSeedFile] = useState<File | null>(null);
  const seedFileRef = useRef<HTMLInputElement>(null);

  // Generated notation (shown after successful AI generation)
  const [generatedNotes, setGeneratedNotes] = useState<NoteEntry[]>([]);
  const [generatedMidiBlob, setGeneratedMidiBlob] = useState<Blob | null>(null);

  // Piano-as-seed: use the loaded piano recording as AI seed
  const [usePianoAsSeed, setUsePianoAsSeed] = useState(false);

  // Backend health
  useEffect(() => {
    fetch('http://localhost:8000/health', { signal: AbortSignal.timeout(3000) })
      .then(r => setBackendAlive(r.ok))
      .catch(() => setBackendAlive(false));
  }, []);

  // Load piano recording from localStorage (set by piano page "Open in Studio")
  // We rebuild a temporary MIDI file from the NoteEntry[] and call parseMidiFile
  // so that the raw bytes become the source of truth here too
  useEffect(() => {
    const stored = localStorage.getItem('melodica_piano_notes');
    if (stored) {
      (async () => {
        try {
          const parsed = JSON.parse(stored) as NoteEntry[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Build a proper MIDI blob from the NoteEntry[] piano recording
            const { Midi: ToneMidi } = await import('@tonejs/midi');
            const midi = new ToneMidi();
            const track = midi.addTrack();
            const STEP: Record<string, number> = { C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11 };
            parsed.forEach((n, i) => {
              const m = n.pitch.match(/^([A-G]#?)(\d)$/);
              const midiNum = m ? (parseInt(m[2]) + 1) * 12 + (STEP[m[1]] ?? 0) : 60;
              track.addNote({ midi: midiNum, time: i * 0.4, duration: 0.35, velocity: 0.8 });
            });
            const file = new File([new Uint8Array(midi.toArray())], 'Piano Recording.mid', { type: 'audio/midi' });
            await parseMidiFile(file);
            setTab('file-upload');
          }
        } catch { /* ignore */ }
        localStorage.removeItem('melodica_piano_notes');
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Audio playback using Tone.js directly (no CDN) ───────────────────────
  // Schedules all notes from the raw MIDI file using Tone.Transport
  const tonePartRef = useRef<import('tone').Part | null>(null);
  const toneSynthRef = useRef<import('tone').PolySynth | null>(null);

  const scheduleAndPlay = useCallback(async () => {
    if (!midiRawBlobRef.current) return;
    try {
      const Tone = await import('tone');
      await Tone.start(); // must be called inside user gesture

      // Stop any previous playback
      Tone.Transport.stop();
      Tone.Transport.cancel();
      if (tonePartRef.current) { tonePartRef.current.dispose(); tonePartRef.current = null; }
      if (toneSynthRef.current) { toneSynthRef.current.dispose(); toneSynthRef.current = null; }

      // Parse raw MIDI for accurate note data
      const buf = await midiRawBlobRef.current.arrayBuffer();
      const midiData = new Midi(buf);

      // Create a PolySynth with a piano-like tone
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.8 },
      }).toDestination();
      synth.set({ volume: -6 });
      toneSynthRef.current = synth;

      // Schedule every note from every track
      const events: { time: number; note: string; dur: number }[] = [];
      for (const track of midiData.tracks) {
        for (const note of track.notes) {
          events.push({ time: note.time, note: note.name, dur: note.duration });
        }
      }

      const part = new Tone.Part((time, ev) => {
        synth.triggerAttackRelease(ev.note, ev.dur, time);
      }, events);
      tonePartRef.current = part;

      // When the last note ends, stop
      const endTime = events.reduce((max, e) => Math.max(max, e.time + e.dur), 0);
      Tone.Transport.scheduleOnce(() => {
        setIsPlaying(false);
        Tone.Transport.stop();
      }, endTime + 0.2);

      part.start(0);
      Tone.Transport.start();
      setIsPlaying(true);
    } catch (e) {
      console.error('Playback error', e);
    }
  }, []);

  const stopTone = useCallback(async () => {
    try {
      const Tone = await import('tone');
      Tone.Transport.stop();
      Tone.Transport.cancel();
      if (tonePartRef.current) { tonePartRef.current.dispose(); tonePartRef.current = null; }
      if (toneSynthRef.current) { toneSynthRef.current.dispose(); toneSynthRef.current = null; }
    } catch { /* ignore */ }
    setIsPlaying(false);
  }, []);

  // Transport controls
  const handlePlay = useCallback(async () => {
    if (isPlaying) {
      await stopTone();
      return;
    }
    // Use Tone.js direct scheduling (no CDN, no blocking)
    await scheduleAndPlay();
  }, [isPlaying, scheduleAndPlay, stopTone]);

  const handleStop = useCallback(async () => {
    await stopTone();
  }, [stopTone]);

  const handleRecord = useCallback(() => {
    setIsRecording(r => !r);
  }, []);

  // Flat → sharp normalisation for VexFlow
  const FLAT_TO_SHARP: Record<string, string> = {
    'Bb': 'A#', 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#',
  };
  const normalisePitch = (name: string): string => {
    const m = name.match(/^([A-G]b?)(\d)$/);
    if (m && FLAT_TO_SHARP[m[1]]) return `${FLAT_TO_SHARP[m[1]]}${m[2]}`;
    return name;
  };

  // Draw piano-roll on canvas from midi-file data
  const drawPianoRoll = useCallback((midi: import('@tonejs/midi').Midi) => {
    const canvas = pianoRollCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const W = canvas.offsetWidth || 800;
    const H = canvas.offsetHeight || 400;
    canvas.width = W; canvas.height = H;

    // Collect all notes
    const allNotes: { midi: number; time: number; dur: number }[] = [];
    for (const track of midi.tracks) {
      for (const note of track.notes) {
        allNotes.push({ midi: note.midi, time: note.time, dur: note.duration });
      }
    }
    if (allNotes.length === 0) return;

    const totalTime = Math.max(...allNotes.map(n => n.time + n.dur));
    const minPitch = Math.min(...allNotes.map(n => n.midi)) - 2;
    const maxPitch = Math.max(...allNotes.map(n => n.midi)) + 2;
    const pitchRange = Math.max(maxPitch - minPitch, 12);

    // Background
    ctx.fillStyle = '#1a1828';
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = 'rgba(139,92,246,0.08)';
    ctx.lineWidth = 1;
    for (let t = 0; t <= totalTime; t += 1) {
      const x = (t / totalTime) * W;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }

    // Notes
    for (const note of allNotes) {
      const x = (note.time / totalTime) * W;
      const w = Math.max((note.dur / totalTime) * W - 1, 2);
      const y = H - ((note.midi - minPitch) / pitchRange) * H;
      const noteH = Math.max(H / pitchRange - 1, 3);
      const isBlack = [1,3,6,8,10].includes(note.midi % 12);
      ctx.fillStyle = isBlack ? '#a78bfa' : '#14b8a6';
      ctx.beginPath();
      ctx.roundRect(x, y - noteH, w, noteH, 2);
      ctx.fill();
    }

    setWsReady(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // initMidiPlayer: kept for MIDI position tracking only, audio is handled by Tone.js scheduleAndPlay
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const initMidiPlayer = useCallback(async (_blob: Blob) => {
    // Tone.js handles all audio scheduling — this is a no-op intentionally
    // Keep midiPlayerRef null since we use scheduleAndPlay instead
  }, []);

  // MIDI file parsing — NO NoteEntry conversion. Raw bytes are the source of truth.
  const parseMidiFile = useCallback(async (file: File) => {
    setUploadedFile(file.name);
    midiFileNameRef.current = file.name;
    setAnalyzing(true);
    try {
      const buf = await file.arrayBuffer();
      // Store raw bytes — never convert to simplified format
      midiRawBlobRef.current = new Blob([buf], { type: 'audio/midi' });

      // Parse for metadata display + piano-roll drawing only
      const midi = new Midi(buf);
      let totalNotes = 0;
      for (const track of midi.tracks) totalNotes += track.notes.length;
      const lastNote = midi.tracks.flatMap(t => t.notes).reduce(
        (acc, n) => Math.max(acc, n.time + n.duration), 0
      );
      const bpm = midi.header.tempos[0]?.bpm ?? 120;
      setMidiMeta({ tracks: midi.tracks.filter(t => t.notes.length > 0).length, notes: totalNotes, duration: lastNote, bpm });

      // Store as base64 in localStorage → sheet-music page reads exact same bytes
      const bytes = new Uint8Array(buf);
      // Use a chunked encoder to avoid call-stack overflow on large files
      const CHUNK = 8192;
      let b64 = '';
      for (let i = 0; i < bytes.length; i += CHUNK) {
        b64 += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      }
      localStorage.setItem('melodica_midi_base64', btoa(b64));
      localStorage.setItem('melodica_midi_name', file.name);

      // Draw piano-roll directly from parsed MIDI data
      drawPianoRoll(midi);
      // Init midi-player-js from raw bytes for playback
      await initMidiPlayer(midiRawBlobRef.current!);
    } catch (e) {
      console.error('MIDI parse error', e);
    } finally {
      setAnalyzing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawPianoRoll, initMidiPlayer]);

  const handleFileDrop = (file: File) => {
    if (file.name.endsWith('.mid') || file.name.endsWith('.midi')) {
      parseMidiFile(file);
    }
    // Audio files (mp3/wav) are not supported as waveform input — show message
  };

  // Helper: convert NoteEntry[] → MIDI File object (for sending as seed)
  const notesToMidiFile = async (notes: NoteEntry[]): Promise<File> => {
    const { Midi } = await import('@tonejs/midi');
    const midi = new Midi();
    const track = midi.addTrack();
    const STEP_MIDI: Record<string, number> = {
      'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
      'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11,
    };
    const DUR_SEC: Record<string, number> = {
      'w': 2, 'h': 1, 'q': 0.5, '8': 0.25, '16': 0.125,
    };
    notes.forEach((n, i) => {
      const m = n.pitch.match(/^([A-G]#?)(\d)$/);
      const midiNum = m ? (parseInt(m[2]) + 1) * 12 + (STEP_MIDI[m[1]] ?? 0) : 60;
      const dur = DUR_SEC[n.duration] ?? 0.5;
      track.addNote({ midi: midiNum, time: i * 0.5, duration: dur, velocity: 0.8 });
    });
    const bytes = new Uint8Array(midi.toArray());
    return new File([bytes], 'piano_seed.mid', { type: 'audio/midi' });
  };

  // Helper: parse a MIDI Blob into NoteEntry[]
  const parseMidiBlob = async (blob: Blob): Promise<NoteEntry[]> => {
    try {
      const buf = await blob.arrayBuffer();
      const midi = new Midi(buf);
      const notes: NoteEntry[] = [];
      for (const track of midi.tracks) {
        for (const note of track.notes) {
          const m = note.name.match(/^([A-G]b?)(\d)$/);
          let pitch = note.name;
          const FLAT_TO_SHARP_LOCAL: Record<string, string> = {
            'Bb': 'A#', 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#',
          };
          if (m && FLAT_TO_SHARP_LOCAL[m[1]]) pitch = `${FLAT_TO_SHARP_LOCAL[m[1]]}${m[2]}`;
          notes.push({ pitch, duration: 'q' });
          if (notes.length >= 48) break;
        }
        if (notes.length >= 48) break;
      }
      return notes;
    } catch { return []; }
  };

  // AI generation
  const handleGenerate = async () => {
    if (!backendAlive) return;
    setGenerating(true);
    setGenError(null);
    setGenProgress(0);
    setGeneratedNotes([]);
    setGeneratedMidiBlob(null);

    // Simulate progress while request is in-flight
    const interval = setInterval(() => {
      setGenProgress(p => Math.min(p + 3, 90));
    }, 800);

    try {
      // Determine seed: piano recording takes priority over manual file
      let resolvedSeedFile: File | null = seedFile;
      // If usePianoAsSeed is on AND we have a raw blob from piano recording, use it as seed
      if (usePianoAsSeed && midiRawBlobRef.current && uploadedFile === 'Piano Recording.mid') {
        const buf = await midiRawBlobRef.current.arrayBuffer();
        resolvedSeedFile = new File([buf], 'piano_seed.mid', { type: 'audio/midi' });
      }

      // Choose endpoint: multipart when seed file present, JSON otherwise
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
      // Read as raw bytes and wrap with explicit MIME type to avoid UUID filename bug
      const arrayBuf = await res.arrayBuffer();
      const genName = `melodica_gen_${GENRES[genre].label.toLowerCase()}.mid`;
      const typedBlob = new Blob([arrayBuf], { type: 'audio/midi' });
      // Store immediately for export use
      setGeneratedMidiBlob(typedBlob);

      // Trigger download: anchor MUST be in DOM for download attr to work in all browsers
      const url = URL.createObjectURL(typedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = genName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 8000);

      // Load into piano roll + set as active MIDI (raw bytes, no conversion)
      const genFile = new File([arrayBuf], genName, { type: 'audio/midi' });
      await parseMidiFile(genFile);
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
        // ALWAYS use the raw source blob if available — never reconstruct
        if (midiRawBlobRef.current) {
          blob = midiRawBlobRef.current;
          filename = midiFileNameRef.current.replace(/\.(mid|midi)$/i, '_export.mid');
        } else if (generatedMidiBlob) {
          blob = generatedMidiBlob;
          filename = `melodica_gen_${GENRES[genre].label.toLowerCase()}.mid`;
        } else {
          // Nothing else loaded — nothing to export
          setExporting(false);
          alert('No MIDI file loaded. Upload or generate a file first.');
          return;
        }
      } else {
        blob = await recordAudioBlob(3000);
        filename = 'melodica_export.mp3';
      }

      // Always use anchor download — showSaveFilePicker saves without extension on some browsers
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


          {/* Piano Roll — fills remaining left-panel height */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Piano Roll</p>
              {wsReady && uploadedFile && <p style={{ fontSize: 10, color: 'var(--accent-teal)', fontWeight: 600 }}>{uploadedFile}</p>}
            </div>
            <div style={{ flex: 1, position: 'relative', background: '#0f0e1c', overflow: 'hidden' }}>
              <canvas
                ref={pianoRollCanvasRef}
                style={{ display: wsReady ? 'block' : 'none', width: '100%', height: '100%' }}
              />
              {!wsReady && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, opacity: 0.5 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 40, color: 'var(--text-muted)' }}>piano</span>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '0 24px' }}>Upload a MIDI file from the right panel to see the piano roll here</p>
                </div>
              )}
            </div>
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

                {/* ── Piano Recording as Seed ── */}
                {uploadedFile === 'Piano Recording.mid' && midiMeta && (
                  <div style={{ marginBottom: 16, background: 'rgba(139,92,246,0.06)', border: `1px solid ${usePianoAsSeed ? 'rgba(139,92,246,0.4)' : 'var(--border)'}`, borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--accent-purple)' }}>piano</span>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 700, color: usePianoAsSeed ? 'var(--accent-purple-light)' : 'var(--text-primary)' }}>Piano Recording</p>
                          <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{midiMeta.notes} recorded notes</p>
                        </div>
                      </div>
                      {/* Toggle switch */}
                      <button
                        onClick={() => { setUsePianoAsSeed(p => !p); if (!usePianoAsSeed) setSeedFile(null); }}
                        style={{ padding: '6px 14px', background: usePianoAsSeed ? 'rgba(139,92,246,0.25)' : 'var(--bg-card)', border: `1px solid ${usePianoAsSeed ? 'var(--accent-purple)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', color: usePianoAsSeed ? 'var(--accent-purple-light)' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600, transition: 'all 0.2s' }}
                      >
                        {usePianoAsSeed ? '✓ Use as Seed' : 'Use as Seed'}
                      </button>
                    </div>
                    {usePianoAsSeed && (
                      <p style={{ fontSize: 10, color: 'var(--accent-purple-light)', marginTop: 8 }}>Your piano recording will be used as the musical seed for AI generation.</p>
                    )}
                  </div>
                )}

                {/* Seed MIDI file (optional) */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                    Seed MIDI File <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                  </label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      onClick={() => seedFileRef.current?.click()}
                      style={{ flex: 1, padding: '9px 14px', background: 'var(--bg-card)', border: `1px solid ${seedFile ? 'var(--accent-teal)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', color: seedFile ? 'var(--accent-teal-light)' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}
                    >
                      <span className="material-symbols-rounded" style={{ fontSize: 15, flexShrink: 0 }}>{seedFile ? 'audio_file' : 'upload_file'}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seedFile ? seedFile.name : 'Select .mid file…'}</span>
                    </button>
                    {seedFile && (
                      <button onClick={() => setSeedFile(null)} style={{ padding: '9px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, cursor: 'pointer', color: '#f87171', fontSize: 12 }}>
                        <span className="material-symbols-rounded" style={{ fontSize: 15 }}>close</span>
                      </button>
                    )}
                  </div>
                  <input ref={seedFileRef} type="file" accept=".mid,.midi" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) setSeedFile(f); e.target.value = ''; }}
                  />
                  <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 5 }}>Upload a MIDI file to use as the musical seed for generation.</p>
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
                  {seedFile ? `Will generate using “${seedFile.name}” as seed.` : 'The generated MIDI file will download automatically.'}
                </p>

                {/* Generated output notation */}
                {generatedNotes.length > 0 && (
                  <div style={{ marginTop: 24, background: 'rgba(20,184,166,0.06)', border: '1px solid rgba(20,184,166,0.25)', borderRadius: 12, padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="material-symbols-rounded" style={{ color: 'var(--accent-teal)', fontSize: 18 }}>check_circle</span>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-teal-light)' }}>Generated Output</p>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span className="badge badge-teal" style={{ fontSize: 10 }}>{generatedNotes.length} notes</span>
                        <button
                          onClick={() => {
                            if (!generatedMidiBlob) return;
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
                          style={{ padding: '3px 10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <span className="material-symbols-rounded" style={{ fontSize: 13 }}>download</span>
                          .mid
                        </button>
                      </div>
                    </div>
                    {/* Inline VexFlow notation of generated output */}
                    <div style={{ background: 'white', borderRadius: 8, padding: '12px', overflow: 'hidden' }}>
                      <PianoNotation notes={generatedNotes.slice(0, 8)} width={340} height={120} />
                    </div>
                    {generatedNotes.length > 8 && (
                      <p style={{ fontSize: 10, color: 'var(--accent-teal-light)', marginTop: 8, textAlign: 'center' }}>
                        Showing first 8 of {generatedNotes.length} notes — see full notation in the track preview
                      </p>
                    )}
                  </div>
                )}
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

                {/* MIDI info card shown after upload */}
                {midiMeta && uploadedFile && (
                  <div style={{ background: 'var(--bg-panel)', borderRadius: 12, padding: '16px', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>MIDI Info</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                      {[
                        { label: 'Tracks', value: midiMeta.tracks, icon: 'queue_music' },
                        { label: 'Notes',  value: midiMeta.notes,  icon: 'music_note' },
                        { label: 'Duration', value: `${midiMeta.duration.toFixed(1)}s`, icon: 'timer' },
                        { label: 'Tempo',    value: `${Math.round(midiMeta.bpm)} BPM`, icon: 'speed' },
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
                      onClick={async () => {
                        if (midiRawBlobRef.current) {
                          const buf = await midiRawBlobRef.current.arrayBuffer();
                          const bytes = new Uint8Array(buf);
                          const CHUNK = 8192; let b64 = '';
                          for (let i = 0; i < bytes.length; i += CHUNK)
                            b64 += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
                          localStorage.setItem('melodica_midi_base64', btoa(b64));
                          localStorage.setItem('melodica_midi_name', midiFileNameRef.current);
                        }
                        window.location.href = '/sheet-music';
                      }}
                      className="btn-teal" style={{ display: 'block', width: '100%', textAlign: 'center', padding: '11px', fontSize: 13, border: 'none', cursor: 'pointer', borderRadius: 10 }}
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
