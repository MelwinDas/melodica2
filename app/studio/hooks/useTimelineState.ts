'use client';
import { useState, useCallback, useRef } from 'react';
import { TimelineNote, TimelineState, Command, generateNoteId } from '../lib/types';

export function useTimelineState(undoPush: (cmd: Command) => void) {
  const [notes, setNotes] = useState<TimelineNote[]>([]);
  const [bpm, setBpmState] = useState(120);
  const [timeSignature] = useState<[number, number]>([4, 4]);

  // Keep a ref in sync for non-React reads (canvas animation)
  const notesRef = useRef<TimelineNote[]>([]);
  const bpmRef = useRef(120);

  const updateNotes = useCallback((newNotes: TimelineNote[]) => {
    notesRef.current = newNotes;
    setNotes(newNotes);
  }, []);

  const setBpm = useCallback((v: number) => {
    bpmRef.current = v;
    setBpmState(v);
  }, []);

  // Load an entire timeline (e.g. from parsed MIDI)
  const loadTimeline = useCallback((state: TimelineState) => {
    updateNotes(state.notes);
    setBpm(state.bpm);
  }, [updateNotes, setBpm]);

  // Append notes from an external source at a given offset
  const appendNotes = useCallback((incoming: TimelineNote[]) => {
    const merged = [...notesRef.current, ...incoming];
    updateNotes(merged);
  }, [updateNotes]);

  // CRUD with undo support
  const addNote = useCallback((note: Omit<TimelineNote, 'id'>) => {
    const n: TimelineNote = { ...note, id: generateNoteId() };
    const cmd: Command = {
      description: `Add note`,
      execute: () => {
        const cur = [...notesRef.current, n];
        updateNotes(cur);
      },
      undo: () => {
        updateNotes(notesRef.current.filter(x => x.id !== n.id));
      },
    };
    undoPush(cmd);
    return n;
  }, [undoPush, updateNotes]);

  const deleteNote = useCallback((id: string) => {
    const target = notesRef.current.find(n => n.id === id);
    if (!target) return;
    const cmd: Command = {
      description: `Delete note`,
      execute: () => updateNotes(notesRef.current.filter(n => n.id !== id)),
      undo: () => updateNotes([...notesRef.current, target]),
    };
    undoPush(cmd);
  }, [undoPush, updateNotes]);

  const deleteNotes = useCallback((ids: Set<string>) => {
    const targets = notesRef.current.filter(n => ids.has(n.id));
    if (targets.length === 0) return;
    const cmd: Command = {
      description: `Delete ${targets.length} notes`,
      execute: () => updateNotes(notesRef.current.filter(n => !ids.has(n.id))),
      undo: () => updateNotes([...notesRef.current, ...targets]),
    };
    undoPush(cmd);
  }, [undoPush, updateNotes]);

  const moveNote = useCallback((id: string, newMidi: number, newTime: number) => {
    const target = notesRef.current.find(n => n.id === id);
    if (!target) return;
    const oldMidi = target.midi;
    const oldTime = target.time;
    const cmd: Command = {
      description: `Move note`,
      execute: () => updateNotes(notesRef.current.map(n =>
        n.id === id ? { ...n, midi: newMidi, time: newTime } : n
      )),
      undo: () => updateNotes(notesRef.current.map(n =>
        n.id === id ? { ...n, midi: oldMidi, time: oldTime } : n
      )),
    };
    undoPush(cmd);
  }, [undoPush, updateNotes]);

  const resizeNote = useCallback((id: string, newDuration: number) => {
    const target = notesRef.current.find(n => n.id === id);
    if (!target) return;
    const oldDur = target.duration;
    const cmd: Command = {
      description: `Resize note`,
      execute: () => updateNotes(notesRef.current.map(n =>
        n.id === id ? { ...n, duration: newDuration } : n
      )),
      undo: () => updateNotes(notesRef.current.map(n =>
        n.id === id ? { ...n, duration: oldDur } : n
      )),
    };
    undoPush(cmd);
  }, [undoPush, updateNotes]);

  const setNoteVelocity = useCallback((id: string, velocity: number) => {
    const target = notesRef.current.find(n => n.id === id);
    if (!target) return;
    const oldVel = target.velocity;
    const cmd: Command = {
      description: `Set velocity`,
      execute: () => updateNotes(notesRef.current.map(n =>
        n.id === id ? { ...n, velocity } : n
      )),
      undo: () => updateNotes(notesRef.current.map(n =>
        n.id === id ? { ...n, velocity: oldVel } : n
      )),
    };
    undoPush(cmd);
  }, [undoPush, updateNotes]);

  const bulkMove = useCallback((ids: Set<string>, deltaMidi: number, deltaTime: number) => {
    const originals = notesRef.current.filter(n => ids.has(n.id)).map(n => ({ id: n.id, midi: n.midi, time: n.time }));
    if (originals.length === 0) return;
    const cmd: Command = {
      description: `Move ${originals.length} notes`,
      execute: () => updateNotes(notesRef.current.map(n =>
        ids.has(n.id) ? { ...n, midi: n.midi + deltaMidi, time: Math.max(0, n.time + deltaTime) } : n
      )),
      undo: () => {
        const map = new Map(originals.map(o => [o.id, o]));
        updateNotes(notesRef.current.map(n => {
          const orig = map.get(n.id);
          return orig ? { ...n, midi: orig.midi, time: orig.time } : n;
        }));
      },
    };
    undoPush(cmd);
  }, [undoPush, updateNotes]);

  const getEndTime = useCallback((): number => {
    if (notesRef.current.length === 0) return 0;
    return Math.max(...notesRef.current.map(n => n.time + n.duration));
  }, []);

  const getState = useCallback((): TimelineState => ({
    notes: notesRef.current,
    bpm: bpmRef.current,
    timeSignature,
  }), [timeSignature]);

  return {
    notes, bpm, timeSignature, notesRef, bpmRef,
    loadTimeline, appendNotes, setBpm,
    addNote, deleteNote, deleteNotes,
    moveNote, resizeNote, setNoteVelocity,
    bulkMove, getEndTime, getState,
  };
}
