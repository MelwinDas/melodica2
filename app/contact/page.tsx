'use client';
import Link from 'next/link';
import { useState } from 'react';

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    setLoading(false);
    setSuccess(true);
  };

  return (
    <div className="hero-gradient min-h-screen flex flex-col items-center justify-center px-4" style={{ position: 'relative', overflow: 'hidden', padding: '100px 0' }}>
      <div style={{ position: 'absolute', top: '5%', left: '5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '5%', right: '5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40, zIndex: 10 }}>
        <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple)', fontSize: 32 }}>piano</span>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 26, color: 'var(--text-primary)' }}>Melodica</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12" style={{ width: '100%', maxWidth: 1100, position: 'relative', zIndex: 10 }}>
        {/* Contact Info */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="badge badge-purple" style={{ marginBottom: 16, alignSelf: 'flex-start' }}>Get in Touch</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 48, fontWeight: 800, marginBottom: 24, lineHeight: 1.1 }}>
            How can we <span className="text-gradient-teal">help you?</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 18, lineHeight: 1.6, marginBottom: 40, maxWidth: 460 }}>
            Have questions about Melodica? We're here to help you compose, create, and master your music.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple)', fontSize: 24 }}>mail</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 2 }}>Email Us</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>melodica621@gmail.com</div>
              </div>
            </div>


          </div>
        </div>

        {/* Contact Form */}
        <div className="glass-card" style={{ padding: '48px' }}>
          {success ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <span className="material-symbols-rounded" style={{ fontSize: 64, color: 'var(--accent-teal)', marginBottom: 20 }}>check_circle</span>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 800, marginBottom: 12 }}>Message Sent!</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.7 }}>
                Thank you for reaching out. Our team will get back to you at {formData.email} soon.
              </p>
              <button 
                onClick={() => setSuccess(false)}
                className="btn-secondary" 
                style={{ marginTop: 32, fontSize: 14, padding: '10px 24px' }}
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Name</label>
                  <input 
                    type="text" className="input-field" placeholder="Your name" 
                    value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required 
                  />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Email</label>
                  <input 
                    type="email" className="input-field" placeholder="you@example.com" 
                    value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required 
                  />
                </div>
              </div>
              
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Subject</label>
                <input 
                  type="text" className="input-field" placeholder="How can we help?" 
                  value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} required 
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>Message</label>
                <textarea 
                  className="input-field" placeholder="Tell us more..." rows={5} 
                  style={{ resize: 'none' }}
                  value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} required 
                />
              </div>

              <button 
                type="submit" disabled={loading}
                className="btn-primary" 
                style={{ marginTop: 12, padding: '14px', fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
              >
                {loading ? (
                  <><span className="material-symbols-rounded" style={{ fontSize: 20, animation: 'spin 1s linear infinite' }}>progress_activity</span>Sending...</>
                ) : (
                  <><span className="material-symbols-rounded" style={{ fontSize: 20 }}>send</span>Send Message</>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      <div style={{ marginTop: 80, fontSize: 13, color: 'var(--text-muted)' }}>
        © 2026 Melodica Music Inc. • <Link href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Back to Home</Link>
      </div>
    </div>
  );
}
