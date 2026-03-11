/**
 * midiToMusicXml.ts
 * Converts @tonejs/midi data to a MusicXML string compatible with
 * OpenSheetMusicDisplay (OSMD).
 *
 * Strategy:
 *  1. Parse the MIDI with @tonejs/midi to get note objects (time, pitch, duration)
 *  2. Quantise note times to beats (quarter notes at the MIDI tempo)
 *  3. Pack notes into 4/4 measures using simple greedy binning
 *  4. Emit valid MusicXML 3.1 with one stave, treble clef, 4/4 time
 */

import { Midi } from '@tonejs/midi';

// ── Pitch helpers ──────────────────────────────────────────────────────────
interface MxmlNote {
  step: string;       // C D E F G A B
  alter: number;      // -1 flat, 0 natural, 1 sharp
  octave: number;     // e.g. 4
  durationDivs: number; // duration in "divisions" (we use 480 per quarter)
  type: string;       // 'quarter' | 'eighth' | 'half' | 'whole' | 'sixteenth'
  isRest: boolean;
}

const DIVISIONS = 480; // divisions per quarter note (standard)
const BEATS_PER_MEASURE = 4;
const MEASURE_DIVS = DIVISIONS * BEATS_PER_MEASURE; // 1920 per 4/4 measure

// Map semitone offset within octave → step + alter
const SEM_TO_STEP: { step: string; alter: number }[] = [
  { step: 'C', alter: 0 },   // 0
  { step: 'C', alter: 1 },   // 1  C#
  { step: 'D', alter: 0 },   // 2
  { step: 'D', alter: 1 },   // 3  D#
  { step: 'E', alter: 0 },   // 4
  { step: 'F', alter: 0 },   // 5
  { step: 'F', alter: 1 },   // 6  F#
  { step: 'G', alter: 0 },   // 7
  { step: 'G', alter: 1 },   // 8  G#
  { step: 'A', alter: 0 },   // 9
  { step: 'A', alter: 1 },   // 10 A#
  { step: 'B', alter: 0 },   // 11
];

function midiNumToStep(midiNum: number): { step: string; alter: number; octave: number } {
  const semInOct = midiNum % 12;
  const octave = Math.floor(midiNum / 12) - 1;
  return { ...SEM_TO_STEP[semInOct], octave };
}

// Convert seconds-duration to nearest "divisions" value snapped to standard note types
function snapToDivisions(seconds: number, bpm: number): { divs: number; type: string } {
  const quarterSec = 60 / bpm;
  const rawDivs = Math.round((seconds / quarterSec) * DIVISIONS);

  const noteTypes: { divs: number; type: string }[] = [
    { divs: DIVISIONS / 4, type: 'sixteenth' },    // 120
    { divs: DIVISIONS / 2, type: 'eighth' },        // 240
    { divs: DIVISIONS,     type: 'quarter' },        // 480
    { divs: DIVISIONS * 2, type: 'half' },           // 960
    { divs: DIVISIONS * 4, type: 'whole' },          // 1920
  ];

  let best = noteTypes[2]; // default quarter
  let bestDist = Math.abs(rawDivs - best.divs);
  for (const t of noteTypes) {
    const d = Math.abs(rawDivs - t.divs);
    if (d < bestDist) { bestDist = d; best = t; }
  }
  return best;
}

// ── MusicXML emitter ───────────────────────────────────────────────────────
function noteXml(note: MxmlNote, index: number): string {
  if (note.isRest) {
    return `        <note>
          <rest/>
          <duration>${note.durationDivs}</duration>
          <type>${note.type}</type>
        </note>`;
  }
  const alterXml = note.alter !== 0
    ? `          <alter>${note.alter}</alter>\n`
    : '';
  const accidentalXml = note.alter !== 0
    ? `          <accidental>${note.alter > 0 ? 'sharp' : 'flat'}</accidental>\n`
    : '';
  return `        <note>
          <pitch>
            <step>${note.step}</step>
${alterXml}          <octave>${note.octave}</octave>
          </pitch>
          <duration>${note.durationDivs}</duration>
          <type>${note.type}</type>
${accidentalXml}        </note>`;
}

function buildMeasures(notes: MxmlNote[]): string {
  const measures: string[] = [];
  let buf: MxmlNote[] = [];
  let fillDivs = 0;
  let measureNum = 1;

  const flush = () => {
    // Pad remaining space with a rest
    if (fillDivs < MEASURE_DIVS) {
      const remaining = MEASURE_DIVS - fillDivs;
      const { type } = snapToDivisions(remaining / DIVISIONS * (60 / 120), 120);
      buf.push({ step: 'B', alter: 0, octave: 4, durationDivs: remaining, type, isRest: true });
    }
    const attrXml = measureNum === 1
      ? `        <attributes>
          <divisions>${DIVISIONS}</divisions>
          <key><fifths>0</fifths></key>
          <time><beats>4</beats><beat-type>4</beat-type></time>
          <clef><sign>G</sign><line>2</line></clef>
        </attributes>\n`
      : '';
    measures.push(
      `      <measure number="${measureNum}">\n${attrXml}${buf.map((n, i) => noteXml(n, i)).join('\n')}\n      </measure>`
    );
    buf = [];
    fillDivs = 0;
    measureNum++;
  };

  for (const note of notes) {
    if (fillDivs + note.durationDivs > MEASURE_DIVS) {
      // Split note at bar line
      const firstPart = MEASURE_DIVS - fillDivs;
      if (firstPart > 0) {
        const { type } = snapToDivisions(firstPart / DIVISIONS, 120);
        buf.push({ ...note, durationDivs: firstPart, type });
        fillDivs = MEASURE_DIVS;
      }
      flush();
      const rest = note.durationDivs - firstPart;
      if (rest > 0) {
        const { type } = snapToDivisions(rest / DIVISIONS, 120);
        buf.push({ ...note, durationDivs: rest, type });
        fillDivs += rest;
      }
    } else {
      buf.push(note);
      fillDivs += note.durationDivs;
      if (fillDivs >= MEASURE_DIVS) flush();
    }
  }
  if (buf.length > 0 || fillDivs === 0) flush();
  return measures.join('\n');
}

export function midiBufferToMusicXml(buffer: ArrayBuffer): string {
  const midi = new Midi(buffer);
  const bpm = midi.header.tempos.length > 0 ? midi.header.tempos[0].bpm : 120;

  const mxNotes: MxmlNote[] = [];

  for (const track of midi.tracks) {
    for (const note of track.notes) {
      const { step, alter, octave } = midiNumToStep(note.midi);
      const { divs, type } = snapToDivisions(note.duration, bpm);
      mxNotes.push({ step, alter, octave, durationDivs: divs, type, isRest: false });
    }
    if (mxNotes.length > 0) break; // use first track with notes
  }

  if (mxNotes.length === 0) {
    // Fallback: one whole rest
    mxNotes.push({ step: 'B', alter: 0, octave: 4, durationDivs: MEASURE_DIVS, type: 'whole', isRest: true });
  }

  const measuresXml = buildMeasures(mxNotes);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC
  "-//Recordare//DTD MusicXML 3.1 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <identification>
    <encoding>
      <software>Melodica</software>
    </encoding>
  </identification>
  <part-list>
    <score-part id="P1">
      <part-name>Piano</part-name>
    </score-part>
  </part-list>
  <part id="P1">
${measuresXml}
  </part>
</score-partwise>`;
}

/** Convert NoteEntry[] (from PianoNotation) → MusicXML string */
export function noteEntriesToMusicXml(
  notes: { pitch: string; duration: string }[]
): string {
  const DUR_TYPE: Record<string, { type: string; divs: number }> = {
    'w':  { type: 'whole',     divs: DIVISIONS * 4 },
    'h':  { type: 'half',      divs: DIVISIONS * 2 },
    'q':  { type: 'quarter',   divs: DIVISIONS },
    '8':  { type: 'eighth',    divs: DIVISIONS / 2 },
    '16': { type: 'sixteenth', divs: DIVISIONS / 4 },
  };

  const PITCH_RE = /^([A-G])(#?)(\d)$/;
  const STEP_TO_MIDI: Record<string, number> = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };

  const mxNotes: MxmlNote[] = notes.map(n => {
    const { type, divs } = DUR_TYPE[n.duration] ?? DUR_TYPE['q'];
    const m = n.pitch.match(PITCH_RE);
    if (!m) return { step: 'C', alter: 0, octave: 4, durationDivs: divs, type, isRest: false };
    const [, letter, sharp, octStr] = m;
    const midiNum = (parseInt(octStr) + 1) * 12 + STEP_TO_MIDI[letter] + (sharp ? 1 : 0);
    const { step, alter, octave } = midiNumToStep(midiNum);
    return { step, alter, octave, durationDivs: divs, type, isRest: false };
  });

  const measuresXml = buildMeasures(mxNotes);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC
  "-//Recordare//DTD MusicXML 3.1 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <identification>
    <encoding><software>Melodica</software></encoding>
  </identification>
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
${measuresXml}
  </part>
</score-partwise>`;
}
