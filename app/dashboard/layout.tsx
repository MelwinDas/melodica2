'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ReactNode, useState, useEffect, useCallback, Suspense } from 'react';
import { createClient } from '../../lib/supabase';

interface Folder {
  id: string;
  name: string;
}

function DashboardLayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentFolderId = searchParams.get('folder');
  const supabase = createClient();
  
  const [folders, setFolders] = useState<Folder[]>([]);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name: string; email: string } | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const loadFolders = useCallback(async () => {
    const { data } = await supabase.from('folders').select('*').order('created_at', { ascending: false });
    setFolders(data ?? []);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserProfile({
        name: user.user_metadata.full_name || user.email?.split('@')[0] || 'User',
        email: user.email || ''
      });
    }
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
    const sampleFolder = folders.find(f => f.name === 'Sample');
    if (!sampleFolder) return;
    if (id === sampleFolder.id) return;

    if (!window.confirm(`Delete folder "${name}"? All projects inside will also be deleted PERMANENTLY.`)) return;
    
    // Delete projects first
    await supabase.from('projects').delete().eq('folder_id', id);
    
    // Delete the folder
    const { error } = await supabase.from('folders').delete().eq('id', id);
    if (!error) {
      loadFolders();
      window.location.reload(); 
    }
  };

  /* Shared sidebar content, used for both desktop sidebar and mobile drawer */
  const SidebarContent = () => (
    <>
      {/* Logo */}
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 36, paddingLeft: 4 }}
        onClick={() => setMobileDrawerOpen(false)}
      >
        <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple)', fontSize: 26 }}>piano</span>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 20, color: 'var(--text-primary)' }}>Melodica</span>
      </Link>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        <Link href="/dashboard" className={`sidebar-link ${pathname === '/dashboard' && !currentFolderId ? 'active' : ''}`}
          onClick={() => setMobileDrawerOpen(false)}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 20 }}>grid_view</span>
          All Projects
        </Link>
        <Link href="/studio" className={`sidebar-link ${pathname === '/studio' ? 'active' : ''}`}
          onClick={() => setMobileDrawerOpen(false)}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 20 }}>piano</span>
          Studio
        </Link>
        <Link href="/piano" className={`sidebar-link ${pathname === '/piano' ? 'active' : ''}`}
          onClick={() => setMobileDrawerOpen(false)}
        >
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
          {folders.find(f => f.name === 'Sample') && (
            <Link 
              href={`/dashboard?folder=${folders.find(f => f.name === 'Sample')?.id}`} 
              className={`sidebar-link ${currentFolderId === folders.find(f => f.name === 'Sample')?.id ? 'active' : ''}`} 
              style={{ width: '100%', textDecoration: 'none' }}
              onClick={() => setMobileDrawerOpen(false)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="material-symbols-rounded" style={{ fontSize: 18, color: 'var(--accent-teal)' }}>folder_special</span>
                <span style={{ fontWeight: 600 }}>Sample</span>
              </div>
            </Link>
          )}

          {/* User Folders */}
          {folders.filter(f => f.name !== 'Sample').map(f => (
            <div key={f.id} style={{ position: 'relative' }} className="folder-item-container">
              <Link href={`/dashboard?folder=${f.id}`} className={`sidebar-link ${pathname === '/dashboard' && currentFolderId === f.id ? 'active' : ''}`} style={{ width: '100%', textDecoration: 'none', paddingRight: 32 }}
                onClick={() => setMobileDrawerOpen(false)}
              >
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
          <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-teal) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'white' }}>
            {userProfile?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {userProfile?.name || 'User'}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Free Plan</p>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>

      {/* ── Mobile Top Bar ─────────────────────────────────────────── */}
      <div className="mobile-top-bar">
        <button className="hamburger-btn" onClick={() => setMobileDrawerOpen(true)} aria-label="Open sidebar">
          <span className="material-symbols-rounded" style={{ fontSize: 24 }}>menu</span>
        </button>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple)', fontSize: 22 }}>piano</span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>Melodica</span>
        </Link>
        <div style={{ flex: 1 }} />
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-teal) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'white' }}>
          {userProfile?.name?.charAt(0).toUpperCase() || 'U'}
        </div>
      </div>

      {/* ── Mobile Drawer Overlay ──────────────────────────────────── */}
      <div
        className={`mobile-drawer-overlay ${mobileDrawerOpen ? 'open' : ''}`}
        onClick={() => setMobileDrawerOpen(false)}
      />

      {/* ── Mobile Drawer ─────────────────────────────────────────── */}
      <aside className={`mobile-drawer ${mobileDrawerOpen ? 'open' : ''}`}
        style={{ padding: '24px 16px' }}
      >
        <button
          className="hamburger-btn"
          onClick={() => setMobileDrawerOpen(false)}
          style={{ alignSelf: 'flex-end', marginBottom: 8 }}
          aria-label="Close sidebar"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 24 }}>close</span>
        </button>
        <SidebarContent />
      </aside>

      {/* ── Desktop Sidebar ───────────────────────────────────────── */}
      <aside className="hide-mobile" style={{
        width: 240, flexShrink: 0, background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', padding: '24px 16px',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto'
      }}>
        <SidebarContent />
      </aside>

      {/* Folder Creation Modal */}
      {showFolderModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}
          onClick={e => { if (e.target === e.currentTarget) setShowFolderModal(false); }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: 360, padding: '32px', margin: '0 16px' }}>
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

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-primary)' }}>
        <span className="material-symbols-rounded" style={{ fontSize: 36, color: 'var(--accent-purple)', animation: 'spin 1s linear infinite' }}>progress_activity</span>
      </div>
    }>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </Suspense>
  );
}
