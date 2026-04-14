'use client';
import { useState } from 'react';

interface Props {
  backendAlive: boolean | null;
  generating: boolean;
  generated: boolean;
  onGenerate: () => void;
}

export default function AIFooter({ backendAlive, generating, generated, onGenerate }: Props) {
  const [prompt, setPrompt] = useState('');

  return (
    <footer style={{
      height: 'var(--footer-h)',
      background: 'var(--bg-secondary)',
      borderTop: '1px solid var(--border)',
      display: 'flex', alignItems: 'center',
      padding: '0 20px', gap: 12,
      flexShrink: 0,
    }}>
      {/* AI Icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'var(--accent-purple-light)' }}>auto_awesome</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>AI Generate</span>
        {!backendAlive && (
          <span className="badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', borderColor: 'rgba(239,68,68,0.3)', fontSize: 9 }}>Offline</span>
        )}
      </div>

      {/* Prompt Input */}
      <input
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        placeholder="Describe the style you want to generate..."
        className="input-field"
        style={{ flex: 1, padding: '10px 14px', fontSize: 13, borderRadius: 8 }}
      />

      {/* Generate Button */}
      <button
        onClick={onGenerate}
        disabled={generating || !backendAlive}
        style={{
          background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
          border: 'none', borderRadius: 10,
          padding: '10px 22px', cursor: generating ? 'wait' : 'pointer',
          color: 'white', fontWeight: 700, fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 8,
          flexShrink: 0,
          opacity: !backendAlive ? 0.5 : 1,
          boxShadow: '0 4px 16px rgba(139,92,246,0.3)',
          transition: 'all 0.2s',
          minWidth: 130, justifyContent: 'center',
        }}
      >
        {generating ? (
          <>
            <div className="gen-spinner" />
            Generating…
          </>
        ) : (
          <>
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>auto_awesome</span>
            Generate
          </>
        )}
      </button>

      {/* Success indicator */}
      {generated && !generating && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <span className="material-symbols-rounded" style={{ color: 'var(--accent-teal)', fontSize: 18 }}>check_circle</span>
          <span style={{ fontSize: 11, color: 'var(--accent-teal-light)', fontWeight: 600 }}>Done!</span>
        </div>
      )}
    </footer>
  );
}
