'use client';
import Link from 'next/link';
import { useState } from 'react';

export default function LandingPage() {
  const [popover, setPopover] = useState<string | null>(null);

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

  return (
    <div className="hero-gradient min-h-screen">
      {/* Navbar */}
      <nav style={{ borderBottom: '1px solid var(--border)' }} className="glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple)', fontSize: 28 }}>piano</span>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, color: 'var(--text-primary)' }}>Melodica</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {['Home', 'Studio', 'Piano', 'Contact Us'].map((item) => (
              <Link
                key={item}
                href={item === 'Home' ? '/' : item === 'Studio' ? '/studio' : item === 'Piano' ? '/piano' : '#'}
                style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 500, textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
              >
                {item}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="btn-secondary" style={{ padding: '9px 20px', fontSize: 13 }}>Log in</Link>
            <Link href="/signup" className="btn-primary" style={{ padding: '9px 20px', fontSize: 13 }}>Get Started</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-28 pb-20 text-center">
        <div className="badge mb-6 inline-block">✦ Powered by Advanced AI</div>
        <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(42px, 6vw, 80px)', fontWeight: 800, lineHeight: 1.05, marginBottom: 24 }}>
          AI That Understands<br />
          <span className="gradient-text">the Soul of Music</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 18, maxWidth: 580, margin: '0 auto 40px', lineHeight: 1.7 }}>
          Experience the future of music generation and editing with Melodica. Create, edit, and transcribe effortlessly with an intuitive AI copilot.
        </p>
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/signup" className="btn-primary" style={{ fontSize: 16, padding: '14px 36px' }}>Start Creating Free</Link>
          <Link href="/studio" className="btn-secondary" style={{ fontSize: 16, padding: '14px 36px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 20 }}>play_circle</span>
            Watch Demo
          </Link>
        </div>

        {/* Hero visual */}
        <div className="relative mt-20 mx-auto" style={{ maxWidth: 900 }}>
          <div className="glass-card p-6 overflow-hidden" style={{ borderRadius: 24, border: '1px solid var(--border-light)' }}>
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
                          width: 2, borderRadius: 1, flexShrink: 0,
                          background: track.color,
                          height: `${20 + Math.sin(j * 0.8 + i) * 14}px`,
                          opacity: 0.8
                        }} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Playback controls */}
            <div className="flex items-center justify-center gap-4 mt-4">
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
              <div style={{ marginLeft: 16, display: 'flex', alignItems: 'center', gap: 3, height: 24 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="wave-bar" style={{
                    height: `${10 + Math.sin(i * 0.9) * 8}px`,
                    animationDelay: `${i * 0.15}s`
                  }} />
                ))}
              </div>
              <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>1:24 / 3:47</span>
            </div>
          </div>
          {/* Glow orbs */}
          <div style={{
            position: 'absolute', top: -60, left: -60, width: 200, height: 200,
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.2) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />
          <div style={{
            position: 'absolute', bottom: -40, right: -40, width: 160, height: 160,
            borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.15) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 700, marginBottom: 16 }}>
            Unleash Your <span className="gradient-text">Musical Creativity</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 17, maxWidth: 520, margin: '0 auto' }}>
            Discover the powerful tools that make Melodica the ultimate platform for musicians, producers, and creators.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className="glass-card card-hover p-8" style={{ cursor: 'default' }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14,
                background: `${f.color}22`,
                border: `1px solid ${f.color}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20
              }}>
                <span className="material-symbols-rounded" style={{ fontSize: 28, color: f.color }}>{f.icon}</span>
              </div>
              <h3 style={{ fontSize: 19, fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)' }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="glass-card p-16 text-center" style={{
          background: 'linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(20,184,166,0.08) 100%)',
          border: '1px solid var(--border-light)'
        }}>
          <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 700, marginBottom: 16 }}>
            Ready to Compose Your <span className="gradient-text">Masterpiece?</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 17, marginBottom: 36 }}>
            Join thousands of musicians, producers, and creators already using Melodica to elevate their sound.
          </p>
          <Link href="/signup" className="btn-primary" style={{ fontSize: 16, padding: '14px 44px' }}>Get Started – It's Free</Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '32px 24px' }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple)', fontSize: 22 }}>piano</span>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Melodica</span>
            <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--text-muted)' }}>© 2024 Melodica AI. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6 relative">
            {['Privacy Policy', 'Terms of Service', 'Help Center'].map((item) => (
              <div key={item} style={{ position: 'relative' }}>
                <button
                  onClick={() => setPopover(popover === item ? null : item)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
                  onMouseLeave={e => { if (popover !== item) e.currentTarget.style.color = 'var(--text-muted)'; }}
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
                      {item === 'Help Center' && 'Need help? Email us at support@melodica.ai or visit our docs.'}
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
