'use client';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
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
  const pathname = usePathname();
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('My Piano Recording');
  const [creationError, setCreationError] = useState('');

  const supabase = createClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get('id');

  // ── Split Panel Resizing ─────────────────────────────────────────────
  const [leftWidthPct, setLeftWidthPct] = useState(55);
  // Start uncollapsed (SSR-safe). Collapse on mobile after hydration.
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

  useEffect(() => {
    if (window.innerWidth < 768) setRightPanelCollapsed(true);
  }, []);
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

  // ── Backend health (with polling for cold-start / model loading) ───────
  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const checkHealth = () => {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/health`, { signal: AbortSignal.timeout(5000) })
        .then(r => {
          if (cancelled) return;
          setBackendAlive(r.ok);
          // Stop polling once backend is alive
          if (r.ok && intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
        })
        .catch(() => {
          if (!cancelled) setBackendAlive(false);
        });
    };

    checkHealth();
    // Poll every 15s while backend is not yet alive
    intervalId = setInterval(() => {
      checkHealth();
    }, 15000);

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
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

  const handleSave = useCallback(async (forcedId?: string | any) => {
    // If called via onClick, forcedId might be the React SyntheticEvent object.
    // We only want to use it if it's a genuine string ID.
    const cleanId = typeof forcedId === 'string' ? forcedId : null;
    const idToSave = cleanId || projectId;

    if (!idToSave) {
      setShowCreateModal(true);
      return;
    }
    
    setIsSaving(true);
    try {
      // 1. Check Auth Session
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error("Your session has expired. Please log in again.");
      }

      // 2. Generate MIDI Blob from timeline
      const blob = timelineToMidiBlob({
        notes: timeline.notes,
        bpm: timeline.bpm,
        timeSignature: timeline.timeSignature || [4, 4]
      });

      // 3. Upload to Storage (Using the targeted ID)
      const fileName = `project_${idToSave}.mid`;
      
      const { error: uploadError } = await supabase.storage
        .from('projects')
        .upload(fileName, blob, { upsert: true });

      if (uploadError) {
        console.error('Storage upload failed:', uploadError);
        throw new Error(`Failed to upload MIDI data: ${uploadError.message}`);
      }

      // 4. Get the stable Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('projects')
        .getPublicUrl(fileName);

      const finalUrl = `${publicUrl}?v=${Date.now()}`;

      // 5. Update Project Record in DB
      const { error: dbError } = await supabase
        .from('projects')
        .update({ 
          midi_url: finalUrl,
          bpm: Math.round(timeline.bpm),
          updated_at: new Date().toISOString()
        })
        .eq('id', idToSave);

      if (dbError) {
        console.error('Database update failed:', dbError);
        throw new Error(`Failed to update project data: ${dbError.message}`);
      }

      alert("Project saved successfully!");
    } catch (e: any) {
      console.error('CRITICAL SAVE FAILURE:', e);
      alert(`Save Error: ${e.message || 'Unknown error occurred.'}`);
    } finally {
      setIsSaving(true);
      setTimeout(() => setIsSaving(false), 500);
    }
  }, [projectId, timeline.notes, timeline.bpm, timeline.timeSignature, supabase]);

  const handleConfirmCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    
    setCreationError('');
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // 1. Get or Create 'Recording' folder
      let targetFolderId = null;
      const { data: existingFolders } = await supabase
        .from('folders')
        .select('id')
        .eq('name', 'Recording')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingFolders) {
        targetFolderId = existingFolders.id;
      } else {
        const { data: newFolder, error: folderErr } = await supabase
          .from('folders')
          .insert({ name: 'Recording', user_id: user.id })
          .select()
          .single();
        if (!folderErr && newFolder) {
          targetFolderId = newFolder.id;
        }
      }

      // 2. Create the project record
      const { data, error } = await supabase.from('projects').insert({
        name: newProjectName.trim(),
        user_id: user.id,
        folder_id: targetFolderId,
        bpm: Math.round(timeline.bpm),
        updated_at: new Date().toISOString()
      }).select().single();

      if (error) throw error;
      if (!data) throw new Error("Failed to create project record");

      // 3. Close modal
      setShowCreateModal(false);

      // 4. Update URL without refreshing
      const params = new URLSearchParams(searchParams.toString());
      params.set('id', data.id);
      router.replace(`${pathname}?${params.toString()}`);

      // 5. Trigger the actual save (upload MIDI) using the new ID
      await handleSave(data.id);
    } catch (err: any) {
      setCreationError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

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

  // ── Project Metadata & MIDI Loading ────────────────────────────────────
  const midiQueryParam = searchParams.get('midi');

  useEffect(() => {
    if (!projectId) return;

    const loadProjectData = async () => {
      try {
        // 1. Fetch project record to get the ground-truth MIDI URL
        const { data: project, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();

        if (error) throw error;

        // 2. Decide which MIDI to load
        // We prefer the DB URL if it exists, otherwise fallback to query param
        const finalMidiUrl = project?.midi_url || midiQueryParam;

        if (finalMidiUrl) {
          const res = await fetch(finalMidiUrl);
          if (!res.ok) throw new Error('Failed to fetch MIDI file');
          
          const buf = await res.arrayBuffer();
          // Avoid reloading the same data if we are already in sync (basic check)
          handleLoadMidi(buf, finalMidiUrl.split('/').pop() || 'project.mid');
        }
      } catch (err) {
        console.error('Error loading project metadata or MIDI:', err);
      }
    };

    loadProjectData();
  }, [projectId, midiQueryParam, handleLoadMidi, supabase]);

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
        onSave={handleSave}
        isSaving={isSaving}
      />

      <div className="studio-content-area" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Piano Roll + Velocity Lane */}
        <div className="studio-left-panel" style={{
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
          className="studio-split-divider"
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
        <div className={`studio-right-panel ${!rightPanelCollapsed ? 'open' : ''}`} style={{
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

      {/* Create Project Modal */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 400, padding: 'clamp(20px, 4vw, 32px)', margin: '0 16px', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>Save Your Work</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>Give your new project a name to save it to your dashboard.</p>
            
            <form onSubmit={handleConfirmCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Project Name</label>
                <input 
                  autoFocus
                  style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', color: 'white', fontSize: 14, outline: 'none' }}
                  placeholder="e.g. Moonlight Sonata Remix"
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                />
              </div>

              {creationError && <p style={{ color: '#f87171', fontSize: 12 }}>{creationError}</p>}

              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)}
                  style={{ flex: 1, padding: '12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving || !newProjectName.trim()}
                  style={{ 
                    flex: 1, padding: '12px', background: 'var(--accent-purple)', border: 'none', borderRadius: 10, cursor: 'pointer', color: 'white', fontSize: 13, fontWeight: 700,
                    opacity: (isSaving || !newProjectName.trim()) ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 
                  }}
                >
                  {isSaving ? (
                     <span className="material-symbols-rounded" style={{ fontSize: 18, animation: 'spin 1s linear infinite' }}>sync</span>
                  ) : (
                    <span className="material-symbols-rounded" style={{ fontSize: 18 }}>save</span>
                  )}
                  {isSaving ? 'Creating...' : 'Save & Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
        @keyframes spin { to{transform:rotate(360deg)} }

        /* Mobile overrides for studio layout */
        @media (max-width: 768px) {
          .studio-left-panel {
            width: 100% !important;
          }
          .studio-right-panel {
            position: fixed !important;
            top: 56px !important;
            bottom: 64px !important;
            right: 0 !important;
            width: 300px !important;
            max-width: 85vw !important;
            z-index: 250 !important;
            transform: translateX(100%);
            transition: transform 0.3s ease !important;
            box-shadow: -5px 0 25px rgba(0,0,0,0.5) !important;
            border-left: 1px solid var(--border) !important;
          }
          .studio-right-panel.open {
            transform: translateX(0);
          }
          .studio-split-divider {
            position: fixed !important;
            bottom: 80px !important;
            right: 16px !important;
            width: 48px !important;
            height: 48px !important;
            border-radius: 50% !important;
            background: var(--accent-purple) !important;
            z-index: 260 !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
            cursor: pointer !important;
          }
          .studio-split-divider > div { display: none !important; }
          .studio-split-divider button {
            position: relative !important;
            top: 0 !important; left: 0 !important;
            width: 100% !important; height: 100% !important;
            background: transparent !important;
            border: none !important;
            color: white !important;
            box-shadow: none !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
          }
        }
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
