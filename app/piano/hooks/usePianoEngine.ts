'use client';
import { useState, useCallback, useRef, useEffect } from 'react';

export type QuantizeGrid = 'off' | '1/8' | '1/16' | '1/32';
export type CountInMode = 'off' | '1bar' | '2bar';

export interface RecordedMidiEvent {
  midi: number;
  time: number;
  duration: number;
  velocity: number;
}

interface PositionDisplay {
  bars: number;
  beats: number;
  ticks: number;
}

const QWERTY_MAP: Record<string, number> = {
  'a': 0,  'w': 1,  's': 2,  'e': 3,  'd': 4,
  'f': 5,  't': 6,  'g': 7,  'y': 8,  'h': 9,
  'u': 10, 'j': 11, 'k': 12, 'o': 13, 'l': 14,
};

export function usePianoEngine() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [bpm, setBpmState] = useState(120);
  const [timeSignature, setTimeSignatureState] = useState('4/4');
  const [position, setPosition] = useState<PositionDisplay>({ bars: 1, beats: 1, ticks: 0 });
  const [playheadSeconds, setPlayheadSeconds] = useState(0);
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [metronomeFlash, setMetronomeFlash] = useState(false);
  const [quantize, setQuantize] = useState<QuantizeGrid>('off');
  const [countIn, setCountIn] = useState<CountInMode>('off');
  const [countInActive, setCountInActive] = useState(false);
  const [countInBeat, setCountInBeat] = useState(0);
  const [lastVelocity, setLastVelocity] = useState(0);
  const [samplerReady, setSamplerReady] = useState(false);
  const [tracks, setTracks] = useState<RecordedMidiEvent[][]>([]);
  const [liveNotes, setLiveNotes] = useState<RecordedMidiEvent[]>([]);

  const samplerRef   = useRef<import('tone').Sampler | null>(null);
  const toneRef      = useRef<typeof import('tone') | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transportRef = useRef<any>(null);
  const metroSynthRef   = useRef<import('tone').MembraneSynth | null>(null);
  const metroEventRef   = useRef<number | null>(null);
  const rafRef          = useRef(0);
  const recordStartTimeRef = useRef(0);
  const activeKeysRef   = useRef<Map<number, { startTime: number; velocity: number }>>(new Map());
  const baseOctaveRef   = useRef(4);
  const currentTrackRef = useRef<RecordedMidiEvent[]>([]); // live recording buffer
  const tracksRef       = useRef<RecordedMidiEvent[][]>([]); // mirror for callbacks
  const isRecordingRef  = useRef(false);
  const bpmRef          = useRef(120);
  const timeSignatureRef = useRef('4/4');
  const isPlayingRef    = useRef(false);

  useEffect(() => { isRecordingRef.current = isRecording; }, [isRecording]);
  useEffect(() => { bpmRef.current = bpm; }, [bpm]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => {
    timeSignatureRef.current = timeSignature;
    if (transportRef.current) {
        const num = parseInt(timeSignature.split('/')[0]) || 4;
        transportRef.current.timeSignature = num;
    }
  }, [timeSignature]);

  const setBpm = useCallback((v: number) => {
    bpmRef.current = v;
    setBpmState(v);
    if (transportRef.current) transportRef.current.bpm.value = v;
  }, []);

  const setTimeSignature = useCallback((ts: string) => {
    setTimeSignatureState(ts);
  }, []);

  // ── Init Tone.js + Sampler ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    import('tone').then((Tone) => {
      if (cancelled) return;
      toneRef.current = Tone;
      const sampler = new Tone.Sampler({
        urls: {
          A0: 'A0.mp3', C1: 'C1.mp3', 'D#1': 'Ds1.mp3', 'F#1': 'Fs1.mp3',
          A1: 'A1.mp3', C2: 'C2.mp3', 'D#2': 'Ds2.mp3', 'F#2': 'Fs2.mp3',
          A2: 'A2.mp3', C3: 'C3.mp3', 'D#3': 'Ds3.mp3', 'F#3': 'Fs3.mp3',
          A3: 'A3.mp3', C4: 'C4.mp3', 'D#4': 'Ds4.mp3', 'F#4': 'Fs4.mp3',
          A4: 'A4.mp3', C5: 'C5.mp3', 'D#5': 'Ds5.mp3', 'F#5': 'Fs5.mp3',
          A5: 'A5.mp3', C6: 'C6.mp3', 'D#6': 'Ds6.mp3', 'F#6': 'Fs6.mp3',
          A6: 'A6.mp3', C7: 'C7.mp3', 'D#7': 'Ds7.mp3', 'F#7': 'Fs7.mp3',
          A7: 'A7.mp3', C8: 'C8.mp3',
        },
        baseUrl: 'https://tonejs.github.io/audio/salamander/',
        onload: () => { if (!cancelled) setSamplerReady(true); },
      }).toDestination();
      samplerRef.current = sampler;

      const metro = new Tone.MembraneSynth({
        pitchDecay: 0.008, octaves: 2,
        envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.05 },
      }).toDestination();
      metro.volume.value = -8;
      metroSynthRef.current = metro;
      transportRef.current = Tone.getTransport();
    });
    return () => { cancelled = true; };
  }, []);

  const snapTime = useCallback((rawTime: number): number => {
    if (quantize === 'off') return rawTime;
    const secPerBeat = 60 / bpmRef.current;
    const div = quantize === '1/8' ? 2 : quantize === '1/16' ? 4 : 8;
    const gridSize = secPerBeat / div;
    return Math.round(rawTime / gridSize) * gridSize;
  }, [quantize]);

  const updatePosition = useCallback((rawSeconds: number) => {
    const seconds = Math.max(0, rawSeconds - recordStartTimeRef.current);
    const secPerBeat = 60 / bpmRef.current;
    const numBeats = parseInt(timeSignatureRef.current.split('/')[0]) || 4;
    const totalBeats = seconds / secPerBeat;
    const bars  = Math.floor(totalBeats / numBeats) + 1;
    const beats = Math.floor(totalBeats % numBeats) + 1;
    const ticks = Math.floor((totalBeats % 1) * 480);
    setPosition({ bars, beats, ticks });
    setPlayheadSeconds(seconds);
  }, []);

  const startTickLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const tick = () => {
      if (transportRef.current) updatePosition(transportRef.current.seconds);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [updatePosition]);

  const stopTickLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
  }, []);

  const startMetronome = useCallback(() => {
    if (!toneRef.current || !metroSynthRef.current) return;
    const Tone = toneRef.current;
    if (metroEventRef.current !== null && transportRef.current) {
      transportRef.current.clear(metroEventRef.current);
      metroEventRef.current = null;
    }
    const eventId = Tone.getTransport().scheduleRepeat((time) => {
      metroSynthRef.current?.triggerAttackRelease('C2', '32n', time, 0.5);
      Tone.getDraw().schedule(() => {
        setMetronomeFlash(true);
        setTimeout(() => setMetronomeFlash(false), 100);
      }, time);
    }, '4n');
    metroEventRef.current = eventId as unknown as number;
  }, []);

  const stopMetronome = useCallback(() => {
    if (metroEventRef.current !== null && transportRef.current) {
      transportRef.current.clear(metroEventRef.current);
      metroEventRef.current = null;
    }
    setMetronomeFlash(false);
  }, []);

  const stop = useCallback(async () => {
    stopTickLoop();
    stopMetronome();
    isRecordingRef.current = false;
    if (transportRef.current) {
      transportRef.current.stop();
      transportRef.current.cancel();
      transportRef.current.seconds = 0;
    }
    recordStartTimeRef.current = 0;
    setIsPlaying(false);
    setIsRecording(false);
    setRecordingPaused(false);
    setPosition({ bars: 1, beats: 1, ticks: 0 });
    setPlayheadSeconds(0);
  }, [stopTickLoop, stopMetronome]);

  const play = useCallback(async () => {
    if (!toneRef.current) return;
    const Tone = toneRef.current;
    await Tone.start();
    const transport = Tone.getTransport();
    transport.bpm.value = bpmRef.current;
    transport.start();
    transportRef.current = transport;
    setIsPlaying(true);
    if (metronomeEnabled) startMetronome();
    startTickLoop();
  }, [metronomeEnabled, startMetronome, startTickLoop]);

  const pause = useCallback(async () => {
    stopTickLoop();
    stopMetronome();
    if (transportRef.current) transportRef.current.pause();
    setIsPlaying(false);
  }, [stopTickLoop, stopMetronome]);

  const pauseRecording = useCallback(() => {
    isRecordingRef.current = false;
    setRecordingPaused(true);
    stopTickLoop();
    if (transportRef.current) transportRef.current.pause();
    setIsPlaying(false);
  }, [stopTickLoop]);

  const resumeRecording = useCallback(() => {
    if (!transportRef.current) return;
    isRecordingRef.current = true;
    setRecordingPaused(false);
    transportRef.current.start();
    setIsPlaying(true);
    startTickLoop();
  }, [startTickLoop]);

  const startRecording = useCallback(async () => {
    if (!toneRef.current) return;
    const Tone = toneRef.current;
    await Tone.start();

    const transport = Tone.getTransport();
    transport.bpm.value = bpmRef.current;
    transportRef.current = transport;

    currentTrackRef.current = [];
    setLiveNotes([]);

    const doRecord = () => {
      recordStartTimeRef.current = transport.seconds;
      isRecordingRef.current = true;
      setIsRecording(true);
      setIsPlaying(true);
      setRecordingPaused(false);
      if (metronomeEnabled) startMetronome();
      startTickLoop();
    };

    if (countIn === 'off') {
      transport.stop();
      transport.cancel();
      transport.seconds = 0;
      transport.start();
      doRecord();
      return;
    }

    const bars = countIn === '1bar' ? 1 : 2;
    const numBeats = parseInt(timeSignatureRef.current.split('/')[0]) || 4;
    const totalBeats = bars * numBeats;
    setCountInActive(true);
    setCountInBeat(0);

    transport.stop();
    transport.cancel();
    transport.seconds = 0;
    transport.start();
    if (metronomeEnabled) startMetronome();
    startTickLoop();

    let beatCount = 0;
    const beatMs = (60 / bpmRef.current) * 1000;
    const countInterval = setInterval(() => {
      beatCount++;
      setCountInBeat(beatCount);
      if (beatCount >= totalBeats) {
        clearInterval(countInterval);
        setCountInActive(false);
        setCountInBeat(0);
        doRecord();
      }
    }, beatMs);
  }, [countIn, metronomeEnabled, startMetronome, startTickLoop]);

  const stopRecording = useCallback(() => {
    const completedNotes = [...currentTrackRef.current];
    isRecordingRef.current = false;
    setIsRecording(false);
    setRecordingPaused(false);
    stopTickLoop();
    if (transportRef.current) {
      transportRef.current.stop();
      transportRef.current.cancel();
    }
    setIsPlaying(false);
    currentTrackRef.current = [];
    setLiveNotes([]);
    if (completedNotes.length > 0) {
      setTracks(prev => [...prev, completedNotes]);
    }
  }, [stopTickLoop]);

  const playAllTracks = useCallback(async () => {
    const allTracks = tracksRef.current;
    if (allTracks.length === 0) return;
    if (!toneRef.current) return;
    const Tone = toneRef.current;
    await Tone.start();

    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel();
    transport.bpm.value = bpmRef.current;
    recordStartTimeRef.current = 0;

    const allNotes = allTracks.flat();
    if (allNotes.length === 0) return;

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.8 },
    }).toDestination();
    synth.set({ volume: -6 });

    const endTime = Math.max(...allNotes.map(n => n.time + n.duration));

    const parts: import('tone').Part[] = [];
    for (const track of allTracks) {
      const events = track.map(n => ({
        time: n.time,
        note: Tone.Frequency(n.midi, 'midi').toNote(),
        dur: n.duration,
        vel: n.velocity / 127,
      }));
      const part = new Tone.Part((time, ev) => {
        synth.triggerAttackRelease(ev.note, ev.dur, time, ev.vel);
      }, events);
      part.start(0);
      parts.push(part);
    }

    transport.scheduleOnce(() => {
      setIsPlaying(false);
      stopTickLoop();
      stopMetronome();
      synth.dispose();
      parts.forEach(p => p.dispose());
    }, endTime + 0.5);

    transport.seconds = 0;
    transport.start();
    transportRef.current = transport;
    setIsPlaying(true);
    if (metronomeEnabled) startMetronome();
    startTickLoop();
  }, [metronomeEnabled, startMetronome, stopMetronome, startTickLoop, stopTickLoop]);

  const seek = useCallback((seconds: number) => {
    setPlayheadSeconds(seconds);
    const s = seconds + recordStartTimeRef.current;
    if (transportRef.current) transportRef.current.seconds = Math.max(0, s);
    const secPerBeat = 60 / bpmRef.current;
    const numBeats = parseInt(timeSignatureRef.current.split('/')[0]) || 4;
    const totalBeats = seconds / secPerBeat;
    setPosition({
      bars:  Math.floor(totalBeats / numBeats) + 1,
      beats: Math.floor(totalBeats % numBeats) + 1,
      ticks: Math.floor((totalBeats % 1) * 480),
    });
  }, []);

  const noteOn = useCallback((midi: number, velocity = 100) => {
    if (!samplerRef.current || !samplerReady || !toneRef.current) return;
    const Tone = toneRef.current;
    Tone.start();
    const noteStr = Tone.Frequency(midi, 'midi').toNote();
    try { samplerRef.current.triggerAttack(noteStr, undefined, velocity / 127); } catch { /* ignore */ }

    setLastVelocity(velocity);
    const currentTime = transportRef.current ? transportRef.current.seconds : Date.now() / 1000;
    activeKeysRef.current.set(midi, { startTime: currentTime, velocity });
  }, [samplerReady]);

  const noteOff = useCallback((midi: number) => {
    if (!samplerRef.current || !toneRef.current) return;
    const Tone = toneRef.current;
    const noteStr = Tone.Frequency(midi, 'midi').toNote();
    try { samplerRef.current.triggerRelease(noteStr); } catch { /* ignore */ }

    const active = activeKeysRef.current.get(midi);
    if (active) {
      activeKeysRef.current.delete(midi);
      const currentTime = transportRef.current ? transportRef.current.seconds : Date.now() / 1000;
      const duration = Math.max(0.05, currentTime - active.startTime);

      if (isRecordingRef.current) {
        const relativeStart = active.startTime - recordStartTimeRef.current;
        const event: RecordedMidiEvent = {
          midi,
          time:  Math.max(0, snapTime(relativeStart)),
          duration,
          velocity: active.velocity,
        };
        currentTrackRef.current.push(event);
        setLiveNotes([...currentTrackRef.current]);
      }
    }
    setLastVelocity(0);
  }, [snapTime]);

  useEffect(() => {
    const pressed = new Set<string>();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT','SELECT','TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      const key = e.key.toLowerCase();
      if (pressed.has(key)) return;
      pressed.add(key);
      const semi = QWERTY_MAP[key];
      if (semi !== undefined) {
        e.preventDefault();
        noteOn(semi + (baseOctaveRef.current + 1) * 12, 82);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      pressed.delete(key);
      const semi = QWERTY_MAP[key];
      if (semi !== undefined) {
        e.preventDefault();
        noteOff(semi + (baseOctaveRef.current + 1) * 12);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [noteOn, noteOff]);

  const trimSilence = useCallback(() => {
    setTracks(prev => prev.map(track => {
      if (track.length === 0) return track;
      const minStart = Math.min(...track.map(n => n.time));
      return track.map(n => ({ ...n, time: n.time - minStart }));
    }));
  }, []);

  const clearAllTracks = useCallback(() => {
    setTracks([]);
    currentTrackRef.current = [];
    setLiveNotes([]);
    stop();
  }, [stop]);

  const exportMidiBlob = useCallback(async (): Promise<Blob> => {
    const { Midi } = await import('@tonejs/midi');
    const midi = new Midi();
    midi.header.setTempo(bpmRef.current);
    for (const track of tracksRef.current) {
      const t = midi.addTrack();
      for (const n of track) {
        t.addNote({ midi: n.midi, time: n.time, duration: n.duration, velocity: n.velocity / 127 });
      }
    }
    return new Blob([new Uint8Array(midi.toArray())], { type: 'audio/midi' });
  }, []);

  const toggleMetronome = useCallback(() => {
    setMetronomeEnabled(prev => {
      const next = !prev;
      if (next && isPlayingRef.current) startMetronome();
      if (!next) stopMetronome();
      return next;
    });
  }, [startMetronome, stopMetronome]);

  const allNoteCount = tracks.reduce((s, t) => s + t.length, 0) + liveNotes.length;

  return {
    isPlaying, isRecording, recordingPaused, bpm, timeSignature, position, playheadSeconds,
    metronomeEnabled, metronomeFlash, quantize, countIn,
    countInActive, countInBeat, lastVelocity, samplerReady,
    tracks, liveNotes, allNoteCount,
    play, pause, stop,
    startRecording, pauseRecording, resumeRecording, stopRecording,
    playAllTracks, seek,
    noteOn, noteOff, setBpm, setTimeSignature,
    setQuantize, setCountIn, toggleMetronome,
    trimSilence, clearAllTracks,
    exportMidiBlob,
  };
}
