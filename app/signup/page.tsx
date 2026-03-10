'use client';
import Link from 'next/link';
import { useState } from 'react';

export default function SignUpPage() {
  const [agreed, setAgreed] = useState(false);
  const [showPass, setShowPass] = useState(false);

  return (
    <div className="hero-gradient min-h-screen flex flex-col items-center justify-center px-4" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Background orbs */}
      <div style={{ position: 'absolute', top: '5%', right: '15%', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '5%', left: '10%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      {/* Logo */}
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40 }}>
        <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple)', fontSize: 32 }}>piano</span>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 26, color: 'var(--text-primary)' }}>Melodica</span>
      </Link>

      {/* Card */}
      <div className="glass-card" style={{ width: '100%', maxWidth: 460, padding: '40px 36px' }}>
        <div style={{ marginBottom: 32 }}>
          <div className="badge badge-teal" style={{ marginBottom: 12 }}>Free Forever Plan Available</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 800, marginBottom: 8 }}>Create account</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Join the future of high-fidelity music streaming.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>First name</label>
              <input id="signup-first-name" type="text" className="input-field" placeholder="Alex" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Last name</label>
              <input id="signup-last-name" type="text" className="input-field" placeholder="Kim" />
            </div>
          </div>

          {/* Email */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Email address</label>
            <input id="signup-email" type="email" className="input-field" placeholder="you@example.com" />
          </div>

          {/* Password */}
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input id="signup-password" type={showPass ? 'text' : 'password'} className="input-field" placeholder="Min. 8 characters" style={{ paddingRight: 44 }} />
              <button
                onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                <span className="material-symbols-rounded" style={{ fontSize: 20 }}>{showPass ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>

          {/* Terms checkbox */}
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
            <div
              onClick={() => setAgreed(!agreed)}
              style={{
                width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
                background: agreed ? 'var(--accent-purple)' : 'var(--bg-card)',
                border: `2px solid ${agreed ? 'var(--accent-purple)' : 'var(--border-light)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s'
              }}
            >
              {agreed && <span className="material-symbols-rounded" style={{ fontSize: 13, color: 'white' }}>check</span>}
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              I agree to Melodica's{' '}
              <span style={{ color: 'var(--accent-purple-light)', cursor: 'pointer' }}>Terms of Service</span>
              {' '}and{' '}
              <span style={{ color: 'var(--accent-purple-light)', cursor: 'pointer' }}>Privacy Policy</span>.
            </span>
          </label>

          {/* Submit */}
          <Link
            href="/dashboard"
            id="signup-submit"
            className="btn-primary"
            style={{ textAlign: 'center', marginTop: 8, fontSize: 15, padding: '13px', opacity: agreed ? 1 : 0.6, pointerEvents: agreed ? 'auto' : 'none' }}
          >
            Create Free Account
          </Link>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <hr className="divider flex-1" />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>or</span>
            <hr className="divider flex-1" />
          </div>

          {/* Google */}
          <button id="signup-google" style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-light)',
            borderRadius: 10, padding: '12px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            color: 'var(--text-primary)', fontSize: 14, fontWeight: 500, transition: 'all 0.2s'
          }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent-purple)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-light)')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>
        </div>

        <p style={{ marginTop: 28, textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--accent-purple-light)', textDecoration: 'none', fontWeight: 600 }}>Log in</Link>
        </p>
      </div>

      <div className="flex items-center gap-6 mt-8">
        {['About', 'Privacy', 'Terms'].map(item => (
          <button key={item} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
          >{item}</button>
        ))}
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>© 2024 Melodica Music Inc.</span>
      </div>
    </div>
  );
}
