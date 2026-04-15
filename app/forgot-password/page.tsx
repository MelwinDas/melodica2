'use client';
import Link from 'next/link';
import { useState } from 'react';
import { createClient } from '../../lib/supabase';

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSuccess(true);
  };

  return (
    <div className="hero-gradient min-h-screen flex flex-col items-center justify-center px-4" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '10%', right: '10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      
      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40 }}>
        <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple)', fontSize: 32 }}>piano</span>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 26, color: 'var(--text-primary)' }}>Melodica</span>
      </Link>

      <div className="glass-card" style={{ width: '100%', maxWidth: 440, padding: '40px 36px' }}>
        {success ? (
          <div style={{ textAlign: 'center' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 56, color: 'var(--accent-teal)', display: 'block', marginBottom: 16 }}>mail</span>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Check your email</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.7 }}>
              We've sent a password reset link to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
            </p>
            <Link href="/login" className="btn-primary" style={{ display: 'block', marginTop: 28, fontSize: 15, padding: '13px', textAlign: 'center', textDecoration: 'none', border: 'none' }}>
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 32 }}>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 800, marginBottom: 8 }}>Reset Password</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Enter your email and we'll send you a link to reset your password.</p>
            </div>

            <form onSubmit={handleResetRequest} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', color: '#f87171', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 16 }}>error</span>
                  {error}
                </div>
              )}

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Email address</label>
                <input id="reset-email" type="email" className="input-field" placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)} required />
              </div>

              <button id="reset-submit" type="submit" disabled={loading}
                className="btn-primary" style={{ textAlign: 'center', marginTop: 8, fontSize: 15, padding: '13px', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none' }}>
                {loading ? (
                  <><span className="material-symbols-rounded" style={{ fontSize: 18, animation: 'spin 1s linear infinite' }}>progress_activity</span>Sending link…</>
                ) : 'Send Reset Link'}
              </button>
            </form>

            <p style={{ marginTop: 28, textAlign: 'center', fontSize: 14, color: 'var(--text-secondary)' }}>
              Remembered your password?{' '}
              <Link href="/login" style={{ color: 'var(--accent-purple-light)', textDecoration: 'none', fontWeight: 600 }}>Log in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
