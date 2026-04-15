/**
 * midiToMusicXml.ts
 * Converts @tonejs/midi data to a MusicXML grand staff (treble + bass clef)
 * string compatible with OpenSheetMusicDisplay (OSMD).
 *
 * Strategy:
 *  1. Parse the MIDI with @tonejs/midi to get note objects (time, pitch, duration)
 *  2. Quantise note times to beats at MIDI tempo
 *  3. Split notes: MIDI ≥ 60 → treble (P1), MIDI < 60 → bass (P2)
 *  4. Pack each voice into 4/4 measures with greedy binning + rest padding
 *  5. Emit valid MusicXML 3.1 with two staves (grand piano staff)
 */

import { Midi } from '@tonejs/midi';

// ── Types ──────────────────────────────────────────────────────────────────
interface MxmlNote {
  step: string;       // C D E F G A B
  alter: number;      // -1 flat, 0 natural, 1 sharp
  octave: number;
  durationDivs: number;
  type: string;       // 'quarter' | 'eighth' | 'half' | 'whole' | 'sixteenth'
  isRest: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────
const DIVISIONS = 480;          // ticks per quarter note
const BEATS_PER_MEASURE = 4;
const MEASURE_DIVS = DIVISIONS * BEATS_PER_MEASURE; // 1920

// ── Pitch helpers ──────────────────────────────────────────────────────────
const SEM_TO_STEP: { step: string; alter: number }[] = [
  { step: 'C', alter: 0 }, { step: 'C', alter: 1 },
  { step: 'D', alter: 0 }, { step: 'D', alter: 1 },
  { step: 'E', alter: 0 }, { step: 'F', alter: 0 },
  { step: 'F', alter: 1 }, { step: 'G', alter: 0 },
  { step: 'G', alter: 1 }, { step: 'A', alter: 0 },
  { step: 'A', alter: 1 }, { step: 'B', alter: 0 },
];

function midiNumToStep(midiNum: number): { step: string; alter: number; octave: number } {
  const semInOct = midiNum % 12;
  const octave = Math.floor(midiNum / 12) - 1;
  return { ...SEM_TO_STEP[semInOct], octave };
}

function snapToDivisions(seconds: number, bpm: number): { divs: number; type: string } {
  const quarterSec = 60 / bpm;
  const rawDivs = Math.round((seconds / quarterSec) * DIVISIONS);

  const noteTypes: { divs: number; type: string }[] = [
    { divs: DIVISIONS / 4, type: 'sixteenth' },
    { divs: DIVISIONS / 2, type: 'eighth' },
    { divs: DIVISIONS,     type: 'quarter' },
    { divs: DIVISIONS * 2, type: 'half' },
    { divs: DIVISIONS * 4, type: 'whole' },
  ];

  let best = noteTypes[2]; // default quarter
  let bestDist = Math.abs(rawDivs - best.divs);
  for (const t of noteTypes) {
    const d = Math.abs(rawDivs - t.divs);
    if (d < bestDist) { bestDist = d; best = t; }
  }
  return best;
}

// ── MusicXML note emitter ─────────────────────────────────────────────────
function noteXml(note: MxmlNote): string {
  if (note.isRest) {
    return `        <note>
          <rest/>
          <duration>${note.durationDivs}</duration>
          <type>${note.type}</type>
        </note>`;
  }
  const alterXml = note.alter !== 0 ? `          <alter>${note.alter}</alter>\n` : '';
  const accXml   = note.alter !== 0 ? `          <accidental>${note.alter > 0 ? 'sharp' : 'flat'}</accidental>\n` : '';
  return `        <note>
          <pitch>
            <step>${note.step}</step>
${alterXml}          <octave>${note.octave}</octave>
          </pitch>
          <duration>${note.durationDivs}</duration>
          <type>${note.type}</type>
${accXml}        </note>`;
}

// ── Measure builder ────────────────────────────────────────────────────────
function buildMeasures(
  notes: MxmlNote[],
  clefSign: 'G' | 'F',
  clefLine: 2 | 4
): string {
  const measures: string[] = [];
  let buf: MxmlNote[] = [];
  let fillDivs = 0;
  let measureNum = 1;

  const flush = () => {
    if (fillDivs < MEASURE_DIVS) {
      const remaining = MEASURE_DIVS - fillDivs;
      const { type } = snapToDivisions(remaining / DIVISIONS * 0.5, 120);
      buf.push({ step: 'B', alter: 0, octave: clefSign === 'G' ? 4 : 2, durationDivs: remaining, type, isRest: true });
    }
    const attrXml = measureNum === 1
      ? `        <attributes>
          <divisions>${DIVISIONS}</divisions>
          <key><fifths>0</fifths></key>
          <time><beats>4</beats><beat-type>4</beat-type></time>
          <clef><sign>${clefSign}</sign><line>${clefLine}</line></clef>
        </attributes>\n`
      : '';
    measures.push(
      `      <measure number="${measureNum}">\n${attrXml}${buf.map(n => noteXml(n)).join('\n')}\n      </measure>`
    );
    buf = []; fillDivs = 0; measureNum++;
  };

  for (const note of notes) {
    if (fillDivs + note.durationDivs > MEASURE_DIVS) {
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

// ── Grand-staff MusicXML wrapper ──────────────────────────────────────────
function grandStaffXml(trebleMeasures: string, bassMeasures: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC
  "-//Recordare//DTD MusicXML 3.1 Partwise//EN"
  "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <identification>
    <encoding><software>Melodica</software></encoding>
  </identification>
  <part-list>
    <score-part id="P1"><part-name>Treble</part-name></score-part>
    <score-part id="P2"><part-name>Bass</part-name></score-part>
  </part-list>
  <part id="P1">
${trebleMeasures}
  </part>
  <part id="P2">
${bassMeasures}
  </part>
</score-partwise>`;
}

// ── Single-staff fallback (for when all notes are in one range) ────────────
function singleStaffXml(measures: string, clefSign: 'G' | 'F', clefLine: 2 | 4): string {
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
${measures}
  </part>
</score-partwise>`;
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Convert a raw MIDI ArrayBuffer → grand-staff MusicXML string */
export function midiBufferToMusicXml(buffer: ArrayBuffer): string {
  const midi = new Midi(buffer);
  const bpm = midi.header.tempos.length > 0 ? midi.header.tempos[0].bpm : 120;

  // Helper to process a list of notes into a timed sequence (including rests)
  const processNotes = (notes: { midi: number; time: number; duration: number }[], clef: 'treble' | 'bass') => {
    const sorted = [...notes].sort((a, b) => a.time - b.time);
    const result: MxmlNote[] = [];
    let currentTime = 0;

    for (const n of sorted) {
      // 1. Add rest if there's a gap
      if (n.time > currentTime + 0.01) {
        const gap = n.time - currentTime;
        const { divs, type } = snapToDivisions(gap, bpm);
        if (divs > 0) {
          result.push({ step: 'C', alter: 0, octave: 4, durationDivs: divs, type, isRest: true });
        }
      }

      // 2. Add the note
      const { step, alter, octave } = midiNumToStep(n.midi);
      const { divs, type } = snapToDivisions(n.duration, bpm);
      if (divs > 0) {
        result.push({ step, alter, octave, durationDivs: divs, type, isRest: false });
        // Only advance time if this note ends after our current cursor (simple voice handling)
        currentTime = Math.max(currentTime, n.time + n.duration);
      }
    }
    return result;
  };

  const trebleRaw: { midi: number; time: number; duration: number }[] = [];
  const bassRaw:   { midi: number; time: number; duration: number }[] = [];

  for (const track of midi.tracks) {
    for (const note of track.notes) {
      if (note.midi >= 60) trebleRaw.push({ midi: note.midi, time: note.time, duration: note.duration });
      else                 bassRaw.push({ midi: note.midi, time: note.time, duration: note.duration });
    }
  }

  const trebleProcessed = processNotes(trebleRaw, 'treble');
  const bassProcessed   = processNotes(bassRaw, 'bass');

  if (trebleProcessed.length === 0 && bassProcessed.length === 0) {
    trebleProcessed.push({ step: 'B', alter: 0, octave: 4, durationDivs: MEASURE_DIVS, type: 'whole', isRest: true });
  }

  const hasTreble = trebleProcessed.length > 0;
  const hasBass   = bassProcessed.length > 0;

  if (hasTreble && hasBass) {
    return grandStaffXml(
      buildMeasures(trebleProcessed, 'G', 2),
      buildMeasures(bassProcessed,   'F', 4)
    );
  } else if (hasBass) {
    return singleStaffXml(buildMeasures(bassProcessed, 'F', 4), 'F', 4);
  } else {
    return singleStaffXml(buildMeasures(trebleProcessed, 'G', 2), 'G', 2);
  }
}

/** Convert NoteEntry[] (from PianoNotation) → grand-staff MusicXML string */
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

  const processEntries = (rawNotes: { pitch: string; duration: string }[]) => {
    const result: MxmlNote[] = [];
    for (const n of rawNotes) {
      const { type, divs } = DUR_TYPE[n.duration] ?? DUR_TYPE['q'];
      const m = n.pitch.match(PITCH_RE);
      let midiNum = 60;
      if (m) {
        const [, letter, sharp, octStr] = m;
        midiNum = (parseInt(octStr) + 1) * 12 + STEP_TO_MIDI[letter] + (sharp ? 1 : 0);
      }
      const { step, alter, octave } = midiNumToStep(midiNum);
      result.push({ step, alter, octave, durationDivs: divs, type, isRest: false });
    }
    return result;
  };

  const trebleRaw = notes.filter(n => {
    const m = n.pitch.match(PITCH_RE);
    if (!m) return true;
    const midiNum = (parseInt(m[3]) + 1) * 12 + STEP_TO_MIDI[m[1]] + (m[2] ? 1 : 0);
    return midiNum >= 60;
  });
  const bassRaw = notes.filter(n => {
    const m = n.pitch.match(PITCH_RE);
    if (!m) return false;
    const midiNum = (parseInt(m[3]) + 1) * 12 + STEP_TO_MIDI[m[1]] + (m[2] ? 1 : 0);
    return midiNum < 60;
  });

  const trebleProcessed = processEntries(trebleRaw);
  const bassProcessed   = processEntries(bassRaw);

  if (trebleProcessed.length === 0 && bassProcessed.length === 0) {
    trebleProcessed.push({ step: 'C', alter: 0, octave: 4, durationDivs: DIVISIONS, type: 'quarter', isRest: true });
  }

  if (trebleProcessed.length > 0 && bassProcessed.length > 0) {
    return grandStaffXml(
      buildMeasures(trebleProcessed, 'G', 2),
      buildMeasures(bassProcessed,   'F', 4)
    );
  } else if (bassProcessed.length > 0) {
    return singleStaffXml(buildMeasures(bassProcessed, 'F', 4), 'F', 4);
  } else {
    return singleStaffXml(buildMeasures(trebleProcessed, 'G', 2), 'G', 2);
  }
}
