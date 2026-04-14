'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    router.push('/dashboard');
  };

  return (
    <div className="hero-gradient min-h-screen flex flex-col items-center justify-center px-4" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '10%', left: '10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40 }}>
        <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple)', fontSize: 32 }}>piano</span>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 26, color: 'var(--text-primary)' }}>Melodica</span>
      </Link>

      <div className="glass-card" style={{ width: '100%', maxWidth: 440, padding: '40px 36px' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 800, marginBottom: 8 }}>Welcome Back</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>The rhythm is waiting. Sign in to your account.</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', color: '#f87171', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>error</span>
              {error}
            </div>
          )}

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Email address</label>
            <input id="login-email" type="email" className="input-field" placeholder="you@example.com"
              value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Password</label>
            </div>
            <div style={{ position: 'relative' }}>
              <input id="login-password" type={showPass ? 'text' : 'password'} className="input-field"
                placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
                style={{ paddingRight: 44 }} required />
              <button type="button" onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 20 }}>{showPass ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>

          <button id="login-submit" type="submit" disabled={loading}
            className="btn-primary" style={{ textAlign: 'center', marginTop: 8, fontSize: 15, padding: '13px', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none' }}>
            {loading ? (
              <><span className="material-symbols-rounded" style={{ fontSize: 18, animation: 'spin 1s linear infinite' }}>progress_activity</span>Signing in…</>
            ) : 'Sign In'}
          </button>
        </form>

        <p style={{ marginTop: 28, textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
          New to Melodica?{' '}
          <Link href="/signup" style={{ color: 'var(--accent-purple-light)', textDecoration: 'none', fontWeight: 600 }}>Create an account</Link>
        </p>
      </div>

      <p style={{ marginTop: 28, fontSize: 12, color: 'var(--text-muted)' }}>© 2026 Melodica Music Inc.</p>
    </div>
  );
}
