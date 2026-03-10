'use client';
import Link from 'next/link';
import { useState } from 'react';

const projects = [
  { title: 'Neon Nights Synthwave', genre: 'Electronic', bpm: 128, duration: '3:47', modified: '2h ago', color: '#8b5cf6' },
  { title: 'Midnight Jazz Piano', genre: 'Jazz', bpm: 92, duration: '5:12', modified: 'Yesterday', color: '#14b8a6' },
  { title: 'Orchestral Suite No. 1', genre: 'Classical', bpm: 72, duration: '8:34', modified: '3 days ago', color: '#ec4899' },
  { title: 'Ambient Soundscape Alpha', genre: 'Ambient', bpm: 60, duration: '6:21', modified: '1 week ago', color: '#f59e0b' },
];

const stats = [
  { label: 'Projects', value: '24', icon: 'music_note', color: '#8b5cf6' },
  { label: 'Total Duration', value: '4.2h', icon: 'schedule', color: '#14b8a6' },
  { label: 'Collaborators', value: '8', icon: 'group', color: '#ec4899' },
  { label: 'Exports', value: '47', icon: 'ios_share', color: '#f59e0b' },
];

export default function DashboardPage() {
  const [view, setView] = useState<'grid' | 'list'>('grid');

  return (
    <div style={{ padding: '32px 36px' }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 32 }}>
        <div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 4 }}>My Projects</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Manage your compositions and generated tracks</p>
        </div>
        <Link href="/studio" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-rounded" style={{ fontSize: 18 }}>add</span>
          New Project
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4" style={{ marginBottom: 32 }}>
        {stats.map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: `${s.color}20`, border: `1px solid ${s.color}40`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
            }}>
              <span className="material-symbols-rounded" style={{ fontSize: 22, color: s.color }}>{s.icon}</span>
            </div>
            <div>
              <p style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>{s.value}</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Projects header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 20 }}>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('grid')}
            style={{
              background: view === 'grid' ? 'rgba(139,92,246,0.15)' : 'transparent',
              border: `1px solid ${view === 'grid' ? 'rgba(139,92,246,0.3)' : 'var(--border)'}`,
              borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
              color: view === 'grid' ? 'var(--accent-purple-light)' : 'var(--text-muted)'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>grid_view</span>
          </button>
          <button
            onClick={() => setView('list')}
            style={{
              background: view === 'list' ? 'rgba(139,92,246,0.15)' : 'transparent',
              border: `1px solid ${view === 'list' ? 'rgba(139,92,246,0.3)' : 'var(--border)'}`,
              borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
              color: view === 'list' ? 'var(--accent-purple-light)' : 'var(--text-muted)'
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>view_list</span>
          </button>
        </div>
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 10, padding: '8px 14px',
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          <span className="material-symbols-rounded" style={{ fontSize: 16, color: 'var(--text-muted)' }}>search</span>
          <input style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: 160 }} placeholder="Search projects..." />
        </div>
      </div>

      {/* Projects grid */}
      {view === 'grid' ? (
        <div className="grid grid-cols-2 gap-4" style={{ marginBottom: 32 }}>
          {projects.map(p => (
            <Link key={p.title} href="/studio" style={{ textDecoration: 'none' }}>
              <div className="glass-card card-hover" style={{ padding: '24px', cursor: 'pointer' }}>
                {/* Waveform preview */}
                <div style={{
                  background: 'var(--bg-primary)', borderRadius: 10, padding: '16px', marginBottom: 18,
                  display: 'flex', alignItems: 'center', gap: 2, height: 60, overflow: 'hidden'
                }}>
                  {Array.from({ length: 40 }).map((_, i) => (
                    <div key={i} style={{
                      flex: 1, borderRadius: 2,
                      background: p.color,
                      height: `${15 + Math.abs(Math.sin(i * 0.4)) * 35}px`,
                      opacity: 0.6 + Math.sin(i) * 0.3
                    }} />
                  ))}
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)' }}>{p.title}</h3>
                    <div className="flex items-center gap-2">
                      <span className="badge" style={{ fontSize: 10, background: `${p.color}20`, color: p.color, borderColor: `${p.color}40` }}>{p.genre}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.bpm} BPM · {p.duration}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.modified}</span>
                </div>
                <div className="flex items-center gap-2" style={{ marginTop: 16 }}>
                  <button style={{
                    background: `${p.color}22`, border: `1px solid ${p.color}44`,
                    borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
                    color: p.color, fontSize: 12, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 6
                  }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 16 }}>play_arrow</span>
                    Open
                  </button>
                  <button style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 16 }}>more_horiz</span>
                  </button>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
          {projects.map(p => (
            <Link key={p.title} href="/studio" style={{ textDecoration: 'none' }}>
              <div className="glass-card card-hover flex items-center gap-4" style={{ padding: '16px 20px', cursor: 'pointer' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${p.color}22`, border: `1px solid ${p.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 20, color: p.color }}>music_note</span>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{p.title}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.genre} · {p.bpm} BPM · {p.duration}</p>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.modified}</span>
                <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--text-muted)' }}>chevron_right</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
