'use client';
import { EditTool } from '../lib/types';

interface Props {
  tool: EditTool;
  onToolChange: (t: EditTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onViewSheetMusic: () => void;
}

const TOOLS: { id: EditTool; icon: string; label: string; hint: string }[] = [
  { id: 'pencil', icon: 'edit', label: 'Pencil', hint: 'Double-click to create' },
  { id: 'select', icon: 'select_all', label: 'Select', hint: 'Drag to marquee' },
  { id: 'eraser', icon: 'ink_eraser', label: 'Eraser', hint: 'Click to delete' },
];

export default function Toolbar({ tool, onToolChange, canUndo, canRedo, onUndo, onRedo, onViewSheetMusic }: Props) {
  return (
    <div data-tour="piano-roll-tools" style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '4px 10px', borderBottom: '1px solid var(--border)',
      background: '#1a1828', flexShrink: 0,
    }}>
      {/* Tool buttons */}
      <div style={{ display: 'flex', gap: 2, background: 'var(--bg-card)', borderRadius: 6, padding: 2 }}>
        {TOOLS.map(t => (
          <button
            key={t.id}
            onClick={() => onToolChange(t.id)}
            title={`${t.label} — ${t.hint}`}
            style={{
              padding: '4px 10px',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              background: tool === t.id ? 'rgba(139,92,246,0.25)' : 'transparent',
              color: tool === t.id ? 'var(--accent-purple-light)' : 'var(--text-muted)',
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 11, fontWeight: 600,
              transition: 'all 0.15s',
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 14 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

      {/* Undo/Redo */}
      <div style={{ display: 'flex', gap: 2 }}>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          style={{
            padding: '4px 8px', border: 'none', borderRadius: 4, cursor: canUndo ? 'pointer' : 'default',
            background: 'transparent', color: canUndo ? 'var(--text-secondary)' : 'var(--text-muted)',
            opacity: canUndo ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 3, fontSize: 11,
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>undo</span>
          Undo
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          style={{
            padding: '4px 8px', border: 'none', borderRadius: 4, cursor: canRedo ? 'pointer' : 'default',
            background: 'transparent', color: canRedo ? 'var(--text-secondary)' : 'var(--text-muted)',
            opacity: canRedo ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 3, fontSize: 11,
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 14 }}>redo</span>
          Redo
        </button>
      </div>

      <div style={{ flex: 1 }} />

      <button
        data-tour="view-sheet-music-btn"
        onClick={onViewSheetMusic}
        style={{
          padding: '5px 12px', border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer',
          background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)',
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600,
        }}
      >
        <span className="material-symbols-rounded" style={{ fontSize: 14 }}>library_music</span>
        <span className="hide-mobile">Full Sheet Music</span>
      </button>
    </div>
  );
}
