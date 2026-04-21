'use client';
import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { usePianoEngine } from './hooks/usePianoEngine';
import PianoHeader from './components/PianoHeader';
import QuickEditSidebar from './components/QuickEditSidebar';

const SheetMusicStage = dynamic(() => import('./components/SheetMusicStage'), { ssr: false });
const VirtualPiano    = dynamic(() => import('./components/VirtualPiano'),    { ssr: false });

export default function PianoPage() {
  const engine = usePianoEngine();
  const [backendAlive, setBackendAlive] = useState<boolean | null>(null);
  const [pressedKeys,  setPressedKeys]  = useState<Set<string>>(new Set());

  // Backend health check
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/health`, { signal: AbortSignal.timeout(3000) })
      .then(r => setBackendAlive(r.ok))
      .catch(() => setBackendAlive(false));
  }, []);

  // ── Note handlers (also set pressed keys for visual feedback) ───────
  const handleNoteOn = useCallback((midi: number, velocity: number) => {
    engine.noteOn(midi, velocity);
    setPressedKeys(prev => new Set(prev).add(String(midi)));
  }, [engine]);

  const handleNoteOff = useCallback((midi: number) => {
    engine.noteOff(midi);
    setPressedKeys(prev => { const s = new Set(prev); s.delete(String(midi)); return s; });
  }, [engine]);

  // ── Sync QWERTY visual highlights ───────────────────────────────────
  useEffect(() => {
    const QWERTY: Record<string, number> = {
      'a':0,'w':1,'s':2,'e':3,'d':4,'f':5,'t':6,'g':7,'y':8,'h':9,'u':10,'j':11,'k':12,'o':13,'l':14,
    };
    const baseOct = 4;
    const pressedCodes = new Map<string, number>();

    const onDown = (e: KeyboardEvent) => {
      if (['INPUT','SELECT','TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      const key = e.key.toLowerCase();
      if (pressedCodes.has(key)) return;
      const semi = QWERTY[key];
      if (semi !== undefined) {
        const capsOn = e.getModifierState('CapsLock');
        const oct = capsOn ? 2 : baseOct;
        const midi = semi + (oct + 1) * 12;
        pressedCodes.set(key, midi);
        setPressedKeys(prev => new Set(prev).add(String(midi)));
      }
    };
    const onUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const midi = pressedCodes.get(key);
      if (midi !== undefined) {
        setPressedKeys(prev => { const s = new Set(prev); s.delete(String(midi)); return s; });
        pressedCodes.delete(key);
      }
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup',   onUp);
    return () => { window.removeEventListener('keydown', onDown); window.removeEventListener('keyup', onUp); };
  }, []);

  // ── Spacebar = Play/Pause ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT','SELECT','TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === ' ') {
        e.preventDefault();
        if (engine.isPlaying)     engine.pause();
        else if (engine.tracks.length > 0) engine.playAllTracks();
        else                       engine.play();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [engine]);

  // ── Play All / Pause toggle ──────────────────────────────────────────
  const handlePlayAll = useCallback(() => {
    if (engine.isPlaying) { engine.pause(); return; }
    if (engine.tracks.length > 0) { engine.playAllTracks(); return; }
    engine.play();
  }, [engine]);

  // ── Open in Studio ───────────────────────────────────────────────────
  const handleOpenStudio = useCallback(async () => {
    const allNotes = engine.tracks.flat();
    if (allNotes.length > 0) {
      const blob = await engine.exportMidiBlob();
      const buf  = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const CHUNK = 8192; let b64 = '';
      for (let i = 0; i < bytes.length; i += CHUNK)
        b64 += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
      localStorage.setItem('melodica_midi_base64',  btoa(b64));
      localStorage.setItem('melodica_midi_name',    'Piano Recording.mid');
      localStorage.setItem('melodica_upload_pending','true');
    }
    window.location.href = '/studio';
  }, [engine]);

  // ── Count-in overlay ─────────────────────────────────────────────────
  const countInOverlay = engine.countInActive && (
    <div className="count-in-overlay">
      <div className="count-in-number">{engine.countInBeat || '…'}</div>
    </div>
  );

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      {countInOverlay}

      {/* ── GLOBAL HEADER ──────────────────────────────────────────── */}
      <PianoHeader
        isPlaying={engine.isPlaying}
        isRecording={engine.isRecording}
        recordingPaused={engine.recordingPaused}
        position={engine.position}
        bpm={engine.bpm}
        timeSignature={engine.timeSignature}
        metronomeEnabled={engine.metronomeEnabled}
        metronomeFlash={engine.metronomeFlash}
        backendAlive={backendAlive}
        trackCount={engine.tracks.length}
        onRecord={engine.startRecording}
        onPauseRecord={engine.pauseRecording}
        onResumeRecord={engine.resumeRecording}
        onStopRecord={engine.stopRecording}
        onPlayAll={handlePlayAll}
        onStop={engine.stop}
        onBpmChange={engine.setBpm}
        onTimeSignatureChange={engine.setTimeSignature}
        onMetronomeToggle={engine.toggleMetronome}
        onOpenStudio={handleOpenStudio}
      />

      {/* ── MIDDLE BODY ────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT SIDEBAR — hidden on mobile */}
        <div className="hide-mobile">
        <QuickEditSidebar
          quantize={engine.quantize}
          countIn={engine.countIn}
          countInActive={engine.countInActive}
          countInBeat={engine.countInBeat}
          lastVelocity={engine.lastVelocity}
          trackCount={engine.tracks.length}
          allNoteCount={engine.allNoteCount}
          onQuantizeChange={engine.setQuantize}
          onCountInChange={engine.setCountIn}
          onTrimSilence={engine.trimSilence}
          onClearAll={engine.clearAllTracks}
        />
        </div>

        {/* MAIN STAGE */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 'clamp(6px, 2vw, 12px) clamp(6px, 2vw, 16px)', gap: 'clamp(6px, 1.5vw, 12px)', overflow: 'hidden' }}>

          {/* Sheet Music — take all available flex-1 space and scroll internally */}
          <div data-tour="sheet-music-stage" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <SheetMusicStage
              tracks={engine.tracks}
              liveNotes={engine.liveNotes}
              playheadSeconds={engine.playheadSeconds}
              isPlaying={engine.isPlaying}
              isRecording={engine.isRecording}
              bpm={engine.bpm}
              timeSignature={engine.timeSignature}
              quantize={engine.quantize}
              onSeek={engine.seek}
            />
          </div>

          {/* Virtual Piano — fixed to bottom, doesn't shrink natively */}
          <div style={{ flexShrink: 0, width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
            <VirtualPiano
              pressedKeys={pressedKeys}
              onNoteOn={handleNoteOn}
              onNoteOff={handleNoteOff}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
