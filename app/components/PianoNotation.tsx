'use client';
import { useEffect, useRef } from 'react';

// VexFlow is browser-only, so we import it dynamically inside useEffect

interface NoteEntry {
  pitch: string;   // e.g. "C4", "D#4", "Bb3"
  duration: string; // e.g. "q" (quarter), "8" (eighth)
}

interface Props {
  notes: NoteEntry[];
  width?: number;
  height?: number;
}

// Convert scientific pitch (C4, D#4, Bb3, Db5) → VexFlow key (c/4, d#/4, bb/3)
function toVexPitch(pitch: string): string {
  // Support: Letter + optional #|b + digit
  const match = pitch.match(/^([A-G])(#{1,2}|b{1,2})?(\d)$/);
  if (!match) return 'c/4';
  const [, letter, acc = '', octave] = match;
  const accStr = acc.replace(/#/g, '#').replace(/b/g, 'b');
  return `${letter.toLowerCase()}${accStr}/${octave}`;
}

// Duration values in beats (for filling a 4/4 bar)
const DUR_BEATS: Record<string, number> = {
  'w': 4, 'h': 2, 'q': 1, '8': 0.5, '16': 0.25,
  'wr': 4, 'hr': 2, 'qr': 1, '8r': 0.5,
};

export default function PianoNotation({ notes, width = 780, height = 140 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    el.innerHTML = '';

    import('vexflow').then((vexModule) => {
      const Vex = vexModule.default ?? vexModule;
      const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental } = (Vex as any).Flow ?? Vex;
      const renderer = new Renderer(el, Renderer.Backends.SVG);
      renderer.resize(width, height);
      const context = renderer.getContext();
      context.setFont('Arial', 10);
      // Make SVG background transparent
      const svgEl = (context as unknown as { svg: SVGElement }).svg;
      if (svgEl) svgEl.style.background = 'transparent';

      const stave = new Stave(10, 20, width - 30);
      stave.addClef('treble').addTimeSignature('4/4');
      stave.setContext(context).draw();

      // Build up to 4 beats worth of notes
      const displayNotes: NoteEntry[] = notes.length > 0 ? [...notes] : [];

      // Truncate to max 8 notes (won't overflow a single measure badly)
      const sliced = displayNotes.slice(0, 8);

      const vfNotes = sliced.map(n => {
        const isRest = n.duration.includes('r');
        const dur = n.duration || 'q';
        const keys = isRest ? ['b/4'] : [toVexPitch(n.pitch)];
        const note = new StaveNote({ keys, duration: dur });
        if (!isRest && n.pitch.includes('#')) {
          note.addModifier(new Accidental('#'));
        } else if (!isRest && n.pitch.includes('b') && !/^[A-G]b/.test(n.pitch) === false) {
          // flat accidental — check it's actually a flat note not just 'b' natural
          if (/[A-G]b/.test(n.pitch)) note.addModifier(new Accidental('b'));
        }
        return note;
      });

      // Pad with quarter rests to fill at least 4 beats
      let beats = vfNotes.reduce((s, _, i) => s + (DUR_BEATS[sliced[i]?.duration ?? 'q'] ?? 1), 0);
      const padded = [...vfNotes];
      while (beats < 4) {
        padded.push(new StaveNote({ keys: ['b/4'], duration: 'qr' }));
        beats += 1;
      }

      const voice = new Voice({ numBeats: 4, beatValue: 4 });
      voice.setStrict(false);
      voice.addTickables(padded);

      try {
        new Formatter().joinVoices([voice]).format([voice], width - 80);
        voice.draw(context, stave);
      } catch (e) {
        console.warn('VexFlow formatting error, retrying with rests only', e);
        // Fallback: render a whole rest
        el.innerHTML = '';
        const r2 = new Renderer(el, Renderer.Backends.SVG);
        r2.resize(width, height);
        const ctx2 = r2.getContext();
        ctx2.setFont('Arial', 10);
        const st2 = new Stave(10, 20, width - 30);
        st2.addClef('treble').addTimeSignature('4/4');
        st2.setContext(ctx2).draw();
        const rest = new StaveNote({ keys: ['b/4'], duration: 'wr' });
        const v2 = new Voice({ numBeats: 4, beatValue: 4 });
        v2.setStrict(false);
        v2.addTickables([rest]);
        new Formatter().joinVoices([v2]).format([v2], width - 80);
        v2.draw(ctx2, st2);
      }
    });
  }, [notes, width, height]);

  return (
    <div
      ref={containerRef}
      style={{ background: '#f9f8ff', borderRadius: 10, overflow: 'hidden', width, maxWidth: '100%' }}
    />
  );
}
