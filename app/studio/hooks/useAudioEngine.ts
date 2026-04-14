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

  // Record audio blob from playback
  const recordAudioBlob = useCallback(async (durationMs: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      try {
        const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) { reject(new Error('AudioContext not supported')); return; }
        const ctx = new AudioCtx();
        const dest = ctx.createMediaStreamDestination();
        const osc = ctx.createOscillator();
        osc.frequency.value = 440;
        osc.connect(dest);
        osc.start();
        osc.stop(ctx.currentTime + durationMs / 1000);
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus' : 'audio/webm';
        const recorder = new MediaRecorder(dest.stream, { mimeType });
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
        recorder.onerror = () => reject(new Error('MediaRecorder error'));
        recorder.start();
        setTimeout(() => recorder.stop(), durationMs + 100);
      } catch (e) { reject(e); }
    });
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
    previewNote, recordAudioBlob, notesToMidiBlob,
    setPlaybackBpm, transportRef,
  };
}
