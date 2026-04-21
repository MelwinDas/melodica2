'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { createClient } from '../lib/supabase';

export default function LandingPage() {
  const supabase = createClient();
  const [popover, setPopover] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, [supabase]);

  const features = [
    {
      icon: 'auto_awesome',
      title: 'AI Music Generation',
      desc: 'Generate unique tracks across any genre by simply describing the mood, tempo, or style. Let AI build the foundation of your next hit.',
      color: 'var(--accent-purple)',
    },
    {
      icon: 'tune',
      title: 'Advanced DAW Editing',
      desc: 'Edit and refine your generated tracks with our intuitive, browser-based Digital Audio Workstation. Tweak every note and effect.',
      color: 'var(--accent-teal)',
    },
    {
      icon: 'music_note',
      title: 'Instant Transcription',
      desc: 'Upload any audio file and watch it convert into accurate sheet music or MIDI instantly. Perfect for learning, covering, and sharing.',
      color: 'var(--accent-pink)',
    },
  ];

  const navItems = [
    { label: 'Home', href: '/' },
    { label: 'Studio', href: user ? '/dashboard' : '/login' },
    { label: 'Piano', href: user ? '/piano' : '/login' },
    { label: 'Contact Us', href: '/contact' },
  ];

  return (
    <div className="hero-gradient min-h-screen" style={{ paddingBottom: 80 }}>
      {/* Navbar */}
      <nav style={{ borderBottom: '1px solid var(--border)' }} className="glass sticky top-0 z-50">
        <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple)', fontSize: 28 }}>piano</span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, color: 'var(--text-primary)' }}>Melodica</span>
          </div>

          {/* Desktop nav links — hidden on mobile */}
          <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => (e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Desktop auth buttons — hidden on mobile */}
          <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link href="/login" className="btn-secondary" style={{ padding: '9px 20px', fontSize: 13 }}>Log in</Link>
            <Link href="/signup" className="btn-primary" style={{ padding: '9px 20px', fontSize: 13 }}>Get Started</Link>
          </div>

          {/* Mobile hamburger — hidden on desktop */}
          <button
            className="hamburger-btn show-mobile"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <span className="material-symbols-rounded" style={{ fontSize: 28 }}>
              {mobileMenuOpen ? 'close' : 'menu'}
            </span>
          </button>
        </div>

        {/* Mobile dropdown menu — only rendered when open on mobile */}
        {mobileMenuOpen && (
          <div
            className="show-mobile"
            style={{
              background: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border)',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              animation: 'fadeIn 0.2s ease',
            }}
          >
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  color: 'var(--text-secondary)', fontSize: 15, fontWeight: 500,
                  textDecoration: 'none', padding: '12px 16px', borderRadius: 10,
                  transition: 'all 0.2s', display: 'block',
                }}
              >
                {item.label}
              </Link>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <Link href="/login" className="btn-secondary" style={{ flex: 1, textAlign: 'center', padding: '12px 16px', fontSize: 14 }}>Log in</Link>
              <Link href="/signup" className="btn-primary" style={{ flex: 1, textAlign: 'center', padding: '12px 16px', fontSize: 14 }}>Get Started</Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section style={{ paddingTop: 'clamp(40px, 10vw, 120px)', paddingBottom: 'clamp(40px, 6vw, 80px)' }}>
        <div className="page-container" style={{ textAlign: 'center' }}>
          <div className="badge mb-6 inline-block">✦ Powered by Advanced AI</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(32px, 6vw, 80px)', fontWeight: 800, lineHeight: 1.05, marginBottom: 24 }}>
            AI That Understands<br />
            <span className="gradient-text">the Soul of Music</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'clamp(15px, 3vw, 18px)', maxWidth: 560, margin: '0 auto 40px', lineHeight: 1.7, padding: '0 8px' }}>
            Experience the future of music generation and editing with Melodica. Create, edit, and transcribe effortlessly with an intuitive AI engine.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexWrap: 'wrap', padding: '0 16px' }}>
            <Link href="/signup" className="btn-primary" style={{ fontSize: 'clamp(14px, 2.5vw, 16px)', padding: '14px 28px', width: '100%', maxWidth: 260, textAlign: 'center' }}>Start Creating Free</Link>
            <Link href={user ? "/dashboard" : "/login"} className="btn-secondary" style={{ fontSize: 'clamp(14px, 2.5vw, 16px)', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', maxWidth: 260 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 20 }}>play_circle</span>
              Open Studio
            </Link>
          </div>

        {/* Hero visual */}
        <div className="relative hide-mobile" style={{ maxWidth: 900, margin: '80px auto 0' }}>
          <div className="glass-card p-6 overflow-hidden" style={{ borderRadius: 24, border: '1px solid var(--border-light)', textAlign: 'left' }}>
            {/* Mini DAW preview */}
            <div className="flex gap-3 mb-4">
              {['#ff5f57','#febc2e','#28c840'].map(c => (
                <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
              ))}
              <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)' }}>Neon Nights Synthwave.melodica</span>
            </div>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 12, padding: '20px 16px', display: 'grid', gap: 10 }}>
              {[
                { name: 'Synth Lead', color: '#8b5cf6', w: '72%' },
                { name: 'Bass Line', color: '#14b8a6', w: '55%' },
                { name: 'Drums', color: '#ec4899', w: '85%' },
                { name: 'Pads', color: '#f59e0b', w: '40%' },
              ].map((track, i) => (
                <div key={track.name} className="flex items-center gap-4">
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 70, textAlign: 'right', flexShrink: 0 }}>{track.name}</span>
                  <div style={{ flex: 1, height: 28, background: 'var(--bg-card)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0,
                      width: track.w,
                      background: `linear-gradient(90deg, ${track.color}88 0%, ${track.color}44 100%)`,
                      borderRadius: 4,
                      display: 'flex', alignItems: 'center', gap: 2, padding: '0 8px'
                    }}>
                      {Array.from({ length: 18 }).map((_, j) => (
                        <div key={j} style={{
                          width: '2px', borderRadius: '1px', flexShrink: 0,
                          background: track.color,
                          height: `${Math.round(20 + Math.sin(j * 0.8 + i) * 14)}px`,
                          opacity: 0.8
                        }} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Playback controls */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', marginTop: 16 }}>
              <div /> {/* Left spacer */}
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 24 }}>skip_previous</span>
                </button>
                <button style={{
                  background: 'linear-gradient(135deg, var(--accent-purple) 0%, #6d28d9 100%)',
                  border: 'none', borderRadius: '50%', width: 48, height: 48,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', boxShadow: '0 4px 20px rgba(139,92,246,0.4)'
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 24, color: 'white' }}>play_arrow</span>
                </button>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 24 }}>skip_next</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 24 }}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="wave-bar" style={{
                      height: `${10 + Math.sin(i * 0.9) * 8}px`,
                      animationDelay: `${i * 0.15}s`
                    }} />
                  ))}
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>1:24 / 3:47</span>
              </div>
            </div>
          </div>
          {/* Glow orbs */}
          <div style={{
            position: 'absolute', top: -60, left: -60, width: 220, height: 220,
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.22) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />
          <div style={{
            position: 'absolute', bottom: -40, right: -40, width: 180, height: 180,
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.18) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />
        </div>

        {/* Mobile hero visual — simplified waveform card */}
        <div className="md:hidden" style={{ maxWidth: 400, margin: '40px auto 0', padding: '0 8px' }}>
          <div className="glass-card" style={{ borderRadius: 18, padding: '20px', textAlign: 'left' }}>
            <div className="flex gap-2 mb-3">
              {['#ff5f57','#febc2e','#28c840'].map(c => (
                <div key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
              ))}
              <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-muted)' }}>Neon Nights.melodica</span>
            </div>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 10, padding: '14px 12px', display: 'grid', gap: 6 }}>
              {[
                { name: 'Lead', color: '#8b5cf6', w: '72%' },
                { name: 'Bass', color: '#14b8a6', w: '55%' },
                { name: 'Drums', color: '#ec4899', w: '85%' },
              ].map((track, i) => (
                <div key={track.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', width: 32, textAlign: 'right', flexShrink: 0 }}>{track.name}</span>
                  <div style={{ flex: 1, height: 20, background: 'var(--bg-card)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0, width: track.w,
                      background: `linear-gradient(90deg, ${track.color}88, ${track.color}44)`,
                      borderRadius: 3,
                    }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 12 }}>
              <button style={{
                background: 'linear-gradient(135deg, var(--accent-purple), #6d28d9)',
                border: 'none', borderRadius: '50%', width: 36, height: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 4px 16px rgba(139,92,246,0.4)'
              }}>
                <span className="material-symbols-rounded" style={{ fontSize: 20, color: 'white' }}>play_arrow</span>
              </button>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>1:24 / 3:47</span>
            </div>
          </div>
        </div>

        </div> {/* page-container */}
      </section>

      {/* Features */}
      <section style={{ paddingTop: 'clamp(40px, 8vw, 80px)', paddingBottom: 'clamp(40px, 8vw, 80px)' }}>
        <div className="page-container">
          <div style={{ textAlign: 'center', marginBottom: 'clamp(32px, 6vw, 56px)' }}>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(24px, 4vw, 48px)', fontWeight: 700, marginBottom: 16 }}>
              Unleash Your <span className="gradient-text">Musical Creativity</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'clamp(14px, 2.5vw, 17px)', maxWidth: 520, margin: '0 auto', padding: '0 8px' }}>
              Discover the powerful tools that make Melodica the ultimate platform for musicians, producers, and creators.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 'clamp(16px, 3vw, 24px)' }}>
            {features.map((f) => (
              <div key={f.title} className="glass-card card-hover" style={{ padding: 'clamp(24px, 4vw, 32px)', cursor: 'default' }}>
                <div style={{
                  width: 'clamp(44px, 6vw, 56px)', height: 'clamp(44px, 6vw, 56px)', borderRadius: 14,
                  background: `${f.color}22`,
                  border: `1px solid ${f.color}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 20
                }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 'clamp(22px, 3vw, 28px)', color: f.color }}>{f.icon}</span>
                </div>
                <h3 style={{ fontSize: 'clamp(16px, 2.5vw, 19px)', fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)' }}>{f.title}</h3>
                <p style={{ fontSize: 'clamp(13px, 2vw, 14px)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ paddingBottom: 'clamp(40px, 8vw, 80px)' }}>
        <div className="page-container">
          <div className="glass-card" style={{
            padding: 'clamp(32px, 6vw, 80px)', textAlign: 'center',
            background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(20,184,166,0.08) 100%)',
            border: '1px solid var(--border-light)'
          }}>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(22px, 4vw, 44px)', fontWeight: 700, marginBottom: 16 }}>
              Ready to Compose Your <span className="gradient-text">Masterpiece?</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'clamp(14px, 2.5vw, 17px)', marginBottom: 36, maxWidth: 560, margin: '0 auto 28px', padding: '0 8px' }}>
              Join thousands of musicians, producers, and creators already using Melodica to elevate their sound.
            </p>
            <Link href="/signup" className="btn-primary" style={{ fontSize: 'clamp(14px, 2.5vw, 16px)', padding: '14px 36px' }}>Get Started – It&apos;s Free</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '28px 0' }}>
        <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple)', fontSize: 22 }}>piano</span>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Melodica</span>
            <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--text-muted)' }}>© 2026 Melodica AI. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 relative" style={{ flexWrap: 'wrap' }}>
            {['Privacy Policy', 'Terms of Service', 'Help Center'].map((item) => (
              <div key={item} style={{ position: 'relative' }}>
                <button
                  onClick={() => setPopover(popover === item ? null : item)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, transition: 'color 0.2s' }}
                  onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { if (popover !== item) e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  {item}
                </button>
                {popover === item && (
                  <div style={{
                    position: 'absolute', bottom: '120%', left: '50%', transform: 'translateX(-50%)',
                    background: 'var(--bg-card)', border: '1px solid var(--border-light)',
                    borderRadius: 10, padding: '12px 16px', minWidth: 200, zIndex: 100,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                  }}>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {item === 'Privacy Policy' && 'We collect minimal data and never sell your information to third parties.'}
                      {item === 'Terms of Service' && 'By using Melodica you agree to our terms. Music you create remains yours.'}
                      {item === 'Help Center' && 'Need help? Email us at melodica621@gmail.com or visit our docs.'}
                    </p>
                    <button onClick={() => setPopover(null)} style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 11 }}>Dismiss</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
