export interface TimelineNote {
  id: string;
  midi: number;
  time: number;
  duration: number;
  velocity: number;
}

export interface TimelineState {
  notes: TimelineNote[];
  bpm: number;
  timeSignature: [number, number];
  generationBoundary?: number;
}

export type SnapGrid = '1/4' | '1/8' | '1/16' | '1/32' | 'off';
export type EditTool = 'pencil' | 'select' | 'eraser';

export interface Command {
  execute(): void;
  undo(): void;
  description: string;
}

export const GENRES = [
  { id: 0, label: 'Ambient' }, { id: 1, label: 'Blues' },
  { id: 2, label: 'Children' }, { id: 3, label: 'Classical' },
  { id: 4, label: 'Country' }, { id: 5, label: 'Electronic' },
  { id: 6, label: 'Folk' }, { id: 7, label: 'Jazz' },
  { id: 8, label: 'Latin' }, { id: 9, label: 'Pop' },
  { id: 10, label: 'Rap' }, { id: 11, label: 'Reggae' },
  { id: 12, label: 'Religious' }, { id: 13, label: 'Rock' },
  { id: 14, label: 'Soul' }, { id: 15, label: 'Soundtracks' },
  { id: 16, label: 'Unknown' }, { id: 17, label: 'World' },
] as const;

export const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'] as const;

export const isBlackKey = (midi: number) => [1,3,6,8,10].includes(midi % 12);

export const midiToNoteName = (midi: number): string => {
  const note = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${note}${octave}`;
};

export const FLAT_TO_SHARP: Record<string, string> = {
  'Bb': 'A#', 'Db': 'C#', 'Eb': 'D#', 'Gb': 'F#', 'Ab': 'G#',
};

// Piano roll layout constants
export const KEY_W = 68;
export const RULER_H = 28;
export const ROW_H = 14;
export const PX_PER_BEAT = 96;
export const DEFAULT_BPM = 120;
export const DEFAULT_VELOCITY = 100;
export const DEFAULT_NOTE_DURATION = 0.25; // quarter beat in seconds at 120bpm

let _idCounter = 0;
export const generateNoteId = (): string => `note_${Date.now()}_${_idCounter++}`;

export const snapTimeToGrid = (rawTime: number, grid: SnapGrid, secPerBeat: number): number => {
  if (grid === 'off') return rawTime;
  const divisor = grid === '1/4' ? 1 : grid === '1/8' ? 2 : grid === '1/16' ? 4 : 8;
  const gridSize = secPerBeat / divisor;
  return Math.round(rawTime / gridSize) * gridSize;
};

export const snapDurationToGrid = (rawDur: number, grid: SnapGrid, secPerBeat: number): number => {
  if (grid === 'off') return Math.max(rawDur, 0.01);
  const divisor = grid === '1/4' ? 1 : grid === '1/8' ? 2 : grid === '1/16' ? 4 : 8;
  const gridSize = secPerBeat / divisor;
  return Math.max(Math.round(rawDur / gridSize) * gridSize, gridSize);
};
