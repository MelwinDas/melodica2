'use client';
import { useState, useCallback, useRef } from 'react';
import { Command } from '../lib/types';

const MAX_HISTORY = 200;

export function useUndoRedo() {
  const undoStack = useRef<Command[]>([]);
  const redoStack = useRef<Command[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushCommand = useCallback((cmd: Command) => {
    cmd.execute();
    undoStack.current.push(cmd);
    if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
    redoStack.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const undo = useCallback(() => {
    const cmd = undoStack.current.pop();
    if (!cmd) return;
    cmd.undo();
    redoStack.current.push(cmd);
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(true);
  }, []);

  const redo = useCallback(() => {
    const cmd = redoStack.current.pop();
    if (!cmd) return;
    cmd.execute();
    undoStack.current.push(cmd);
    setCanUndo(true);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  const clear = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  return { pushCommand, undo, redo, canUndo, canRedo, clear };
}
