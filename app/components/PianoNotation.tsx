'use client';
import { useEffect, useRef } from 'react';

// VexFlow is browser-only, so we import it dynamically inside useEffect

interface NoteEntry {
  pitch: string;   // e.g. "C4", "D#4"
  duration: string; // e.g. "q" (quarter), "8" (eighth)
}

interface Props {
  notes: NoteEntry[];
  width?: number;
  height?: number;
}

// Convert scientific pitch (C4) → VexFlow pitch (c/4)
function toVexPitch(pitch: string): string {
  const match = pitch.match(/^([A-G])(#|b)?(\d)$/);
  if (!match) return 'c/4';
  const [, letter, acc, octave] = match;
  const accStr = acc === '#' ? '#' : acc === 'b' ? 'b' : '';
  return `${letter.toLowerCase()}${accStr}/${octave}`;
}

export default function PianoNotation({ notes, width = 780, height = 140 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    el.innerHTML = '';

    // Dynamically import Vexflow (avoids SSR issues)
    import('vexflow').then(({ Renderer, Stave, StaveNote, Voice, Formatter, Accidental }) => {
      const renderer = new Renderer(el, Renderer.Backends.SVG);
      renderer.resize(width, height);
      const context = renderer.getContext();
      context.setFont('Arial', 10);
      (context as unknown as SVGElement & { svg: SVGElement }).svg.style.background = 'transparent';

      const stave = new Stave(10, 20, width - 30);
      stave.addClef('treble').addTimeSignature('4/4');
      stave.setContext(context).draw();

      // Build VexFlow notes
      const displayNotes = notes.length > 0 ? notes : [
        { pitch: 'B4', duration: 'wr' }, // whole rest as placeholder
      ];

      const vfNotes = displayNotes.map(n => {
        const isRest = n.duration.includes('r');
        const keys = isRest ? ['b/4'] : [toVexPitch(n.pitch)];
        const note = new StaveNote({ keys, duration: n.duration || 'q' });
        // Add accidental if sharp/flat
        if (!isRest && (n.pitch.includes('#') || n.pitch.includes('b'))) {
          note.addModifier(new Accidental(n.pitch.includes('#') ? '#' : 'b'));
        }
        return note;
      });

      // Fit into one 4/4 voice — pad if fewer than 4 beats
      let totalBeats = vfNotes.reduce((sum) => sum + 1, 0);
      const paddedNotes = [...vfNotes];
      while (paddedNotes.length < 4) {
        paddedNotes.push(new StaveNote({ keys: ['b/4'], duration: 'qr' }));
        totalBeats++;
      }

      const voice = new Voice({ num_beats: 4, beat_value: 4 });
      voice.setStrict(false);
      voice.addTickables(paddedNotes.slice(0, 8)); // max 8 notes per render

      new Formatter().joinVoices([voice]).format([voice], width - 80);
      voice.draw(context, stave);
    });
  }, [notes, width, height]);

  return (
    <div
      ref={containerRef}
      style={{ background: '#f9f8ff', borderRadius: 10, overflow: 'hidden', width, maxWidth: '100%' }}
    />
  );
}
