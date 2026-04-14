'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { EditTool, SnapGrid } from './lib/types';

const MIN_LEFT_PCT = 25;
const MAX_LEFT_PCT = 85;
const COLLAPSED_RIGHT_W = 28; // px stub when collapsed
import { parseMidiToTimeline, appendMidiToTimeline, timelineToMidiBlob, storeMidiInLocalStorage } from './lib/midiIO';
import { useUndoRedo } from './hooks/useUndoRedo';
import { useTimelineState } from './hooks/useTimelineState';
import { useAudioEngine } from './hooks/useAudioEngine';
import TransportBar from './components/TransportBar';
import Toolbar from './components/Toolbar';
import PianoRollEditor from './components/PianoRollEditor';
import VelocityLane from './components/VelocityLane';
import RightPanel from './components/RightPanel';

export default function StudioPage() {
  // ── Core hooks ─────────────────────────────────────────────────────────
  const { pushCommand, undo, redo, canUndo, canRedo, clear: clearHistory } = useUndoRedo();
  const timeline = useTimelineState(pushCommand);
  const audio = useAudioEngine();

  // ── UI state ───────────────────────────────────────────────────────────
  const [tool, setTool] = useState<EditTool>('pencil');
  const [snapGrid, setSnapGrid] = useState<SnapGrid>('1/8');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isRecording, setIsRecording] = useState(false);
  const [backendAlive, setBackendAlive] = useState<boolean | null>(null);
  const [playheadSeconds, setPlayheadSeconds] = useState(0);

  // ── Backend health ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch('http://localhost:8000/health', { signal: AbortSignal.timeout(3000) })
      .then(r => setBackendAlive(r.ok))
      .catch(() => setBackendAlive(false));
  }, []);

  // ── Load piano recording from localStorage (from piano page) ──────────
  useEffect(() => {
    const stored = localStorage.getItem('melodica_piano_notes');
    if (stored) {
      (async () => {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const { Midi } = await import('@tonejs/midi');
            const midi = new Midi();
            const track = midi.addTrack();
            const STEP: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
            parsed.forEach((n: { pitch: string; duration: string }, i: number) => {
              const m = n.pitch.match(/^([A-G]#?)(\d)$/);
              const midiNum = m ? (parseInt(m[2]) + 1) * 12 + (STEP[m[1]] ?? 0) : 60;
              track.addNote({ midi: midiNum, time: i * 0.4, duration: 0.35, velocity: 0.8 });
            });
            const buf = new Uint8Array(midi.toArray()).buffer;
            const state = parseMidiToTimeline(buf);
            timeline.loadTimeline(state);
            storeMidiInLocalStorage(buf, 'Piano Recording.mid');
          }
        } catch { /* ignore */ }
        localStorage.removeItem('melodica_piano_notes');
      })();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load uploaded file from dashboard (New Project → Upload) ───────────
  useEffect(() => {
    const pending = localStorage.getItem('melodica_upload_pending');
    if (pending !== 'true') return;
    localStorage.removeItem('melodica_upload_pending');

    const b64 = localStorage.getItem('melodica_midi_base64');
    const name = localStorage.getItem('melodica_midi_name') ?? 'uploaded.mid';
    if (!b64) return;

    try {
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const buf = bytes.buffer;
      const state = parseMidiToTimeline(buf);
      clearHistory();
      timeline.loadTimeline(state);
      setPlayheadSeconds(0);
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Avoid interfering with input fields
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT') return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
      if (e.key === ' ') {
        e.preventDefault();
        handlePlayToggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.isPlaying, timeline.notes]);

  // ── Transport controls ─────────────────────────────────────────────────
  const handlePlayToggle = useCallback(async () => {
    if (audio.isPlaying) {
      await audio.pause();
    } else {
      await audio.play(
        timeline.notes,
        timeline.bpm,
        (seconds) => setPlayheadSeconds(seconds),
        () => setPlayheadSeconds(0),
      );
    }
  }, [audio, timeline.notes, timeline.bpm]);

  const handleStop = useCallback(async () => {
    await audio.stop();
    setPlayheadSeconds(0);
  }, [audio]);

  const handleRecord = useCallback(() => {
    setIsRecording(r => !r);
  }, []);

  // ── MIDI load from file ────────────────────────────────────────────────
  const handleLoadMidi = useCallback((buffer: ArrayBuffer, filename: string) => {
    const state = parseMidiToTimeline(buffer);
    clearHistory();
    timeline.loadTimeline(state);
    setSelectedIds(new Set());
    setPlayheadSeconds(0);
  }, [timeline, clearHistory]);

  // ── AI generation concatenation ────────────────────────────────────────
  const handleAppendGenerated = useCallback((buffer: ArrayBuffer) => {
    const currentState = timeline.getState();
    const merged = appendMidiToTimeline(currentState, buffer);
    timeline.loadTimeline(merged);
  }, [timeline]);

  // ── Export MIDI blob ───────────────────────────────────────────────────
  const handleExportMidi = useCallback((): Blob => {
    return timelineToMidiBlob(timeline.getState());
  }, [timeline]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)' }}>
      {/* Top transport bar */}
      <TransportBar
        isPlaying={audio.isPlaying}
        isRecording={isRecording}
        bpm={timeline.bpm}
        backendAlive={backendAlive}
        snapGrid={snapGrid}
        onSnapChange={setSnapGrid}
        onPlay={handlePlayToggle}
        onStop={handleStop}
        onRecord={handleRecord}
        onBpmChange={timeline.setBpm}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Piano Roll + Velocity Lane */}
        <div style={{ width: '55%', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>

          {/* Piano track header */}
          <div style={{
            padding: '10px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--bg-panel)',
          }}>
            <h2 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Piano Roll Editor
            </h2>
            <Link href="/piano" style={{ fontSize: 12, color: 'var(--accent-purple-light)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>open_in_new</span>
              Open Piano
            </Link>
          </div>

          {/* Toolbar */}
          <Toolbar
            tool={tool}
            onToolChange={setTool}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
          />

          {/* Piano Roll */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#12101f', overflow: 'hidden' }}>
            {timeline.notes.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: 0.5 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 40, color: 'var(--text-muted)' }}>piano</span>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '0 24px' }}>
                  Upload a MIDI file, generate with AI, or double-click to create notes
                </p>
              </div>
            ) : (
              <PianoRollEditor
                notes={timeline.notes}
                bpm={timeline.bpm}
                tool={tool}
                snapGrid={snapGrid}
                selectedIds={selectedIds}
                onSelectIds={setSelectedIds}
                onAddNote={timeline.addNote}
                onDeleteNote={timeline.deleteNote}
                onDeleteNotes={timeline.deleteNotes}
                onMoveNote={timeline.moveNote}
                onResizeNote={timeline.resizeNote}
                onBulkMove={timeline.bulkMove}
                onPreviewNote={audio.previewNote}
                playheadSeconds={playheadSeconds}
                isPlaying={audio.isPlaying}
              />
            )}
          </div>

          {/* Velocity Lane */}
          {timeline.notes.length > 0 && (
            <VelocityLane
              notes={timeline.notes}
              bpm={timeline.bpm}
              selectedIds={selectedIds}
              onSetVelocity={timeline.setNoteVelocity}
            />
          )}
        </div>

        {/* Right panel */}
        <RightPanel
          notes={timeline.notes}
          bpm={timeline.bpm}
          backendAlive={backendAlive}
          onLoadMidi={handleLoadMidi}
          onAppendGenerated={handleAppendGenerated}
          onExportMidi={handleExportMidi}
          recordAudioBlob={audio.recordAudioBlob}
        />
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
