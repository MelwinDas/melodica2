'use client';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
import RightPanel from './components/RightPanel';
import { createClient } from '../../lib/supabase';

function StudioPageContent() {
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
  const [isSaving, setIsSaving] = useState(false);

  const supabase = createClient();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('id');

  // ── Split Panel Resizing ─────────────────────────────────────────────
  const [leftWidthPct, setLeftWidthPct] = useState(55);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const isDraggingSplit = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingSplit.current) return;
      // Calculate new percentage based on mouse position
      const pct = (e.clientX / window.innerWidth) * 100;
      // Enforce bounds
      setLeftWidthPct(Math.min(Math.max(pct, MIN_LEFT_PCT), MAX_LEFT_PCT));
      if (rightPanelCollapsed) setRightPanelCollapsed(false);
    };
    const handleMouseUp = () => {
      if (isDraggingSplit.current) {
        isDraggingSplit.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        // Reset the background of the divider handle
        const divider = document.getElementById('studio-split-divider');
        if (divider) divider.style.background = 'var(--border)';
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [rightPanelCollapsed]);

  // ── Backend health ─────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/health`, { signal: AbortSignal.timeout(3000) })
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

  // ── MIDI load from file ────────────────────────────────────────────────
  const handleLoadMidi = useCallback((buffer: ArrayBuffer, filename: string) => {
    const state = parseMidiToTimeline(buffer);
    clearHistory();
    timeline.loadTimeline(state);
    setSelectedIds(new Set());
    setPlayheadSeconds(0);
  }, [timeline.loadTimeline, clearHistory]);

  const handleSave = useCallback(async () => {
    if (!projectId) {
      alert("No project ID found. Use the Dashboard to create or open a project first.");
      return;
    }
    setIsSaving(true);
    try {
      const blob = timelineToMidiBlob({
        notes: timeline.notes,
        bpm: timeline.bpm,
        timeSignature: timeline.timeSignature || [4, 4]
      });

      // Use a consistent filename based on projectId so that upsert: true actually overwrites the same file
      const fileName = `project_${projectId}.mid`;
      
      // Upload to Supabase Storage (Assumes 'projects' bucket exists)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('projects')
        .upload(fileName, blob, { upsert: true });

      if (uploadError) throw uploadError;

      // Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('projects')
        .getPublicUrl(fileName);

      // Update Database
      const { error: dbError } = await supabase
        .from('projects')
        .update({ 
          midi_url: publicUrl,
          bpm: Math.round(timeline.bpm),
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId);

      if (dbError) throw dbError;
      alert("Project saved successfully!");
    } catch (e: any) {
      console.error('Save error:', e);
      alert(`Error saving project: ${e.message || 'Check if "projects" bucket exists in Supabase Storage'}`);
    } finally {
      setIsSaving(false);
    }
  }, [projectId, timeline.notes, timeline.bpm, timeline.timeSignature, supabase]);

  // ── Load MIDI from URL (e.g. /studio?midi=/path/to.mid) ────────────────
  const midiParam = searchParams.get('midi');

  useEffect(() => {
    if (midiParam) {
      (async () => {
        try {
          const res = await fetch(midiParam);
          if (!res.ok) throw new Error('Failed to fetch MIDI');
          const buf = await res.arrayBuffer();
          handleLoadMidi(buf, midiParam.split('/').pop() || 'sample.mid');
        } catch (e) {
          console.error('Error loading MIDI from URL:', e);
        }
      })();
    }
  }, [midiParam, handleLoadMidi]);

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
        playheadSeconds
      );
    }
  }, [audio, timeline.notes, timeline.bpm, playheadSeconds]);

  const handleStop = useCallback(async () => {
    await audio.stop();
    setPlayheadSeconds(0);
  }, [audio]);

  const handleSeek = useCallback((seconds: number) => {
    setPlayheadSeconds(seconds);
    audio.seek(seconds);
  }, [audio]);

  const handleRecord = useCallback(() => {
    setIsRecording(r => !r);
  }, []);



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

  // ── View Sheet Music ───────────────────────────────────────────────────
  const handleViewSheetMusic = useCallback(async () => {
    if (timeline.notes.length === 0) return;
    try {
      const blob = handleExportMidi();
      const buf = await blob.arrayBuffer();
      const { storeMidiInLocalStorage } = await import('./lib/midiIO');
      storeMidiInLocalStorage(buf, 'studio_preview.mid');

      const params = new URLSearchParams();
      if (projectId) params.set('id', projectId);
      const midiUrl = searchParams.get('midi');
      if (midiUrl) params.set('midi', midiUrl);
      
      const qs = params.toString();
      window.open('/sheet-music' + (qs ? '?' + qs : ''), '_blank');
    } catch (e) {
      console.error(e);
    }
  }, [timeline.notes.length, handleExportMidi, projectId, searchParams]);

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
        onBpmChange={(b) => {
          timeline.setBpm(b);
          audio.setPlaybackBpm(b);
        }}
        onSave={projectId ? handleSave : undefined}
        isSaving={isSaving}
      />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Piano Roll + Velocity Lane */}
        <div style={{
          width: rightPanelCollapsed ? `calc(100% - ${COLLAPSED_RIGHT_W}px)` : `${leftWidthPct}%`,
          display: 'flex', flexDirection: 'column',
          transition: isDraggingSplit.current ? 'none' : 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>

          {/* Piano track header */}
          <div style={{
            padding: '10px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--bg-panel)',
          }}>
            <h2 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Piano Roll Editor
            </h2>
            <Link data-tour="open-piano-btn" href="/piano" style={{ fontSize: 12, color: 'var(--accent-purple-light)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
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
            onViewSheetMusic={handleViewSheetMusic}
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
                onSetPlayhead={handleSeek}
                isPlaying={audio.isPlaying}
                onSetVelocity={timeline.setNoteVelocity}
                generationBoundary={timeline.generationBoundary}
              />
            )}
          </div>
        </div>

        {/* Split Divider */}
        <div
          id="studio-split-divider"
          onMouseDown={() => {
            isDraggingSplit.current = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
          style={{
            width: 4,
            background: 'var(--border)',
            cursor: 'col-resize',
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s',
          }}
        >
          {/* Extended clickable area for resizing */}
          <div
            style={{ position: 'absolute', inset: '-2px -6px', cursor: 'col-resize', zIndex: 11 }}
            onMouseEnter={(e) => { e.currentTarget.parentElement!.style.background = 'var(--accent-purple)'; }}
            onMouseLeave={(e) => { if (!isDraggingSplit.current) e.currentTarget.parentElement!.style.background = 'var(--border)'; }}
          />

          <button
            onClick={(e) => {
              e.stopPropagation();
              setRightPanelCollapsed(!rightPanelCollapsed);
            }}
            style={{
              position: 'absolute',
              top: 20,
              left: -12,
              width: 24,
              height: 24,
              borderRadius: '50%',
              background: 'var(--bg-panel)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              zIndex: 20,
              boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
              color: 'var(--text-secondary)',
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>
              {rightPanelCollapsed ? 'keyboard_arrow_left' : 'keyboard_arrow_right'}
            </span>
          </button>
        </div>

        {/* Right panel */}
        <div style={{
          width: rightPanelCollapsed ? COLLAPSED_RIGHT_W : `calc(${100 - leftWidthPct}%)`,
          overflow: 'hidden',
          transition: isDraggingSplit.current ? 'none' : 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-panel)',
        }}>
          {!rightPanelCollapsed ? (
            <RightPanel
              notes={timeline.notes}
              bpm={timeline.bpm}
              backendAlive={backendAlive}
              onLoadMidi={handleLoadMidi}
              onAppendGenerated={handleAppendGenerated}
              onExportMidi={handleExportMidi}
              renderTimelineToAudio={audio.renderTimelineToAudio}
            />
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 60, opacity: 0.6 }}>
              <span style={{ writingMode: 'vertical-rl', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Options
              </span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}

export default function StudioPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <span className="material-symbols-rounded" style={{ fontSize: 36, color: 'var(--accent-purple)', animation: 'spin 1s linear infinite' }}>progress_activity</span>
      </div>
    }>
      <StudioPageContent />
    </Suspense>
  );
}
