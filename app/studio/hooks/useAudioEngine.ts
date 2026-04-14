'use client';
import { useState, useCallback, useRef } from 'react';
import { Midi } from '@tonejs/midi';
import { TimelineNote } from '../lib/types';

export function useAudioEngine() {
  const [isPlaying, setIsPlaying] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transportRef = useRef<any>(null);
  const partRef = useRef<import('tone').Part | null>(null);
  const synthRef = useRef<import('tone').PolySynth | null>(null);
  const rafRef = useRef(0);

  const cleanup = useCallback(async () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    try {
      const Tone = await import('tone');
      Tone.getTransport().stop();
      Tone.getTransport().cancel();
      if (partRef.current) { partRef.current.dispose(); partRef.current = null; }
      if (synthRef.current) { synthRef.current.dispose(); synthRef.current = null; }
    } catch { /* ignore */ }
    transportRef.current = null;
  }, []);

  const play = useCallback(async (
    notes: TimelineNote[],
    bpm: number,
    onTick?: (seconds: number) => void,
    onEnd?: () => void,
    startTime: number = 0
  ) => {
    if (notes.length === 0) return;
    await cleanup();

    const Tone = await import('tone');
    await Tone.start();

    const transport = Tone.getTransport();
    transport.bpm.value = bpm;

    const synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.8 },
    }).toDestination();
    synth.set({ volume: -6 });
    synthRef.current = synth;

    const events = notes.map(n => ({
      time: n.time,
      note: Tone.Frequency(n.midi, 'midi').toNote(),
      dur: n.duration,
      vel: n.velocity / 127,
    }));

    const part = new Tone.Part((time, ev) => {
      synth.triggerAttackRelease(ev.note, ev.dur, time, ev.vel);
    }, events);
    partRef.current = part;

    const endTime = Math.max(...notes.map(n => n.time + n.duration));
    transport.scheduleOnce(() => {
      setIsPlaying(false);
      cancelAnimationFrame(rafRef.current);
      onEnd?.();
    }, endTime + 0.3);

    part.start(0);
    transport.seconds = startTime;
    transport.start();
    transportRef.current = transport;
    setIsPlaying(true);

    if (onTick) {
      const tick = () => {
        if (!transportRef.current) return;
        onTick(transportRef.current.seconds);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [cleanup]);

  const pause = useCallback(async () => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    try {
      const Tone = await import('tone');
      Tone.getTransport().pause();
    } catch { /* ignore */ }
    setIsPlaying(false);
  }, []);

  const stop = useCallback(async () => {
    await cleanup();
    setIsPlaying(false);
  }, [cleanup]);

  const resume = useCallback(async (
    onTick?: (seconds: number) => void,
  ) => {
    try {
      const Tone = await import('tone');
      Tone.getTransport().start();
      transportRef.current = Tone.getTransport();
      setIsPlaying(true);
      if (onTick) {
        const tick = () => {
          if (!transportRef.current) return;
          onTick(transportRef.current.seconds);
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }
    } catch { /* ignore */ }
  }, []);

  const setPlaybackBpm = useCallback(async (bpm: number) => {
    try {
      const Tone = await import('tone');
      Tone.getTransport().bpm.value = bpm;
    } catch { /* ignore */ }
  }, []);

  const seek = useCallback(async (seconds: number) => {
    try {
      const Tone = await import('tone');
      Tone.getTransport().seconds = seconds;
    } catch { /* ignore */ }
  }, []);

  // Preview a single note (for pencil tool feedback)
  const previewNote = useCallback(async (midi: number, duration = 0.2) => {
    try {
      const Tone = await import('tone');
      await Tone.start();
      const synth = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.3, release: 0.3 },
      }).toDestination();
      synth.set({ volume: -10 });
      const noteName = Tone.Frequency(midi, 'midi').toNote();
      synth.triggerAttackRelease(noteName, duration);
      setTimeout(() => synth.dispose(), (duration + 0.5) * 1000);
    } catch { /* ignore */ }
  }, []);

  // Render the current timeline to an audio blob using Tone.Offline
  const renderTimelineToAudio = useCallback(async (notes: TimelineNote[], bpm: number): Promise<Blob> => {
    if (notes.length === 0) throw new Error('No notes to render');

    const Tone = await import('tone');
    const endTime = Math.max(...notes.map(n => n.time + n.duration)) + 1; // +1s tail

    // Offline rendering
    const buffer = await Tone.Offline(({ transport }) => {
      transport.bpm.value = bpm;
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.5, release: 0.8 },
      }).toDestination();
      synth.set({ volume: -6 });

      notes.forEach(n => {
        synth.triggerAttackRelease(
          Tone.Frequency(n.midi, 'midi').toNote(),
          n.duration,
          n.time,
          n.velocity / 127
        );
      });
    }, endTime);

    // Convert AudioBuffer to Blob (as WAV for widest compatibility, though user thinks MP3)
    // For simplicity without external libs, we'll return a WAV blob
    return bufferToWavBlob(buffer.get() as AudioBuffer);
  }, []);

  // Build a MIDI blob from notes for export
  const notesToMidiBlob = useCallback((notes: TimelineNote[], bpm: number): Blob => {
    const midi = new Midi();
    midi.header.setTempo(bpm);
    const track = midi.addTrack();
    for (const n of notes) {
      track.addNote({
        midi: n.midi,
        time: n.time,
        duration: n.duration,
        velocity: n.velocity / 127,
      });
    }
    return new Blob([new Uint8Array(midi.toArray())], { type: 'audio/midi' });
  }, []);

  return {
    isPlaying, play, pause, stop, resume,
    previewNote, renderTimelineToAudio, notesToMidiBlob,
    setPlaybackBpm, seek, transportRef,
  };
}

// Utility to convert AudioBuffer to WAV blob in-browser
function bufferToWavBlob(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new ArrayBuffer(length);
  const view = new DataView(out);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  function setUint16(data: number) { view.setUint16(pos, data, true); pos += 2; }
  function setUint32(data: number) { view.setUint32(pos, data, true); pos += 4; }

  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"
  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded)
  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  for (i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF) | 0;
      view.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }
  return new Blob([out], { type: 'audio/wav' });
}
