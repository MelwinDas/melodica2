'use client';
import { useRef, useEffect, useCallback } from 'react';
import { TimelineNote, PX_PER_BEAT, isBlackKey } from '../lib/types';

interface Props {
  notes: TimelineNote[];
  bpm: number;
  selectedIds: Set<string>;
  onSetVelocity: (id: string, velocity: number) => void;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

const LANE_H = 80;
const BAR_MIN_W = 4;

export default function VelocityLane({ notes, bpm, selectedIds, onSetVelocity, scrollRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const internalContainerRef = useRef<HTMLDivElement>(null);
  const container = scrollRef || internalContainerRef;
  const draggingRef = useRef<string | null>(null);

  const secPerBeat = 60 / bpm;
  const endTime = notes.length > 0 ? Math.max(...notes.map(n => n.time + n.duration)) : 0;
  const totalBeats = Math.max(Math.ceil(endTime / secPerBeat) + 16, 32);
  const canvasW = totalBeats * PX_PER_BEAT;

  const timeToX = useCallback((t: number) => (t / secPerBeat) * PX_PER_BEAT, [secPerBeat]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvasW;
    canvas.height = LANE_H;

    // Background
    ctx.fillStyle = '#14121f';
    ctx.fillRect(0, 0, canvasW, LANE_H);

    // Grid lines at bar boundaries
    for (let beat = 0; beat <= totalBeats; beat++) {
      if (beat % 4 !== 0) continue;
      const x = beat * PX_PER_BEAT;
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, LANE_H);
      ctx.stroke();
    }

    // Horizontal guidelines
    for (const pct of [0.25, 0.5, 0.75]) {
      const y = LANE_H * (1 - pct);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasW, y);
      ctx.stroke();
    }

    // Velocity bars
    for (const note of notes) {
      const x = timeToX(note.time);
      const nw = Math.max(timeToX(note.time + note.duration) - x - 2, BAR_MIN_W);
      const velPct = note.velocity / 127;
      const barH = Math.max(velPct * (LANE_H - 4), 2);
      const selected = selectedIds.has(note.id);
      const black = isBlackKey(note.midi);

      const isUnselectedBackground = selectedIds.size > 0 && !selected;

      const grad = ctx.createLinearGradient(x, LANE_H - barH, x, LANE_H);
      if (selected) {
        grad.addColorStop(0, 'rgba(251,191,36,0.9)');
        grad.addColorStop(1, 'rgba(217,119,6,0.7)');
      } else if (isUnselectedBackground) {
        grad.addColorStop(0, 'rgba(255,255,255,0.08)');
        grad.addColorStop(1, 'rgba(255,255,255,0.02)');
      } else if (black) {
        grad.addColorStop(0, 'rgba(192,132,252,0.8)');
        grad.addColorStop(1, 'rgba(126,34,206,0.5)');
      } else {
        grad.addColorStop(0, 'rgba(110,231,183,0.8)');
        grad.addColorStop(1, 'rgba(5,150,105,0.5)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(x + 1, LANE_H - barH, nw, barH, [2, 2, 0, 0]);
      ctx.fill();

      // Top cap
      ctx.fillStyle = selected ? '#fde68a' : isUnselectedBackground ? 'rgba(255,255,255,0.1)' : black ? '#e9d5ff' : '#a7f3d0';
      ctx.fillRect(x + 1, LANE_H - barH, nw, 2);

      // Number
      if (nw >= 14 && !isUnselectedBackground) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(note.velocity), x + 1 + nw / 2, LANE_H - barH - 2);
      }
    }
  }, [canvasW, totalBeats, notes, selectedIds, timeToX]);

  useEffect(() => { draw(); }, [draw]);

  // Drag handling for velocity bars
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // x relative natively to the canvas bounds using getBoundingClientRect
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Iterate backwards so we click on notes drawn on top if overlapping
    for (let i = notes.length - 1; i >= 0; i--) {
      const note = notes[i];
      // Only allow selected note editing if any are selected
      if (selectedIds.size > 0 && !selectedIds.has(note.id)) continue;

      const nx = timeToX(note.time);
      const nw = Math.max(timeToX(note.time + note.duration) - nx - 2, BAR_MIN_W);
      if (x >= nx && x <= nx + nw) {
        const vel = Math.max(1, Math.min(127, Math.round(((LANE_H - y) / LANE_H) * 127)));
        draggingRef.current = note.id;
        onSetVelocity(note.id, vel);
        return;
      }
    }
  }, [notes, timeToX, onSetVelocity, selectedIds]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!draggingRef.current) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = e.clientY - rect.top;
    const vel = Math.max(1, Math.min(127, Math.round(((LANE_H - y) / LANE_H) * 127)));
    onSetVelocity(draggingRef.current, vel);
  }, [onSetVelocity]);

  const handleMouseUp = useCallback(() => {
    draggingRef.current = null;
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || e.touches.length === 0) return;
    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;

    for (let i = notes.length - 1; i >= 0; i--) {
      const note = notes[i];
      if (selectedIds.size > 0 && !selectedIds.has(note.id)) continue;

      const nx = timeToX(note.time);
      const nw = Math.max(timeToX(note.time + note.duration) - nx - 2, BAR_MIN_W);
      if (x >= nx && x <= nx + nw) {
        const vel = Math.max(1, Math.min(127, Math.round(((LANE_H - y) / LANE_H) * 127)));
        draggingRef.current = note.id;
        onSetVelocity(note.id, vel);
        return;
      }
    }
  }, [notes, timeToX, onSetVelocity, selectedIds]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!draggingRef.current || e.touches.length === 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const y = e.touches[0].clientY - rect.top;
    const vel = Math.max(1, Math.min(127, Math.round(((LANE_H - y) / LANE_H) * 127)));
    onSetVelocity(draggingRef.current, vel);
  }, [onSetVelocity]);

  return (
    <div
      ref={container}
      style={{
        height: LANE_H,
        overflowX: 'hidden', overflowY: 'hidden', /* we disable native scrollbar here since it's synced with the grid */
        background: '#14121f', flex: 1,
        touchAction: 'none',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
      onTouchCancel={handleMouseUp}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: canvasW, height: LANE_H }} />
    </div>
  );
}
