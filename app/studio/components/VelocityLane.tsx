'use client';
import { useRef, useEffect, useCallback } from 'react';
import { TimelineNote, PX_PER_BEAT, isBlackKey } from '../lib/types';

interface Props {
  notes: TimelineNote[];
  bpm: number;
  selectedIds: Set<string>;
  onSetVelocity: (id: string, velocity: number) => void;
}

const LANE_H = 80;
const BAR_MIN_W = 4;

export default function VelocityLane({ notes, bpm, selectedIds, onSetVelocity }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

      const grad = ctx.createLinearGradient(x, LANE_H - barH, x, LANE_H);
      if (selected) {
        grad.addColorStop(0, 'rgba(251,191,36,0.9)');
        grad.addColorStop(1, 'rgba(217,119,6,0.7)');
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
      ctx.fillStyle = selected ? '#fde68a' : black ? '#e9d5ff' : '#a7f3d0';
      ctx.fillRect(x + 1, LANE_H - barH, nw, 2);
    }

    // Label
    ctx.fillStyle = 'rgba(180,160,255,0.4)';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('VELOCITY', 6, 4);
  }, [canvasW, totalBeats, notes, selectedIds, timeToX]);

  useEffect(() => { draw(); }, [draw]);

  // Drag handling for velocity bars
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    const container = containerRef.current;
    if (!rect || !container) return;

    const x = e.clientX - rect.left + container.scrollLeft;
    const y = e.clientY - rect.top;

    // Find which note's bar was clicked
    for (const note of notes) {
      const nx = timeToX(note.time);
      const nw = Math.max(timeToX(note.time + note.duration) - nx - 2, BAR_MIN_W);
      if (x >= nx && x <= nx + nw) {
        const vel = Math.max(1, Math.min(127, Math.round(((LANE_H - y) / LANE_H) * 127)));
        draggingRef.current = note.id;
        onSetVelocity(note.id, vel);
        return;
      }
    }
  }, [notes, timeToX, onSetVelocity]);

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

  return (
    <div
      ref={containerRef}
      style={{
        height: LANE_H, borderTop: '1px solid var(--border)',
        overflowX: 'auto', overflowY: 'hidden',
        background: '#14121f', flexShrink: 0,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <canvas ref={canvasRef} style={{ display: 'block', width: canvasW, height: LANE_H }} />
    </div>
  );
}
