'use client';
import { useRef, useEffect, useCallback, useState } from 'react';
import {
  TimelineNote, EditTool, SnapGrid,
  KEY_W, RULER_H, ROW_H, PX_PER_BEAT,
  NOTE_NAMES, isBlackKey, midiToNoteName,
  snapTimeToGrid, snapDurationToGrid, generateNoteId,
  DEFAULT_VELOCITY,
} from '../lib/types';
import VelocityLane from './VelocityLane';

interface Props {
  notes: TimelineNote[];
  bpm: number;
  tool: EditTool;
  snapGrid: SnapGrid;
  selectedIds: Set<string>;
  onSelectIds: (ids: Set<string>) => void;
  onAddNote: (note: Omit<TimelineNote, 'id'>) => void;
  onDeleteNote: (id: string) => void;
  onDeleteNotes: (ids: Set<string>) => void;
  onMoveNote: (id: string, midi: number, time: number) => void;
  onResizeNote: (id: string, duration: number) => void;
  onBulkMove: (ids: Set<string>, deltaMidi: number, deltaTime: number) => void;
  onPreviewNote: (midi: number) => void;
  playheadSeconds: number;
  isPlaying: boolean;
  onSetPlayhead?: (seconds: number) => void;
  onSetVelocity?: (id: string, velocity: number) => void;
  generationBoundary?: number;
}

const MIN_PITCH = 21;   // A0
const MAX_PITCH = 108;  // C8
const PITCH_RANGE = MAX_PITCH - MIN_PITCH + 1;
const EDGE_GRAB_PX = 8;

type DragMode = 'none' | 'move' | 'resize' | 'marquee' | 'scrub';

interface DragState {
  mode: DragMode;
  noteId?: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  origMidi?: number;
  origTime?: number;
  origDuration?: number;
}

export default function PianoRollEditor({
  notes, bpm, tool, snapGrid, selectedIds, onSelectIds,
  onAddNote, onDeleteNote, onDeleteNotes, onMoveNote, onResizeNote,
  onBulkMove, onPreviewNote, playheadSeconds, isPlaying, onSetPlayhead, onSetVelocity,
  generationBoundary
}: Props) {
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const keysCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);
  const keysScrollRef = useRef<HTMLDivElement>(null);
  const velocityScrollRef = useRef<HTMLDivElement>(null);

  const dragRef = useRef<DragState>({ mode: 'none', startX: 0, startY: 0, currentX: 0, currentY: 0 });
  const [isDragging, setIsDragging] = useState(false);
  
  const lastTapTime = useRef<number>(0);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const secPerBeat = 60 / bpm;

  // Calculate canvas dimensions
  const endTime = notes.length > 0
    ? Math.max(...notes.map(n => n.time + n.duration))
    : 0;
  const totalBeats = Math.max(Math.ceil(endTime / secPerBeat) + 16, 32);
  const canvasH = RULER_H + PITCH_RANGE * ROW_H;
  const gridW = totalBeats * PX_PER_BEAT;

  // Position helpers
  const timeToX = useCallback((t: number) => (t / secPerBeat) * PX_PER_BEAT, [secPerBeat]);
  const xToTime = useCallback((x: number) => (x / PX_PER_BEAT) * secPerBeat, [secPerBeat]);
  const midiToY = useCallback((midi: number) => RULER_H + (MAX_PITCH - midi) * ROW_H, []);
  const yToMidi = useCallback((y: number) => MAX_PITCH - Math.floor((y - RULER_H) / ROW_H), []);

  // Hit test: find note at canvas coords
  const hitTest = useCallback((x: number, y: number): { noteId: string; edge: boolean } | null => {
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      const nx = timeToX(n.time);
      const ny = midiToY(n.midi);
      const nw = Math.max(timeToX(n.time + n.duration) - nx, 3);
      if (x >= nx && x <= nx + nw && y >= ny && y < ny + ROW_H) {
        // Only allow edge dragging if note is at least 8px wide, and limit edge to 40% of the note width max.
        const edgeThreshold = Math.min(EDGE_GRAB_PX, nw * 0.4);
        const edge = nw >= 8 && x >= nx + nw - edgeThreshold;
        return { noteId: n.id, edge };
      }
    }
    return null;
  }, [notes, timeToX, midiToY]);

  // ── Draw piano keys ──────────────────────────────────────────────────
  const drawKeys = useCallback(() => {
    const canvas = keysCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = KEY_W;
    canvas.height = canvasH;

    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(0, 0, KEY_W, canvasH);

    // Ruler corner
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, KEY_W, RULER_H);
    ctx.fillStyle = 'rgba(180,160,255,0.55)';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('KEYS', KEY_W / 2, RULER_H / 2);

    // Draw keys
    for (let pass = 0; pass < 2; pass++) {
      for (let p = MAX_PITCH; p >= MIN_PITCH; p--) {
        const black = isBlackKey(p);
        if (pass === 0 && black) continue;
        if (pass === 1 && !black) continue;

        const y = RULER_H + (MAX_PITCH - p) * ROW_H;
        const noteName = NOTE_NAMES[p % 12];
        const octave = Math.floor(p / 12) - 1;
        const isC = noteName === 'C';
        const hasNote = notes.some(n => n.midi === p);

        if (!black) {
          ctx.fillStyle = hasNote ? '#b8f5e0' : '#f0f0f0';
          ctx.fillRect(1, y, KEY_W - 2, ROW_H - 1);
          ctx.strokeStyle = isC ? '#555555' : '#cccccc';
          ctx.lineWidth = isC ? 1.5 : 0.5;
          ctx.beginPath();
          ctx.moveTo(1, y + ROW_H - 0.5);
          ctx.lineTo(KEY_W - 1, y + ROW_H - 0.5);
          ctx.stroke();
          ctx.fillStyle = isC ? '#7c3aed' : '#777';
          ctx.font = `bold ${Math.min(ROW_H - 3, 10)}px sans-serif`;
          ctx.textAlign = 'right';
          ctx.textBaseline = 'middle';
          ctx.fillText(isC ? `C${octave}` : noteName, KEY_W - 4, y + ROW_H / 2);
        } else {
          ctx.fillStyle = hasNote ? '#1a6b50' : '#1a1a1a';
          ctx.fillRect(1, y, KEY_W * 0.62, ROW_H);
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(1, y, KEY_W * 0.62, 2);
          if (ROW_H >= 10) {
            ctx.fillStyle = hasNote ? '#7fffd4' : '#888888';
            ctx.font = `${Math.min(ROW_H - 4, 8)}px sans-serif`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(noteName, KEY_W * 0.62 - 2, y + ROW_H / 2);
          }
        }
      }
    }

    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(KEY_W - 1, RULER_H);
    ctx.lineTo(KEY_W - 1, canvasH);
    ctx.stroke();
  }, [canvasH, notes]);

  // ── Draw grid + notes ────────────────────────────────────────────────
  const drawGrid = useCallback(() => {
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = gridW;
    canvas.height = canvasH;

    // Row backgrounds
    for (let p = MAX_PITCH; p >= MIN_PITCH; p--) {
      const rowIdx = MAX_PITCH - p;
      const y = RULER_H + rowIdx * ROW_H;
      const isC = (p % 12) === 0;
      ctx.fillStyle = isBlackKey(p) ? '#232535' : isC ? '#2c2f42' : '#282b3a';
      ctx.fillRect(0, y, gridW, ROW_H);
      if (!isBlackKey(p)) {
        ctx.strokeStyle = isC ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(0, y + ROW_H - 0.5);
        ctx.lineTo(gridW, y + ROW_H - 0.5);
        ctx.stroke();
      }
    }

    // Ruler background
    ctx.fillStyle = '#181a27';
    ctx.fillRect(0, 0, gridW, RULER_H);
    ctx.strokeStyle = 'rgba(139,92,246,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, RULER_H); ctx.lineTo(gridW, RULER_H); ctx.stroke();

    // Beat/bar grid lines
    const beatsPerBar = 4;
    for (let beat = 0; beat <= totalBeats; beat++) {
      const x = beat * PX_PER_BEAT;
      const isBarStart = beat % beatsPerBar === 0;
      const barNum = Math.floor(beat / beatsPerBar) + 1;
      const beatInBar = beat % beatsPerBar;

      ctx.strokeStyle = isBarStart ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)';
      ctx.lineWidth = isBarStart ? 1 : 0.5;
      ctx.beginPath(); ctx.moveTo(x, RULER_H); ctx.lineTo(x, canvasH); ctx.stroke();

      if (isBarStart) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, 4); ctx.lineTo(x, RULER_H); ctx.stroke();
        ctx.fillStyle = '#e0e0e0';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(barNum), x + 4, RULER_H / 2);
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(x, RULER_H * 0.55); ctx.lineTo(x, RULER_H); ctx.stroke();
        ctx.fillStyle = 'rgba(180,180,200,0.45)';
        ctx.font = '8px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`.${beatInBar + 1}`, x + 2, RULER_H * 0.75);
      }
    }

    // Sub-beat lines
    for (let sb = 0; sb <= totalBeats * 4; sb++) {
      if (sb % 4 === 0) continue;
      const x = (sb / 4) * PX_PER_BEAT;
      ctx.strokeStyle = 'rgba(255,255,255,0.025)';
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(x, RULER_H); ctx.lineTo(x, canvasH); ctx.stroke();
    }

    // Generation Boundary
    if (generationBoundary !== undefined) {
      const bx = timeToX(generationBoundary);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)'; // amber
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(bx, RULER_H);
      ctx.lineTo(bx, canvasH);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Label
      ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
      ctx.beginPath();
      ctx.roundRect(bx - 35, 4, 70, 14, [4,4,4,4]);
      ctx.fill();
      
      ctx.fillStyle = '#111';
      ctx.font = 'bold 8px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('AI BEGINS', bx, 11);
    }

    // ── Note blocks ──────────────────────────────────────────────────────
    for (const note of notes) {
      const rowIdx = MAX_PITCH - note.midi;
      const xStart = timeToX(note.time);
      const nw = Math.max(timeToX(note.time + note.duration) - xStart, 3);
      const y = RULER_H + rowIdx * ROW_H;
      const nh = ROW_H - 2;
      const black = isBlackKey(note.midi);
      const selected = selectedIds.has(note.id);

      // Note body
      const grad = ctx.createLinearGradient(xStart, y + 1, xStart, y + 1 + nh);
      if (selected) {
        grad.addColorStop(0, '#fbbf24');
        grad.addColorStop(1, '#d97706');
      } else if (black) {
        grad.addColorStop(0, '#c084fc');
        grad.addColorStop(1, '#7e22ce');
      } else {
        grad.addColorStop(0, '#6ee7b7');
        grad.addColorStop(1, '#059669');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(xStart + 0.5, y + 1, nw, nh, 2);
      ctx.fill();

      // Shimmer
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.fillRect(xStart + 1, y + 1, nw - 1, 2);

      // Velocity bar
      const velBarH = Math.max(Math.round(nh * 0.28 * (note.velocity / 127)), 1);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(xStart + 0.5, y + 1 + nh - velBarH, nw, velBarH);

      // Left accent
      ctx.fillStyle = selected ? '#fde68a' : black ? '#e9d5ff' : '#a7f3d0';
      ctx.fillRect(xStart + 0.5, y + 1, 2, nh);

      // Label
      if (nw > 24 && nh >= 10) {
        const noteName = midiToNoteName(note.midi);
        ctx.fillStyle = selected ? 'rgba(120,53,15,0.9)' : black ? 'rgba(255,255,255,0.92)' : 'rgba(0,40,20,0.85)';
        ctx.font = `bold ${Math.min(nh - 3, 9)}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(noteName, xStart + 5, y + 1 + nh / 2);
      }

      // Selection border
      if (selected) {
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(xStart, y + 0.5, nw + 1, nh + 1, 2);
        ctx.stroke();
      }

      // Resize handle indicator
      if (nw > 12) {
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(xStart + nw - 3, y + 3, 2, nh - 4);
      }
    }
  }, [gridW, canvasH, totalBeats, notes, selectedIds, timeToX]);

  // ── Draw overlay (playhead + active glow + marquee) ──────────────────
  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = gridW;
    canvas.height = canvasH;
    ctx.clearRect(0, 0, gridW, canvasH);

    // Playhead
    if (isPlaying || playheadSeconds > 0) {
      const x = timeToX(playheadSeconds);
      ctx.strokeStyle = '#ff4d4d';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = 'rgba(255,77,77,0.65)';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasH);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Triangle caret
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath();
      ctx.moveTo(x - 5, 0);
      ctx.lineTo(x + 5, 0);
      ctx.lineTo(x, 9);
      ctx.closePath();
      ctx.fill();

      // Active note glow
      for (const note of notes) {
        if (playheadSeconds >= note.time && playheadSeconds <= note.time + note.duration) {
          const rowIdx = MAX_PITCH - note.midi;
          const xStart = timeToX(note.time);
          const nw = Math.max(timeToX(note.time + note.duration) - xStart, 3);
          const y = RULER_H + rowIdx * ROW_H;
          const nh = ROW_H - 2;
          const black = isBlackKey(note.midi);
          ctx.save();
          ctx.shadowBlur = 18;
          ctx.shadowColor = black ? 'rgba(192,132,252,0.95)' : 'rgba(110,231,183,0.95)';
          ctx.strokeStyle = black ? '#e9d5ff' : '#a7f3d0';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.roundRect(xStart + 1, y + 1, nw - 1, nh - 1, 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Marquee
    const drag = dragRef.current;
    if (drag.mode === 'marquee') {
      const mx = Math.min(drag.startX, drag.currentX);
      const my = Math.min(drag.startY, drag.currentY);
      const mw = Math.abs(drag.currentX - drag.startX);
      const mh = Math.abs(drag.currentY - drag.startY);
      ctx.strokeStyle = 'rgba(251,191,36,0.8)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(mx, my, mw, mh);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(251,191,36,0.08)';
      ctx.fillRect(mx, my, mw, mh);
    }
  }, [gridW, canvasH, isPlaying, playheadSeconds, notes, timeToX]);

  // Redraw on changes
  useEffect(() => { drawKeys(); }, [drawKeys]);
  useEffect(() => { drawGrid(); }, [drawGrid]);
  useEffect(() => { drawOverlay(); }, [drawOverlay]);

  // Scroll sync
  const onGridScroll = useCallback(() => {
    if (gridScrollRef.current) {
      if (keysScrollRef.current) keysScrollRef.current.scrollTop = gridScrollRef.current.scrollTop;
      if (velocityScrollRef.current) velocityScrollRef.current.scrollLeft = gridScrollRef.current.scrollLeft;
    }
  }, []);
  const onKeysScroll = useCallback(() => {
    if (gridScrollRef.current && keysScrollRef.current) {
      gridScrollRef.current.scrollTop = keysScrollRef.current.scrollTop;
    }
  }, []);

  // Auto-scroll playhead
  useEffect(() => {
    if (!isPlaying || !gridScrollRef.current) return;
    const x = timeToX(playheadSeconds);
    const el = gridScrollRef.current;
    const cw = el.clientWidth;
    const sl = el.scrollLeft;
    if (x > sl + cw * 0.75) el.scrollLeft = x - cw * 0.15;
  }, [isPlaying, playheadSeconds, timeToX]);

  // ── Mouse handlers ───────────────────────────────────────────────────
  const getCanvasCoords = useCallback((e: React.MouseEvent): { x: number; y: number } => {
    const rect = gridCanvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) return; // right click handled by context menu
    const { x, y } = getCanvasCoords(e);
    if (y < RULER_H) {
      if (onSetPlayhead) {
        onSetPlayhead(Math.max(0, xToTime(x)));
        dragRef.current = { mode: 'scrub', startX: x, startY: y, currentX: x, currentY: y };
        setIsDragging(true);
      }
      return;
    }

    const hit = hitTest(x, y);

    if (tool === 'eraser' && hit) {
      onDeleteNote(hit.noteId);
      return;
    }

    if (tool === 'pencil' && !hit) {
      // Will create on double click, but allow drag to set duration
      return;
    }

    if (tool === 'select' || tool === 'pencil') {
      if (hit) {
        if (!e.shiftKey && !selectedIds.has(hit.noteId)) {
          onSelectIds(new Set([hit.noteId]));
        } else if (e.shiftKey) {
          const next = new Set(selectedIds);
          if (next.has(hit.noteId)) next.delete(hit.noteId);
          else next.add(hit.noteId);
          onSelectIds(next);
        }

        const note = notes.find(n => n.id === hit.noteId);
        if (note) {
          dragRef.current = {
            mode: hit.edge ? 'resize' : 'move',
            noteId: hit.noteId,
            startX: x, startY: y,
            currentX: x, currentY: y,
            origMidi: note.midi,
            origTime: note.time,
            origDuration: note.duration,
          };
          setIsDragging(true);
        }
      } else {
        // Start marquee
        if (!e.shiftKey) onSelectIds(new Set());
        dragRef.current = {
          mode: 'marquee',
          startX: x, startY: y,
          currentX: x, currentY: y,
        };
        setIsDragging(true);
      }
    }
  }, [tool, hitTest, getCanvasCoords, selectedIds, onSelectIds, onDeleteNote, notes]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) {
      // Update cursor
      const { x, y } = getCanvasCoords(e);
      const hit = hitTest(x, y);
      const el = gridScrollRef.current;
      if (el) {
        if (y < RULER_H) el.style.cursor = 'text';
        else if (tool === 'eraser') el.style.cursor = 'crosshair';
        else if (tool === 'pencil') el.style.cursor = hit ? (hit.edge ? 'ew-resize' : 'move') : 'crosshair';
        else if (hit) el.style.cursor = hit.edge ? 'ew-resize' : 'move';
        else el.style.cursor = 'crosshair';
      }
      return;
    }

    const { x, y } = getCanvasCoords(e);
    dragRef.current.currentX = x;
    dragRef.current.currentY = y;

    // Execute scrub
    if (dragRef.current.mode === 'scrub') {
      if (onSetPlayhead) onSetPlayhead(Math.max(0, xToTime(x)));
    }

    // Redraw overlay for marquee
    if (dragRef.current.mode === 'marquee' || dragRef.current.mode === 'scrub') {
      drawOverlay();
    }
  }, [isDragging, getCanvasCoords, hitTest, tool, drawOverlay, onSetPlayhead, xToTime]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;

    const drag = dragRef.current;

    if (drag.mode === 'move' && drag.noteId && drag.origMidi !== undefined && drag.origTime !== undefined) {
      const dx = drag.currentX - drag.startX;
      const dy = drag.currentY - drag.startY;
      const isSignificantMove = Math.abs(dx) > 2 || Math.abs(dy) > ROW_H / 2;

      if (isSignificantMove) {
        const deltaTime = xToTime(dx);
        const deltaMidi = -Math.round(dy / ROW_H);

        if (selectedIds.has(drag.noteId) && selectedIds.size > 1) {
          if (Math.abs(deltaTime) > 0.001 || deltaMidi !== 0) {
            onBulkMove(selectedIds, deltaMidi, snapTimeToGrid(deltaTime, snapGrid, secPerBeat));
          }
        } else {
          const newTime = snapTimeToGrid(Math.max(0, drag.origTime + deltaTime), snapGrid, secPerBeat);
          const newMidi = Math.max(MIN_PITCH, Math.min(MAX_PITCH, drag.origMidi + deltaMidi));
          if (newTime !== drag.origTime || newMidi !== drag.origMidi) {
            onMoveNote(drag.noteId, newMidi, newTime);
          }
        }
      }
    }

    if (drag.mode === 'resize' && drag.noteId && drag.origDuration !== undefined) {
      const dx = drag.currentX - drag.startX;
      if (Math.abs(dx) > 2) {
        const deltaTime = xToTime(dx);
        const newDur = snapDurationToGrid(Math.max(0.01, drag.origDuration + deltaTime), snapGrid, secPerBeat);
        if (newDur !== drag.origDuration) {
          onResizeNote(drag.noteId, newDur);
        }
      }
    }

    if (drag.mode === 'marquee') {
      const mx = Math.min(drag.startX, drag.currentX);
      const my = Math.min(drag.startY, drag.currentY);
      const mw = Math.abs(drag.currentX - drag.startX);
      const mh = Math.abs(drag.currentY - drag.startY);

      const ids = new Set<string>();
      for (const n of notes) {
        const nx = timeToX(n.time);
        const ny = midiToY(n.midi);
        const nw = Math.max(timeToX(n.time + n.duration) - nx, 3);
        if (nx + nw > mx && nx < mx + mw && ny + ROW_H > my && ny < my + mh) {
          ids.add(n.id);
        }
      }
      onSelectIds(ids);
    }

    dragRef.current = { mode: 'none', startX: 0, startY: 0, currentX: 0, currentY: 0 };
    setIsDragging(false);
    drawOverlay();
  }, [isDragging, xToTime, snapGrid, secPerBeat, notes, selectedIds,
      onMoveNote, onResizeNote, onBulkMove, onSelectIds, timeToX, midiToY, drawOverlay]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];

    const now = Date.now();
    if (now - lastTapTime.current < 300) {
      e.preventDefault();
      const mockEvent = { clientX: touch.clientX, clientY: touch.clientY } as React.MouseEvent;
      handleDoubleClick(mockEvent);
      lastTapTime.current = 0;
      return;
    }
    lastTapTime.current = now;

    const mockEvent = { clientX: touch.clientX, clientY: touch.clientY, button: 0, shiftKey: false, preventDefault: () => {} } as unknown as React.MouseEvent;
    handleMouseDown(mockEvent);

    if (dragRef.current.mode === 'move') {
      longPressTimer.current = setTimeout(() => {
        if (dragRef.current.noteId) {
          const note = notes.find(n => n.id === dragRef.current.noteId);
          if (note) {
            const rect = gridCanvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const x = touch.clientX - rect.left;
            const nx = timeToX(note.time);
            const nw = Math.max(timeToX(note.time + note.duration) - nx, 3);
            if (x > nx + nw / 2) {
              dragRef.current.mode = 'resize';
              if (gridScrollRef.current) gridScrollRef.current.style.cursor = 'ew-resize';
            }
          }
        }
      }, 500);
    }
  }, [notes, timeToX, handleMouseDown, handleDoubleClick]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1 || !isDragging) return;
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    const touch = e.touches[0];
    const mockEvent = { clientX: touch.clientX, clientY: touch.clientY, preventDefault: () => {} } as unknown as React.MouseEvent;
    handleMouseMove(mockEvent);
  }, [isDragging, handleMouseMove]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    handleMouseUp();
  }, [handleMouseUp]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    const { x, y } = getCanvasCoords(e);
    if (y < RULER_H) return;

    const hit = hitTest(x, y);
    if (hit) {
      // Double click on existing note — no action (could open velocity editor)
      return;
    }

    // Create new note
    const midi = yToMidi(y);
    if (midi < MIN_PITCH || midi > MAX_PITCH) return;
    const rawTime = xToTime(x);
    const time = snapTimeToGrid(Math.max(0, rawTime), snapGrid, secPerBeat);
    const duration = snapDurationToGrid(secPerBeat / 4, snapGrid, secPerBeat); // 1/4 beat default
    onAddNote({ midi, time, duration, velocity: DEFAULT_VELOCITY });
    onPreviewNote(midi);
  }, [getCanvasCoords, hitTest, yToMidi, xToTime, snapGrid, secPerBeat, onAddNote, onPreviewNote]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const { x, y } = getCanvasCoords(e);
    const hit = hitTest(x, y);
    if (hit) {
      if (selectedIds.has(hit.noteId) && selectedIds.size > 1) {
        onDeleteNotes(selectedIds);
        onSelectIds(new Set());
      } else {
        onDeleteNote(hit.noteId);
      }
    }
  }, [getCanvasCoords, hitTest, selectedIds, onDeleteNote, onDeleteNotes, onSelectIds]);

  // Keyboard: Delete/Backspace
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.size > 0) {
        // Avoid deleting when typing in inputs
        if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT') return;
        e.preventDefault();
        onDeleteNotes(selectedIds);
        onSelectIds(new Set());
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedIds, onDeleteNotes, onSelectIds]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top half: Keys + Grid */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Fixed piano keys */}
      <div
        ref={keysScrollRef}
        onScroll={onKeysScroll}
        style={{ width: KEY_W, flexShrink: 0, overflowX: 'hidden', overflowY: 'scroll', scrollbarWidth: 'none' }}
      >
        <canvas ref={keysCanvasRef} style={{ display: 'block', width: KEY_W, height: canvasH }} />
      </div>

      {/* Scrollable grid */}
      <div
        ref={gridScrollRef}
        onScroll={onGridScroll}
        style={{ flex: 1, overflow: 'auto', touchAction: 'none' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        <div style={{ position: 'relative', width: gridW, height: canvasH, display: 'inline-block' }}>
          <canvas ref={gridCanvasRef} style={{ display: 'block', width: gridW, height: canvasH }} />
          <canvas
            ref={overlayCanvasRef}
            style={{ position: 'absolute', top: 0, left: 0, width: gridW, height: canvasH, pointerEvents: 'none' }}
          />
        </div>
      </div>
      </div>

      {/* Bottom half: Velocity */}
      <div style={{ display: 'flex', height: 80, borderTop: '1px solid var(--border)', background: '#14121f' }}>
        <div style={{ width: KEY_W, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: 1 }}>VELOCITY</span>
        </div>
        {onSetVelocity && (
          <VelocityLane 
            notes={notes} 
            bpm={bpm} 
            selectedIds={selectedIds} 
            onSetVelocity={onSetVelocity} 
            scrollRef={velocityScrollRef} 
          />
        )}
      </div>
    </div>
  );
}
