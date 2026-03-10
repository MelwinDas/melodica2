'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

const navItems = [
  { icon: 'grid_view', label: 'Dashboard', href: '/dashboard' },
  { icon: 'piano', label: 'Studio', href: '/studio' },
  { icon: 'graphic_eq', label: 'Virtual Instruments', href: '/piano' },
  { icon: 'library_music', label: 'Samples Library', href: '/dashboard/library' },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

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
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${pathname.startsWith(item.href) ? 'active' : ''}`}
            >
              <span className="material-symbols-rounded" style={{ fontSize: 20 }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}

          <div style={{ marginTop: 24, marginBottom: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', paddingLeft: 16, marginBottom: 8 }}>My Folders</p>
            {[
              { label: 'Electronic', count: 12 },
              { label: 'Orchestral', count: 4 },
              { label: 'Collaborations', count: 7 },
            ].map(f => (
              <button key={f.label} className="sidebar-link" style={{ width: '100%', justifyContent: 'space-between', textAlign: 'left' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 18 }}>folder</span>
                  <span>{f.label}</span>
                </div>
                <span style={{ fontSize: 11, background: 'var(--bg-hover)', borderRadius: 6, padding: '1px 7px', color: 'var(--text-muted)' }}>{f.count}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Storage */}
        <div style={{ marginTop: 'auto' }}>
          <div style={{
            background: 'var(--bg-panel)', border: '1px solid var(--border)',
            borderRadius: 12, padding: '14px 16px'
          }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Storage Usage</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>6.5 / 10 GB</span>
            </div>
            <div style={{ background: 'var(--bg-card)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
              <div style={{ width: '65%', height: '100%', background: 'linear-gradient(90deg, var(--accent-purple) 0%, var(--accent-teal) 100%)', borderRadius: 4 }} />
            </div>
          </div>

          {/* User */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, padding: '8px 4px' }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, var(--accent-purple) 0%, var(--accent-teal) 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 700, color: 'white'
            }}>M</div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Mel W.</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pro Plan</p>
            </div>
            <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <span className="material-symbols-rounded" style={{ fontSize: 18 }}>logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
