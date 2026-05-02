import { Midi } from '@tonejs/midi';
import { TimelineNote, TimelineState, generateNoteId, FLAT_TO_SHARP } from './types';

/**
 * Parse a binary MIDI ArrayBuffer into a TimelineState.
 */
export function parseMidiToTimeline(buffer: ArrayBuffer): TimelineState {
  const midi = new Midi(buffer);
  const bpm = midi.header.tempos[0]?.bpm ?? 120;
  const ts = midi.header.timeSignatures[0];
  const timeSignature: [number, number] = ts
    ? [ts.timeSignature[0], ts.timeSignature[1]]
    : [4, 4];

  const notes: TimelineNote[] = [];
  for (const track of midi.tracks) {
    for (const note of track.notes) {
      notes.push({
        id: generateNoteId(),
        midi: note.midi,
        time: note.time,
        duration: note.duration,
        velocity: Math.round(note.velocity * 127),
      });
    }
  }

  // Sort by time
  notes.sort((a, b) => a.time - b.time);

  return { notes, bpm, timeSignature };
}

/**
 * Serialize a TimelineState into a MIDI Blob.
 */
export function timelineToMidiBlob(state: TimelineState): Blob {
  const midi = new Midi();
  midi.header.setTempo(state.bpm);

  const track = midi.addTrack();
  for (const note of state.notes) {
    track.addNote({
      midi: note.midi,
      time: note.time,
      duration: note.duration,
      velocity: note.velocity / 127,
    });
  }

  return new Blob([new Uint8Array(midi.toArray())], { type: 'audio/midi' });
}

/**
 * Calculate the absolute end-time of a timeline sequence.
 */
export function getTimelineEndTime(state: TimelineState): number {
  // [FIX #10] Use reduce instead of spread to prevent stack overflow on large arrays
  return state.notes.reduce((max, n) => Math.max(max, n.time + n.duration), 0);
}

/**
 * Parse incoming MIDI and append to existing timeline at the end-time offset.
 */
export function appendMidiToTimeline(
  existing: TimelineState,
  incomingBuffer: ArrayBuffer,
): TimelineState {
  const incoming = parseMidiToTimeline(incomingBuffer);
  const endTime = getTimelineEndTime(existing);
  const firstIncomingTime = incoming.notes.length > 0 ? incoming.notes[0].time : 0;

  const offsetNotes: TimelineNote[] = incoming.notes.map(n => ({
    ...n,
    id: generateNoteId(),
    time: (n.time - firstIncomingTime) + endTime,
  }));

  return {
    ...existing,
    notes: [...existing.notes, ...offsetNotes],
    generationBoundary: endTime > 0 && offsetNotes.length > 0 ? endTime : undefined,
  };
}

/**
 * Parse MIDI blob into simplified note entries for notation display.
 */
export function parseMidiToNoteEntries(
  buffer: ArrayBuffer,
): { pitch: string; duration: string }[] {
  const midi = new Midi(buffer);
  const entries: { pitch: string; duration: string }[] = [];

  for (const track of midi.tracks) {
    for (const note of track.notes) {
      let pitch = note.name;
      const m = pitch.match(/^([A-G]b?)(\d)$/);
      if (m && FLAT_TO_SHARP[m[1]]) {
        pitch = `${FLAT_TO_SHARP[m[1]]}${m[2]}`;
      }
      entries.push({ pitch, duration: 'q' });
      if (entries.length >= 48) break;
    }
    if (entries.length >= 48) break;
  }

  return entries;
}

/**
 * Store MIDI bytes in localStorage as base64 for cross-page access.
 */
export function storeMidiInLocalStorage(buffer: ArrayBuffer, filename: string): void {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 8192;
  let b64 = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    // [FIX #6] Avoid spread operator (...) which can cause stack overflow on large buffers
    b64 += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  localStorage.setItem('melodica_midi_base64', btoa(b64));
  localStorage.setItem('melodica_midi_name', filename);
}
