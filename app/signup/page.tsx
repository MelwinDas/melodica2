'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../lib/supabase';

export default function SignUpPage() {
  const router = useRouter();
  const supabase = createClient();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed) { setError('Please accept the Terms of Service.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: `${firstName} ${lastName}`.trim() } },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSuccess(true);
  };

  if (success) return (
    <div className="hero-gradient min-h-screen flex flex-col items-center justify-center px-4">
      <div className="glass-card" style={{ width: '100%', maxWidth: 420, padding: '48px 40px', textAlign: 'center' }}>
        <span className="material-symbols-rounded" style={{ fontSize: 56, color: 'var(--accent-teal)', display: 'block', marginBottom: 16 }}>mark_email_read</span>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Check your inbox</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.7 }}>
          We sent a confirmation link to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>. Click it to activate your account.
        </p>
        <Link href="/login" className="btn-primary" style={{ display: 'block', marginTop: 28, fontSize: 15, padding: '13px', textAlign: 'center', textDecoration: 'none' }}>
          Back to Sign In
        </Link>
      </div>
    </div>
  );

  return (
    <div className="hero-gradient min-h-screen flex flex-col items-center justify-center px-4" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '5%', right: '15%', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '5%', left: '10%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40 }}>
        <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple)', fontSize: 32 }}>piano</span>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 26, color: 'var(--text-primary)' }}>Melodica</span>
      </Link>

      <div className="glass-card" style={{ width: '100%', maxWidth: 460, padding: '40px 36px' }}>
        <div style={{ marginBottom: 32 }}>
          <div className="badge badge-teal" style={{ marginBottom: 12 }}>Free Forever Plan Available</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 800, marginBottom: 8 }}>Create account</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Join the future of high-fidelity music creation.</p>
        </div>

        <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', color: '#f87171', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 16 }}>error</span>{error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>First name</label>
              <input id="signup-first-name" type="text" className="input-field" placeholder="Alex" value={firstName} onChange={e => setFirstName(e.target.value)} required />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Last name</label>
              <input id="signup-last-name" type="text" className="input-field" placeholder="Kim" value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Email address</label>
            <input id="signup-email" type="email" className="input-field" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>

          <div>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input id="signup-password" type={showPass ? 'text' : 'password'} className="input-field"
                placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)}
                style={{ paddingRight: 44 }} required />
              <button type="button" onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 20 }}>{showPass ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
            <div onClick={() => setAgreed(!agreed)} style={{
              width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1,
              background: agreed ? 'var(--accent-purple)' : 'var(--bg-card)',
              border: `2px solid ${agreed ? 'var(--accent-purple)' : 'var(--border-light)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
            }}>
              {agreed && <span className="material-symbols-rounded" style={{ fontSize: 13, color: 'white' }}>check</span>}
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              I agree to Melodica&apos;s{' '}
              <span style={{ color: 'var(--accent-purple-light)' }}>Terms of Service</span>{' '}and{' '}
              <span style={{ color: 'var(--accent-purple-light)' }}>Privacy Policy</span>.
            </span>
          </label>

          <button id="signup-submit" type="submit" disabled={loading || !agreed}
            className="btn-primary"
            style={{ marginTop: 8, fontSize: 15, padding: '13px', opacity: (!agreed || loading) ? 0.6 : 1, cursor: (!agreed || loading) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none' }}>
            {loading ? (
              <><span className="material-symbols-rounded" style={{ fontSize: 18, animation: 'spin 1s linear infinite' }}>progress_activity</span>Creating account…</>
            ) : 'Create Free Account'}
          </button>
        </form>

        <p style={{ marginTop: 28, textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--accent-purple-light)', textDecoration: 'none', fontWeight: 600 }}>Log in</Link>
        </p>
      </div>

      <div className="flex items-center gap-6 mt-8">
        {['About', 'Privacy', 'Terms'].map(item => (
          <button key={item} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted)', transition: 'color 0.2s' }}>{item}</button>
        ))}
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>© 2024 Melodica Music Inc.</span>
      </div>
    </div>
  );
}
