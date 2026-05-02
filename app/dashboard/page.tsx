'use client';
import Link from 'next/link';
import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '../../lib/supabase';

interface Project {
  id: string;
  name: string;
  description: string | null;
  genre: string | null;
  bpm: number | null;
  created_at: string;
  updated_at: string;
  folder_id?: string;
  midi_url?: string | null;
}

interface Profile {
  display_name: string | null;
}

const GENRE_COLORS: Record<string, string> = {
  Ambient: '#14b8a6', Blues: '#3b82f6', Classical: '#ec4899', Country: '#84cc16',
  Electronic: '#8b5cf6', Folk: '#a855f7', Jazz: '#f59e0b', Latin: '#06b6d4',
  Pop: '#f97316', Rock: '#ef4444', Soul: '#d946ef', Children: '#0d9488',
  Rap: '#4ade80', Reggae: '#fbbf24', Religious: '#6366f1', Soundtracks: '#f43f5e',
  Unknown: '#94a3b8', World: '#2dd4bf'
};
const colorFor = (genre: string | null) => GENRE_COLORS[genre ?? ''] ?? '#8b5cf6';
const timeAgo = (iso: string) => {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
};

const supabase = createClient();

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentFolderId = searchParams.get('folder');

  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [projects, setProjects] = useState<Project[]>([]);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // New project modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGenre, setNewGenre] = useState('');
  const [newProjectFolder, setNewProjectFolder] = useState('');
  
  // New folder modal
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [creating, setCreating] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDragOver, setUploadDragOver] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [targetFolder, setTargetFolder] = useState('');
  const [moving, setMoving] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }

    let projQuery = supabase.from('projects').select('*');
    if (currentFolderId && currentFolderId !== 'sample') {
      projQuery = projQuery.eq('folder_id', currentFolderId);
    } else if (currentFolderId === 'sample') {
      // Find the real sample folder ID
      const { data: sf } = await supabase.from('folders').select('id').eq('name', 'Sample').limit(1).single();
      if (sf) projQuery = projQuery.eq('folder_id', sf.id);
      else projQuery = projQuery.eq('folder_id', '00000000-0000-0000-0000-000000000000');
    }

    let [{ data: proj }, { data: prof }, { data: f }] = await Promise.all([
      projQuery.order('updated_at', { ascending: false }),
      supabase.from('profiles').select('display_name').eq('id', user.id).single(),
      supabase.from('folders').select('*').order('created_at', { ascending: false })
    ]);

    // Ensure Sample folder exists and contains Happy Birthday
    let sampleFolder = f?.find(folder => folder.name === 'Sample');
    if (f && !sampleFolder) {
      const { data: newSample } = await supabase.from('folders').insert({ name: 'Sample', user_id: user.id }).select().single();
      if (newSample) {
        sampleFolder = newSample;
        f = [newSample, ...(f || [])];
      }
    }

    if (sampleFolder) {
      const { data: hbExists } = await supabase.from('projects').select('id').eq('folder_id', sampleFolder.id).eq('name', 'Happy Birthday').maybeSingle();
      if (!hbExists) {
        await supabase.from('projects').insert({
          user_id: user.id,
          name: 'Happy Birthday',
          genre: 'Children',
          folder_id: sampleFolder.id,
          midi_url: '/Happy_Sample.mid'
        });
        if (currentFolderId === 'sample') {
          const { data: refreshed } = await supabase.from('projects').select('*').eq('folder_id', sampleFolder.id).order('updated_at', { ascending: false });
          proj = refreshed;
        }
      }
    }

    setProjects(proj ?? []);
    setProfile(prof ?? null);
    setFolders(f ?? []);
    setLoading(false);
  }, [supabase, router, currentFolderId]);

  useEffect(() => { load(); }, [load, currentFolderId]);

  useEffect(() => {
    if (currentFolderId && currentFolderId !== 'sample') {
      setNewProjectFolder(currentFolderId);
    } else {
      // Find Sample folder ID
      const sampleId = folders.find(f => f.name === 'Sample')?.id;
      setNewProjectFolder(sampleId || '');
    }
  }, [currentFolderId, folders]);

  const currentFolderName = currentFolderId === 'sample' ? 'Sample Folder' : 
                          folders.find(f => f.id === currentFolderId)?.name || 'All Projects';

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      // Use window.location instead of router.push for a clean slate sign-out
      window.location.href = '/login';
    } catch (e) {
      console.error('Sign out error:', e);
      window.location.href = '/login';
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from('folders').insert({ name: newFolderName.trim(), user_id: user.id });
      if (!error) {
        setNewFolderName('');
        setShowFolderModal(false);
        load();
      }
    }
    setCreatingFolder(false);
  };

  const handleMove = async () => {
    if (!moveId || !targetFolder) return;
    setMoving(true);
    const { error } = await supabase.from('projects').update({ folder_id: targetFolder }).eq('id', moveId);
    if (!error) {
      setMoveId(null);
      load();
    }
    setMoving(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from('projects').insert({ 
      name: newName.trim(), 
      genre: newGenre || null, 
      user_id: user.id,
      folder_id: newProjectFolder || null
    }).select().single();

    // If a file was uploaded, store it in localStorage for the studio page to pick up
    if (uploadFile) {
      try {
        const buf = await uploadFile.arrayBuffer();
        const bytes = new Uint8Array(buf);
        const CHUNK = 8192;
        let b64 = '';
        for (let i = 0; i < bytes.length; i += CHUNK) {
          // [FIX #6] Avoid spread operator (...) which can cause stack overflow on large buffers
          b64 += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
        }
        localStorage.setItem('melodica_midi_base64', btoa(b64));
        localStorage.setItem('melodica_midi_name', uploadFile.name);
        localStorage.setItem('melodica_upload_pending', 'true');
      } catch { /* ignore */ }
    }

    setCreating(false);
    setShowNewModal(false);
    setNewName(''); setNewGenre(''); setUploadFile(null);
    if (data) router.push(`/studio?id=${data.id}`);
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
    <div style={{ padding: 'clamp(16px, 4vw, 32px) clamp(16px, 4vw, 36px)', position: 'relative', paddingBottom: 100 }}>
      {/* Top bar with user info */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(22px, 4vw, 28px)', fontWeight: 800, marginBottom: 4 }}>
            {currentFolderName}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {profile?.display_name ? `Welcome back, ${profile.display_name}` : 'Manage your compositions and generated tracks'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setShowNewModal(true)}
            className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', borderRadius: 10 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>add</span><span className="hide-mobile">New Project</span><span className="md:hidden">New</span>
          </button>
          <button onClick={handleSignOut}
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '9px 14px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 16 }}>logout</span><span className="hide-mobile">Sign out</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: 'clamp(10px, 2vw, 16px)', marginBottom: 'clamp(20px, 3vw, 32px)' }}>
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
          <input style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, width: 'clamp(100px, 30vw, 180px)' }}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: 'clamp(12px, 2vw, 16px)', marginBottom: 32 }}>
          {filtered.map(p => {
            const color = colorFor(p.genre);
            return (
              <div key={p.id} className="glass-card card-hover" style={{ padding: '24px', cursor: 'pointer', position: 'relative' }}>
                <div style={{ background: '#05040e', borderRadius: 12, padding: '12px 16px', marginBottom: 16, display: 'flex', alignItems: 'flex-end', gap: 2, height: 60, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.02)', boxShadow: 'inset 0 0 30px rgba(0,0,0,0.8)' }}>
                  {Array.from({ length: 45 }).map((_, i) => {
                    // Unique seed for every project using its ID
                    const seed = p.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                    const wave1 = Math.sin(i * 0.35 + seed);
                    const wave2 = Math.sin(i * 0.7 + seed * 1.5);
                    const wave3 = Math.sin(i * 0.15 + seed * 0.5);
                    const combined = (wave1 * 0.5 + wave2 * 0.3 + wave3 * 0.2 + 1) / 2; 
                    const h = 10 + combined * 75;
                    
                    return (
                      <div key={i} style={{ 
                        flex: 1, borderRadius: '4px 4px 0 0', 
                        background: `linear-gradient(to top, ${color}22, ${color})`, 
                        height: `${h}%`, 
                        opacity: 0.3 + (combined * 0.7),
                        boxShadow: combined > 0.8 ? `0 0 10px ${color}40` : 'none',
                        transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }} />
                    );
                  })}
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
                  <Link href={p.midi_url ? `/studio?id=${p.id}&midi=${encodeURIComponent(p.midi_url)}` : `/studio?id=${p.id}`} style={{ flex: 1, textDecoration: 'none' }}>
                    <button style={{ width: '100%', background: `${color}22`, border: `1px solid ${color}44`, borderRadius: 8, padding: '7px 12px', cursor: 'pointer', color, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <span className="material-symbols-rounded" style={{ fontSize: 15 }}>play_arrow</span>Open
                    </button>
                  </Link>
                  <button onClick={() => { setMoveId(p.id); setTargetFolder(p.folder_id || ''); }}
                    style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 15 }}>drive_file_move</span>
                  </button>
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
                <Link href={`/studio?id=${p.id}${p.midi_url ? `&midi=${encodeURIComponent(p.midi_url)}` : ''}`} style={{ textDecoration: 'none' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'var(--text-muted)' }}>chevron_right</span>
                </Link>
                <button onClick={() => { setMoveId(p.id); setTargetFolder(p.folder_id || ''); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 18 }}>drive_file_move</span>
                </button>
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
          <div className="glass-card" style={{ width: '100%', maxWidth: 420, padding: 'clamp(24px, 4vw, 36px) clamp(20px, 4vw, 32px)', margin: '0 16px' }}>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 24 }}>New Project</h2>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Project name</label>
                <input className="input-field" placeholder="e.g. Midnight Jazz Piano" value={newName} onChange={e => setNewName(e.target.value)} required autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Folder (optional)</label>
                <select className="input-field" value={newProjectFolder} onChange={e => setNewProjectFolder(e.target.value)}
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, width: '100%', padding: '10px 14px', outline: 'none', color: 'var(--text-primary)', fontSize: 13 }}>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Genre (optional)</label>
                <select className="input-field" value={newGenre} onChange={e => setNewGenre(e.target.value)}
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, width: '100%', padding: '10px 14px', outline: 'none', color: 'var(--text-primary)', fontSize: 13 }}>
                  <option value="">Select genre…</option>
                  {['Ambient','Blues','Children','Classical','Country','Electronic','Folk','Jazz','Latin','Pop','Rap','Reggae','Religious','Rock','Soul','Soundtracks','Unknown','World'].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              {/* Upload file */}
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>
                  Upload File <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
                </label>
                <div
                  onDragOver={e => { e.preventDefault(); setUploadDragOver(true); }}
                  onDragLeave={() => setUploadDragOver(false)}
                  onDrop={e => {
                    e.preventDefault(); setUploadDragOver(false);
                    const f = e.dataTransfer.files[0];
                    if (f && /\.(mid|midi|mp3)$/i.test(f.name)) setUploadFile(f);
                  }}
                  onClick={() => uploadInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${uploadDragOver ? 'var(--accent-purple)' : uploadFile ? 'var(--accent-teal)' : 'var(--border-light)'}`,
                    borderRadius: 10, padding: '20px 16px', textAlign: 'center', cursor: 'pointer',
                    background: uploadDragOver ? 'rgba(139,92,246,0.06)' : uploadFile ? 'rgba(20,184,166,0.05)' : 'var(--bg-card)',
                    transition: 'all 0.2s',
                  }}
                >
                  <input ref={uploadInputRef} type="file" accept=".mid,.midi,.mp3" style={{ display: 'none' }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) setUploadFile(f); e.target.value = ''; }} />
                  <span className="material-symbols-rounded" style={{
                    fontSize: 28, color: uploadFile ? 'var(--accent-teal)' : 'var(--text-muted)', display: 'block', marginBottom: 6,
                  }}>
                    {uploadFile ? 'audio_file' : 'upload_file'}
                  </span>
                  {uploadFile ? (
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-teal-light)' }}>{uploadFile.name}</p>
                  ) : (
                    <>
                      <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>Drop a file or click to browse</p>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>.mid .midi .mp3</p>
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => { setShowNewModal(false); setUploadFile(null); }}
                  style={{ flex: 1, padding: '11px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 14 }}>
                  Cancel
                </button>
                <button type="submit" disabled={creating || !newName.trim()}
                  className="btn-primary" style={{ flex: 1, border: 'none', borderRadius: 10, opacity: creating || !newName.trim() ? 0.6 : 1 }}>
                  {creating ? 'Creating…' : 'Create & Open Studio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      {showFolderModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
          onClick={e => { if (e.target === e.currentTarget) setShowFolderModal(false); }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: 380, padding: 'clamp(24px, 4vw, 36px) clamp(20px, 4vw, 32px)', margin: '0 16px' }}>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 800, marginBottom: 24 }}>Create New Folder</h2>
            <form onSubmit={handleCreateFolder} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Folder Name</label>
                <input className="input-field" placeholder="e.g. Orchestral Sessions" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} required autoFocus />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setShowFolderModal(false)}
                  style={{ flex: 1, padding: '11px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 14 }}>
                  Cancel
                </button>
                <button type="submit" disabled={creatingFolder}
                  className="btn-primary" style={{ flex: 1, border: 'none', borderRadius: 10 }}>
                  {creatingFolder ? 'Creating…' : 'Create Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move Project Modal */}
      {moveId && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: 380, padding: '36px 32px' }}>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 800, marginBottom: 24 }}>Move Project</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Select Target Folder</label>
                <select className="input-field" value={targetFolder} onChange={e => setTargetFolder(e.target.value)}
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, width: '100%', padding: '10px 14px', outline: 'none', color: 'var(--text-primary)', fontSize: 13 }}>
                  {folders.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>

              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button onClick={() => setMoveId(null)}
                  style={{ flex: 1, padding: '11px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 14 }}>
                  Cancel
                </button>
                <button onClick={handleMove} disabled={moving}
                  className="btn-primary" style={{ flex: 1, border: 'none', borderRadius: 10 }}>
                  {moving ? 'Moving…' : 'Move Project'}
                </button>
              </div>
            </div>
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

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <span className="material-symbols-rounded" style={{ fontSize: 36, color: 'var(--accent-purple)', animation: 'spin 1s linear infinite' }}>progress_activity</span>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}
