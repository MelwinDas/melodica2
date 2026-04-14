'use client';
import { useEffect, useRef, useCallback } from 'react';
import type { RecordedMidiEvent, QuantizeGrid } from '../hooks/usePianoEngine';

interface Props {
  tracks: RecordedMidiEvent[][];
  liveNotes: RecordedMidiEvent[];
  playheadSeconds: number;
  isPlaying: boolean;
  isRecording: boolean;
  bpm: number;
  timeSignature: string;
  quantize: QuantizeGrid;
  onSeek: (seconds: number) => void;
}

const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
function toVexPitch(midi: number): string {
  const note = NOTE_NAMES[midi % 12];
  const oct  = Math.floor(midi / 12) - 1;
  return `${note.toLowerCase().replace('#','#')}/${oct}`;
}
function midiHasSharp(midi: number) { return [1,3,6,8,10].includes(midi % 12); }

const MEASURE_W = 240;
const STAFF_H   = 200; // Increased height to prevent overlapping notes
const START_OFFSET = 100; // Alignment absolute offset

export default function SheetMusicStage({
  tracks, liveNotes, playheadSeconds, isPlaying, isRecording, bpm, timeSignature, quantize, onSeek,
}: Props) {
  const svgParentRef = useRef<HTMLDivElement>(null);
  const scrollRef    = useRef<HTMLDivElement>(null);

  // All tracks including live recording
  const allTracks = liveNotes.length > 0 ? [...tracks, liveNotes] : tracks;

  const secPerBeat = 60 / bpm;
  const beatsPerMeasure = parseInt(timeSignature.split('/')[0]) || 4;
  const allNotes   = allTracks.flat();
  const endTime    = allNotes.length > 0
    ? Math.max(...allNotes.map(n => n.time + n.duration))
    : secPerBeat * beatsPerMeasure;
  const totalMeasures = Math.max(Math.ceil(endTime / secPerBeat / beatsPerMeasure), 1);
  const totalWidth    = Math.max(START_OFFSET + totalMeasures * MEASURE_W + 60, 720);
  const numTracks     = Math.max(allTracks.length, 1);
  const totalHeight   = numTracks * STAFF_H + 40;

  // ── Render VexFlow staves ────────────────────────────────────────────
  useEffect(() => {
    if (!svgParentRef.current) return;
    const el = svgParentRef.current;
    el.innerHTML = '';

    import('vexflow').then((vexModule) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Vex: any = (vexModule as any).default ?? vexModule;
      const F = Vex.Flow ?? Vex;
      const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } = F;

      const renderer = new Renderer(el, Renderer.Backends.SVG);
      renderer.resize(totalWidth, totalHeight);
      const ctx = renderer.getContext();
      ctx.setFont('Arial', 10);
      const svg = (ctx as unknown as { svg: SVGElement }).svg;
      if (svg) svg.style.background = 'transparent';

      // Render each track as a separate staff row
      const renderTracks = allTracks.length > 0 ? allTracks : [[]];
      renderTracks.forEach((track, trackIdx) => {
        const yOffset = trackIdx * STAFF_H + 50;

        // Track label
        if (renderTracks.length > 1) {
          ctx.save();
          ctx.setFont('Arial', 9, 'italic');
          const isLive = trackIdx === renderTracks.length - 1 && liveNotes.length > 0;
          ctx.setFillStyle(isLive ? '#ec4899' : '#a09aba');
          ctx.fillText(isLive ? '● LIVE' : `Track ${trackIdx + 1}`, 10, yOffset - 10);
          ctx.restore();
        }

        for (let m = 0; m < totalMeasures; m++) {
          const isFirst = m === 0;
          const x = isFirst ? START_OFFSET - 80 : START_OFFSET + m * MEASURE_W;
          const w = isFirst ? MEASURE_W + 80 : MEASURE_W;
          
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const stave: any = new Stave(x, yOffset, w);
          if (isFirst) {
            stave.addClef('treble');
            if (trackIdx === 0) stave.addTimeSignature(timeSignature);
          }
          stave.setContext(ctx).draw();

          const mStart = m * beatsPerMeasure * secPerBeat;
          const mEnd   = (m + 1) * beatsPerMeasure * secPerBeat;
          const mn     = track.filter(n => n.time >= mStart && n.time < mEnd);

          for (const n of mn) {
            let duration = 'q';
            if (n.duration < secPerBeat * 0.35) duration = '16';
            else if (n.duration < secPerBeat * 0.75) duration = '8';
            else if (n.duration < secPerBeat * 1.5) duration = 'q';
            else duration = 'h';

            const sn = new StaveNote({ keys: [toVexPitch(n.midi)], duration });
            if (midiHasSharp(n.midi)) sn.addModifier(new Accidental('#'));

            const absX = START_OFFSET + (n.time / secPerBeat) * (MEASURE_W / beatsPerMeasure);
            
            sn.setStave(stave);
            sn.setContext(ctx);
            const tc = new F.TickContext();
            tc.setX(absX - stave.getNoteStartX() - 5);
            sn.setTickContext(tc);
            const mc = new F.ModifierContext();
            sn.addToModifierContext(mc);
            sn.preFormat();
            sn.draw();
          }
        }
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks, liveNotes, bpm, timeSignature, totalMeasures, totalWidth, totalHeight, secPerBeat, beatsPerMeasure]);

  // ── Playhead X position ─────────────────────────────────────────────
  const getPlayheadX = useCallback((seconds: number = playheadSeconds) => {
    const totalBeats = seconds / secPerBeat;
    return START_OFFSET + totalBeats * (MEASURE_W / beatsPerMeasure);
  }, [playheadSeconds, secPerBeat, beatsPerMeasure]);

  // Auto-scroll to keep playhead visible
  useEffect(() => {
    if (!isPlaying || !scrollRef.current) return;
    const x = getPlayheadX();
    const el = scrollRef.current;
    if (x > el.scrollLeft + el.clientWidth * 0.8) el.scrollLeft = x - el.clientWidth * 0.2;
  }, [isPlaying, playheadSeconds, getPlayheadX]);

  // ── Interactive playhead: click to seek ─────────────────────────────
  const handleStageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!scrollRef.current) return;
    const rect = scrollRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + scrollRef.current.scrollLeft;
    const relX = x - START_OFFSET;
    const measuresOffset = Math.max(0, relX) / (MEASURE_W / beatsPerMeasure);
    // actually it's totalBeats: relX / (MEASURE_W / beatsPerMeasure) = totalBeats
    const beats = measuresOffset;
    const time  = Math.max(0, beats * secPerBeat);
    onSeek(Math.min(time, endTime));
  }, [secPerBeat, beatsPerMeasure, endTime, onSeek]);

  // ── Shadow Piano Roll ───────────────────────────────────────────────
  const allShadowNotes = allTracks.flat();
  const shadowH  = 56 * numTracks;
  const minM     = allShadowNotes.length > 0 ? Math.min(...allShadowNotes.map(n => n.midi)) - 2 : 60;
  const maxM     = allShadowNotes.length > 0 ? Math.max(...allShadowNotes.map(n => n.midi)) + 2 : 72;
  const range    = Math.max(maxM - minM, 12);
  const safeEnd  = Math.max(endTime, 1);

  // ── Quantize grid line positions ────────────────────────────────────
  const quantizeLines: number[] = [];
  if (quantize !== 'off') {
    const div = quantize === '1/8' ? 2 : quantize === '1/16' ? 4 : 8;
    const gridSec = secPerBeat / div;
    const count   = Math.ceil(safeEnd / gridSec);
    for (let i = 0; i <= count; i++) {
        quantizeLines.push(getPlayheadX(i * gridSec));
    }
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: 'var(--bg-card)', borderRadius: 12,
      border: '1px solid var(--border)', overflow: 'hidden', position: 'relative',
    }}>
      {/* Header bar */}
      <div style={{
        padding: '6px 14px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--bg-panel)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-rounded" style={{ fontSize: 15, color: 'var(--accent-purple-light)' }}>music_note</span>
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Sheet Music
          </span>
          {allTracks.length > 1 && (
            <span className="badge badge-teal" style={{ fontSize: 9 }}>{allTracks.length} tracks</span>
          )}
          {allShadowNotes.length > 0 && (
            <span className="badge" style={{ fontSize: 9 }}>{allShadowNotes.length} notes</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {quantize !== 'off' && (
            <span style={{ fontSize: 9, color: 'var(--accent-purple-light)', fontWeight: 700 }}>GRID {quantize}</span>
          )}
          {(isRecording || isPlaying) && (
            <span style={{ fontSize: 10, color: isRecording ? 'var(--accent-pink)' : 'var(--accent-teal-light)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor', animation: 'pulse 1s infinite' }} />
              {isRecording ? 'REC' : 'PLAY'}
            </span>
          )}
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Click to seek</span>
        </div>
      </div>

      {/* Scrollable area */}
      <div
        ref={scrollRef}
        onClick={handleStageClick}
        style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', position: 'relative', cursor: 'crosshair' }}
      >
        <div style={{ position: 'relative', minWidth: totalWidth, display: 'flex', flexDirection: 'column' }}>
          {/* VexFlow staves */}
          <div style={{ position: 'relative', minHeight: totalHeight + 4 }}>
            <div ref={svgParentRef} style={{ background: '#f9f8ff', minHeight: totalHeight, width: '100%' }} />

            {/* Playhead (spans all staves AND shadow roll) */}
            {(isPlaying || isRecording || playheadSeconds > 0) && (
              <div
                style={{
                  position: 'absolute', top: 0, height: totalHeight + shadowH + 4, width: 2,
                  background: isRecording ? '#ef4444' : 'var(--neon-blue)',
                  boxShadow: isRecording
                    ? '0 0 8px #ef4444, 0 0 16px rgba(239,68,68,0.3)'
                    : '0 0 8px var(--neon-blue), 0 0 16px rgba(0,212,255,0.3)',
                  left: getPlayheadX(),
                  zIndex: 10, pointerEvents: 'none',
                  animation: 'playhead-pulse 2s ease-in-out infinite',
                }}
              />
            )}
          </div>

          {/* Shadow Piano Roll wrapper — grid lines are siblings so they bypass opacity:0.2 */}
          <div style={{ position: 'relative', minWidth: totalWidth }}>
            {/* Notes at 20% opacity via shadow-roll class */}
            <div
              className="shadow-roll"
              style={{ height: shadowH, position: 'relative', minWidth: totalWidth }}
            >
              {/* Notes — one color band per track */}
              {allTracks.map((track, ti) => {
                const trackHue = ti === allTracks.length - 1 && liveNotes.length > 0
                  ? 'rgba(236,72,153,1)'
                  : `hsla(${260 + ti * 40}, 70%, 65%, 1)`;
                return track.map((n, ni) => {
                  const x = getPlayheadX(n.time);
                  const w = Math.max(getPlayheadX(n.duration) - START_OFFSET, 3);
                  const y = ((maxM - n.midi) / range) * (shadowH - 4) + 2;
                  const h = Math.max(shadowH / range - 1, 2);
                  return (
                    <div key={`${ti}-${ni}`} style={{
                      position: 'absolute', left: x, top: y, width: w, height: h,
                      background: trackHue, borderRadius: 2,
                    }} />
                  );
                });
              })}
            </div>

            {/* ── Quantize grid lines overlay ───────────────────────────── */}
            {quantize !== 'off' && quantizeLines.map((gx, i) => (
              <div key={`grid-${i}`} style={{
                position: 'absolute', top: 0, height: shadowH, width: 1,
                left: gx,
                background: i % (quantize === '1/8' ? 2 : quantize === '1/16' ? 4 : 8) === 0
                  ? 'rgba(139,92,246,0.5)'   // beat boundary — brighter
                  : 'rgba(139,92,246,0.15)',  // subdivision — faint
                zIndex: 3, pointerEvents: 'none',
              }} />
            ))}

            {/* Removed duplicated block for shadow playhead, top one spans both */}
          </div>
        </div>
      </div>
    </div>
  );
}
