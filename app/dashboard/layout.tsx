'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ReactNode, useState, useEffect, useCallback } from 'react';
import { createClient } from '../../lib/supabase';

interface Folder {
  id: string;
  name: string;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentFolderId = searchParams.get('folder');
  const supabase = createClient();
  
  const [folders, setFolders] = useState<Folder[]>([]);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const loadFolders = useCallback(async () => {
    const { data } = await supabase.from('folders').select('*').order('created_at', { ascending: false });
    setFolders(data ?? []);
  }, [supabase]);

  useEffect(() => { loadFolders(); }, [loadFolders]);

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
        loadFolders();
      }
    }
    setCreatingFolder(false);
  };

  const deleteFolder = async (id: string, name: string) => {
    if (!window.confirm(`Delete folder "${name}"? Projects inside will be moved to root.`)) return;
    const { error } = await supabase.from('folders').delete().eq('id', id);
    if (!error) {
      loadFolders();
      if (currentFolderId === id) window.location.href = '/dashboard';
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Sidebar */}
      <aside style={{
        width: 240, flexShrink: 0, background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', padding: '24px 16px',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto'
      }}>
        {/* Logo */}
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 36, paddingLeft: 4 }}>
          <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple)', fontSize: 26 }}>piano</span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, color: 'var(--text-primary)' }}>Melodica</span>
        </Link>

        {/* Nav */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          <Link href="/dashboard" className={`sidebar-link ${pathname === '/dashboard' && !currentFolderId ? 'active' : ''}`}>
            <span className="material-symbols-rounded" style={{ fontSize: 20 }}>grid_view</span>
            All Projects
          </Link>
          <Link href="/studio" className={`sidebar-link ${pathname === '/studio' ? 'active' : ''}`}>
            <span className="material-symbols-rounded" style={{ fontSize: 20 }}>piano</span>
            Studio
          </Link>
          <Link href="/piano" className={`sidebar-link ${pathname === '/piano' ? 'active' : ''}`}>
            <span className="material-symbols-rounded" style={{ fontSize: 20 }}>graphic_eq</span>
            Virtual Piano
          </Link>

          <div style={{ marginTop: 24, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 8, marginBottom: 8 }}>
              <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', paddingLeft: 16 }}>My Folders</p>
              <button 
                onClick={() => setShowFolderModal(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }} 
                title="New Folder"
              >
                <span className="material-symbols-rounded" style={{ fontSize: 16 }}>add_circle</span>
              </button>
            </div>
            
            {/* Fixed Sample Folder */}
            <Link href="/dashboard?folder=sample" className={`sidebar-link ${pathname === '/dashboard' && currentFolderId === 'sample' ? 'active' : ''}`} style={{ width: '100%', textDecoration: 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--accent-teal)' }}>folder_special</span>
                <span style={{ fontWeight: 600 }}>Sample</span>
              </div>
            </Link>

            {/* User Folders */}
            {folders.map(f => (
              <div key={f.id} style={{ position: 'relative' }} className="folder-item-container">
                <Link href={`/dashboard?folder=${f.id}`} className={`sidebar-link ${pathname === '/dashboard' && currentFolderId === f.id ? 'active' : ''}`} style={{ width: '100%', textDecoration: 'none', paddingRight: 32 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 18 }}>folder</span>
                    <span>{f.name}</span>
                  </div>
                </Link>
                <button 
                  onClick={(e) => { e.preventDefault(); deleteFolder(f.id, f.name); }}
                  className="folder-delete-btn"
                  style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 4, borderRadius: 4, transition: 'all 0.2s', zIndex: 5
                  }}
                >
                  <span className="material-symbols-rounded" style={{ fontSize: 14 }}>close</span>
                </button>
              </div>
            ))}
          </div>
        </nav>

        {/* Storage & User info */}
        <div style={{ marginTop: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-teal) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'white' }}>U</div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>User</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Free Plan</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Folder Creation Modal */}
      {showFolderModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
          onClick={e => { if (e.target === e.currentTarget) setShowFolderModal(false); }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: 360, padding: '32px' }}>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 800, marginBottom: 20 }}>New Folder</h3>
            <form onSubmit={handleCreateFolder} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <input className="input-field" placeholder="Folder Name" value={newFolderName} onChange={e => setNewFolderName(e.target.value)} required autoFocus />
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setShowFolderModal(false)} className="btn-secondary" style={{ flex: 1, padding: '10px', borderRadius: 8 }}>Cancel</button>
                <button type="submit" disabled={creatingFolder} className="btn-primary" style={{ flex: 1, border: 'none', borderRadius: 8 }}>
                  {creatingFolder ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
