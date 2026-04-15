'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '../../lib/supabase';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Check if session exists (user clicked the reset link)
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // If no session, it might be an invalid or expired link
        // However, some versions of Supabase might hold the session in URL fragment
        // So we wait a bit or rely on updateUser failing later if unauthorized
      }
    };
    checkSession();
  }, [supabase]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords don't match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    
    setSuccess(true);
    setTimeout(() => {
      router.push('/login');
    }, 3000);
  };

  return (
    <div className="hero-gradient min-h-screen flex flex-col items-center justify-center px-4" style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', bottom: '10%', left: '10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40 }}>
        <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple)', fontSize: 32 }}>piano</span>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 26, color: 'var(--text-primary)' }}>Melodica</span>
      </Link>

      <div className="glass-card" style={{ width: '100%', maxWidth: 440, padding: '40px 36px' }}>
        {success ? (
          <div style={{ textAlign: 'center' }}>
            <span className="material-symbols-rounded" style={{ fontSize: 56, color: 'var(--accent-teal)', display: 'block', marginBottom: 16 }}>check_circle</span>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 12 }}>Password Updated</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.7 }}>
              Your password has been reset successfully. Redirecting you to login...
            </p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 32 }}>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 800, marginBottom: 8 }}>Set New Password</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Please enter your new password below.</p>
            </div>

            <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', color: '#f87171', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 16 }}>error</span>
                  {error}
                </div>
              )}

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <input id="new-password" type={showPass ? 'text' : 'password'} className="input-field"
                    placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)}
                    style={{ paddingRight: 44 }} required />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 20 }}>{showPass ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Confirm New Password</label>
                <input id="confirm-password" type={showPass ? 'text' : 'password'} className="input-field"
                  placeholder="Repeat new password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
              </div>

              <button id="reset-submit" type="submit" disabled={loading}
                className="btn-primary" style={{ textAlign: 'center', marginTop: 8, fontSize: 15, padding: '13px', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none' }}>
                {loading ? (
                  <><span className="material-symbols-rounded" style={{ fontSize: 18, animation: 'spin 1s linear infinite' }}>progress_activity</span>Updating…</>
                ) : 'Update Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
