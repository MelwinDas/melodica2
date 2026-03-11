'use client';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase';

interface Project {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  bpm: number | null;
  created_at: string;
  updated_at: string;
}

interface Profile {
  display_name: string | null;
}

const GENRE_COLORS: Record<string, string> = {
  Ambient: '#14b8a6', Blues: '#3b82f6', Jazz: '#f59e0b',
  Classical: '#ec4899', Electronic: '#8b5cf6', Rock: '#ef4444',
  Pop: '#f97316', Folk: '#84cc16', Latin: '#06b6d4',
};
const colorFor = (genre: string | null) => GENRE_COLORS[genre ?? ''] ?? '#8b5cf6';
const timeAgo = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [projects, setProjects] = useState<Project[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // New project modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGenre, setNewGenre] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    const [{ data: proj }, { data: prof }] = await Promise.all([
      supabase.from('projects').select('*').order('updated_at', { ascending: false }),
      supabase.from('profiles').select('display_name').eq('id', user.id).single(),
    ]);
    setProjects(proj ?? []);
    setProfile(prof ?? null);
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { load(); }, [load]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('projects').insert({ name: newName.trim(), genre: newGenre || null, user_id: user.id }).select().single();
    setCreating(false);
    setShowNewModal(false);
    setNewName(''); setNewGenre('');
    if (data) router.push(`/studio`);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('projects').delete().eq('id', id);
    setProjects(p => p.filter(x => x.id !== id));
    setDeleteId(null);
  };

  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
      <span className="material-symbols-rounded" style={{ fontSize: 36, color: 'var(--accent-purple)', animation: 'spin 1s linear infinite' }}>progress_activity</span>
    </div>
  );

  return (
    <div style={{ padding: '32px 36px', position: 'relative' }}>
      {/* Top bar with user info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
            My Projects
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {profile?.display_name ? `Welcome back, ${profile.display_name} 👋` : 'Manage your compositions and generated tracks'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/studio" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 16px', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>piano</span>Studio
          </Link>
          <button onClick={() => setShowNewModal(true)}
            className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 10 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>add</span>New Project
          </button>
          <button onClick={handleSignOut}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 14px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>logout</span>Sign out
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Projects', value: projects.length, icon: 'music_note', color: '#8b5cf6' },
          { label: 'Genres Used', value: new Set(projects.map(p => p.genre).filter(Boolean)).size, icon: 'category', color: '#14b8a6' },
          { label: 'Last Active', value: projects[0] ? timeAgo(projects[0].updated_at) : '—', icon: 'schedule', color: '#f59e0b' },
        ].map(s => (
          <div key={s.label} className="glass-card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${s.color}20`, border: `1px solid ${s.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 22, color: s.color }}>{s.icon}</span>
            </div>
            <div>
              <p style={{ fontSize: 24, fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>{s.value}</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['grid', 'list'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ background: view === v ? 'rgba(139,92,246,0.15)' : 'transparent', border: `1px solid ${view === v ? 'rgba(139,92,246,0.3)' : 'var(--border)'}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: view === v ? 'var(--accent-purple-light)' : 'var(--text-muted)' }}>
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{v === 'grid' ? 'grid_view' : 'view_list'}</span>
            </button>
          ))}
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="material-symbols-rounded" style={{ fontSize: 16, color: 'var(--text-muted)' }}>search</span>
          <input style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: 180 }}
            placeholder="Search projects…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && !loading && (
        <div className="glass-card" style={{ padding: '60px 40px', textAlign: 'center' }}>
          <span className="material-symbols-rounded" style={{ fontSize: 56, color: 'var(--text-muted)', display: 'block', marginBottom: 16 }}>music_off</span>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{search ? 'No matches found' : 'No projects yet'}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
            {search ? 'Try a different search term.' : 'Create your first project to get started.'}
          </p>
          {!search && (
            <button onClick={() => setShowNewModal(true)} className="btn-primary" style={{ border: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>add</span>Create Project
            </button>
          )}
        </div>
      )}

      {/* Projects */}
      {view === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 32 }}>
          {filtered.map(p => {
            const color = colorFor(p.genre);
            return (
              <div key={p.id} className="glass-card card-hover" style={{ padding: '24px', cursor: 'pointer', position: 'relative' }}>
                {/* Piano bar preview */}
                <div style={{ background: '#0d0c1a', borderRadius: 10, padding: '12px', marginBottom: 16, display: 'flex', alignItems: 'flex-end', gap: 2, height: 56, overflow: 'hidden' }}>
                  {Array.from({ length: 32 }).map((_, i) => (
                    <div key={i} style={{ flex: 1, borderRadius: 2, background: color, height: `${20 + Math.abs(Math.sin(i * 0.7 + p.name.length)) * 30}px`, opacity: 0.5 + Math.abs(Math.sin(i)) * 0.5 }} />
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {p.genre && <span className="badge" style={{ fontSize: 10, background: `${color}20`, color, borderColor: `${color}40` }}>{p.genre}</span>}
                      {p.bpm && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.bpm} BPM</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>{timeAgo(p.updated_at)}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <Link href="/studio" style={{ flex: 1, textDecoration: 'none' }}>
                    <button style={{ width: '100%', background: `${color}22`, border: `1px solid ${color}44`, borderRadius: 8, padding: '7px 12px', cursor: 'pointer', color, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <span className="material-symbols-rounded" style={{ fontSize: 15 }}>play_arrow</span>Open
                    </button>
                  </Link>
                  <button onClick={() => setDeleteId(p.id)}
                    style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 15 }}>delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
          {filtered.map(p => {
            const color = colorFor(p.genre);
            return (
              <div key={p.id} className="glass-card card-hover" style={{ padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}22`, border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 20, color }}>music_note</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.genre ?? 'No genre'} · {p.bpm ? `${p.bpm} BPM` : 'BPM not set'}</p>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 }}>{timeAgo(p.updated_at)}</span>
                <Link href="/studio" style={{ textDecoration: 'none' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'var(--text-muted)' }}>chevron_right</span>
                </Link>
                <button onClick={() => setDeleteId(p.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 18 }}>delete</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* New Project Modal */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) setShowNewModal(false); }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: 420, padding: '36px 32px' }}>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 24 }}>New Project</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Project name</label>
                <input className="input-field" placeholder="e.g. Midnight Jazz Piano" value={newName} onChange={e => setNewName(e.target.value)} required autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Genre (optional)</label>
                <select className="input-field" value={newGenre} onChange={e => setNewGenre(e.target.value)}
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, width: '100%', padding: '10px 14px', outline: 'none', color: 'var(--text-primary)', fontSize: 13 }}>
                  <option value="">Select genre…</option>
                  {['Ambient','Blues','Classical','Country','Electronic','Folk','Jazz','Latin','Pop','Rock','Soul'].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setShowNewModal(false)}
                  style={{ flex: 1, padding: '11px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 14 }}>
                  Cancel
                </button>
                <button type="submit" disabled={creating || !newName.trim()}
                  className="btn-primary" style={{ flex: 1, border: 'none', borderRadius: 10, opacity: creating || !newName.trim() ? 0.6 : 1 }}>
                  {creating ? 'Creating…' : 'Create & Open'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: 380, padding: '36px 32px', textAlign: 'center' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 40, color: '#f87171', display: 'block', marginBottom: 16 }}>delete_forever</span>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 10 }}>Delete project?</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteId(null)}
                style={{ flex: 1, padding: '11px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 14 }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteId)}
                style={{ flex: 1, padding: '11px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 10, cursor: 'pointer', color: '#f87171', fontSize: 14, fontWeight: 700 }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
