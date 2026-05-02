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
  const [showSidebar,  setShowSidebar]  = useState(false);

  // Backend health check
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/health`, { signal: AbortSignal.timeout(3000) })
      .then(r => setBackendAlive(r.ok))
      .catch(() => setBackendAlive(false));
  }, []);

  // [FIX #2] Note handlers for VirtualPiano (mouse/touch) — visual feedback
  // comes from engine.pressedMidiKeys now, so no duplicate key listeners needed.
  const handleNoteOn = useCallback((midi: number, velocity: number) => {
    engine.noteOn(midi, velocity);
  }, [engine.noteOn]);

  const handleNoteOff = useCallback((midi: number) => {
    engine.noteOff(midi);
  }, [engine.noteOff]);

  // [FIX #2] Removed the duplicate QWERTY keyboard listener that was in page.tsx.
  // The engine hook (usePianoEngine.ts) is now the single source of keyboard input.

  // ── Spacebar = Play/Pause ────────────────────────────────────────────
  // [FIX #6] Depend on stable refs instead of the entire engine object
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
  }, [engine.isPlaying, engine.tracks.length, engine.pause, engine.playAllTracks, engine.play]);

  // ── Play All / Pause toggle ──────────────────────────────────────────
  const handlePlayAll = useCallback(() => {
    if (engine.isPlaying) { engine.pause(); return; }
    if (engine.tracks.length > 0) { engine.playAllTracks(); return; }
    engine.play();
  }, [engine.isPlaying, engine.tracks.length, engine.pause, engine.playAllTracks, engine.play]);

  // [FIX #7] Open in Studio — use chunked base64 encoding without spread operator
  // to avoid exceeding the JS engine's maximum argument limit on large MIDI files.
  const handleOpenStudio = useCallback(async () => {
    const allNotes = engine.tracks.flat();
    if (allNotes.length > 0) {
      const blob = await engine.exportMidiBlob();
      const buf  = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);

      // Build base64 without spread operator to avoid stack overflow on large files
      const CHUNK = 8192;
      const chunks: string[] = [];
      for (let i = 0; i < bytes.length; i += CHUNK) {
        const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
        // Use Array.from to avoid spread on TypedArray which can hit arg limits
        chunks.push(String.fromCharCode.apply(null, Array.from(slice)));
      }
      const b64 = btoa(chunks.join(''));
      localStorage.setItem('melodica_midi_base64',  b64);
      localStorage.setItem('melodica_midi_name',    'Piano Recording.mid');
      localStorage.setItem('melodica_upload_pending','true');
    }
    window.location.href = '/studio';
  }, [engine.tracks, engine.exportMidiBlob]);

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
        onToggleSidebar={() => setShowSidebar(s => !s)}
      />

      {/* ── MIDDLE BODY ────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        
        {/* Mobile Sidebar Overlay */}
        <div 
          className={`mobile-drawer-overlay ${showSidebar ? 'open' : ''}`} 
          onClick={() => setShowSidebar(false)} 
        />

        {/* LEFT SIDEBAR */}
        <div className={`piano-sidebar ${showSidebar ? 'open' : ''}`}>
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
              pressedKeys={engine.pressedMidiKeys}
              onNoteOn={handleNoteOn}
              onNoteOff={handleNoteOff}
            />
          </div>
        </main>
      </div>

      <style>{`
        /* Mobile overrides for piano sidebar */
        .piano-sidebar {
          display: block;
        }
        @media (max-width: 768px) {
          .piano-sidebar {
            position: fixed;
            top: 56px; /* below header */
            bottom: 0;
            left: 0;
            z-index: 300;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            background: var(--bg-secondary);
            border-right: 1px solid var(--border);
            box-shadow: 5px 0 25px rgba(0,0,0,0.5);
          }
          .piano-sidebar.open {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
