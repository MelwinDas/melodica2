'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Midi } from '@tonejs/midi';
import { midiBufferToMusicXml } from '../utils/midiToMusicXml';

// OSMD is browser-only
const OsmdViewer = dynamic(() => import('../components/OsmdViewer'), { ssr: false });

interface NoteEntry { pitch: string; duration: string; }

function SheetMusicContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get('id');
  const midiFromUrl = searchParams.get('midi');

  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [musicXml, setMusicXml] = useState<string>('');
  const [noteCount, setNoteCount] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  // ── Download sheet as Image ─────────────────────────────────────────────
  const handleDownload = async () => {
    if (!musicXml || isDownloading) return;
    
    setIsDownloading(true);
    await new Promise(r => setTimeout(r, 800)); // Feedback delay

    try {
      // Find all canvases rendered by OSMD (one per page)
      const container = document.querySelector('.osmd-render-container');
      const canvases = container?.querySelectorAll('canvas');
      
      if (!canvases || canvases.length === 0) {
        alert("Wait for the sheet to render completely before downloading.");
        setIsDownloading(false);
        return;
      }

      // Calculate combined dimensions
      let totalHeight = 0;
      let maxWidth = 0;
      canvases.forEach(c => {
        totalHeight += c.height;
        if (c.width > maxWidth) maxWidth = c.width;
      });

      // Create a master canvas to merge pages
      const masterCanvas = document.createElement('canvas');
      masterCanvas.width = maxWidth;
      masterCanvas.height = totalHeight;
      const ctx = masterCanvas.getContext('2d');

      if (ctx) {
        // Fill white background (Canvas is transparent by default)
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, masterCanvas.width, masterCanvas.height);

        // Draw each page vertically
        let currentY = 0;
        canvases.forEach(c => {
          ctx.drawImage(c, (maxWidth - c.width) / 2, currentY);
          currentY += c.height;
        });
        
        // Export to PNG
        const pngUrl = masterCanvas.toDataURL('image/png');
        const a = document.createElement('a');
        const fileName = (uploadedName?.replace(/\.(mid|midi)$/i, '') || 'Melodica_Score');
        a.href = pngUrl;
        a.download = `${fileName}.png`;
        a.click();
      }
      setIsDownloading(false);
    } catch (e) {
      console.error('[sheet-music] Download failed', e);
      setIsDownloading(false);
    }
  };

  // ── MIDI upload ─────────────────────────────────────────────────────────
  const handleMidiUpload = useCallback(async (file: File) => {
    setUploadedName(file.name);
    try {
      const buf = await file.arrayBuffer();

      // Build MusicXML directly from the raw MIDI buffer
      const xml = midiBufferToMusicXml(buf);
      setMusicXml(xml);

      // Count notes for the subtitle
      const midi = new Midi(buf);
      let count = 0;
      for (const track of midi.tracks) count += track.notes.length;
      setNoteCount(count);
    } catch (e) { console.error('[sheet-music] MIDI parse error', e); }
  }, []);

  // On mount: load MIDI from localStorage
  useEffect(() => {
    const pianoNotes = localStorage.getItem('melodica_piano_notes');
    if (pianoNotes) {
      localStorage.removeItem('melodica_piano_notes');
      localStorage.removeItem('melodica_midi_base64');
      localStorage.removeItem('melodica_midi_name');
      (async () => {
        try {
          const parsed = JSON.parse(pianoNotes) as NoteEntry[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            const { Midi: ToneMidi } = await import('@tonejs/midi');
            const midi = new ToneMidi();
            const track = midi.addTrack();
            const STEP: Record<string, number> = { C:0,'C#':1,D:2,'D#':3,E:4,F:5,'F#':6,G:7,'G#':8,A:9,'A#':10,B:11 };
            parsed.forEach((n, i) => {
              const m = n.pitch.match(/^([A-G]#?)(\d)$/);
              const midiNum = m ? (parseInt(m[2]) + 1) * 12 + (STEP[m[1]] ?? 0) : 60;
              track.addNote({ midi: midiNum, time: i * 0.4, duration: 0.35, velocity: 0.8 });
            });
            const file = new File([new Uint8Array(midi.toArray())], 'Piano Recording.mid', { type: 'audio/midi' });
            handleMidiUpload(file);
          }
        } catch { /* ignore */ }
      })();
      return;
    }
    const midiBase64 = localStorage.getItem('melodica_midi_base64');
    const midiName   = localStorage.getItem('melodica_midi_name');
    if (midiBase64) {
      try {
        const bin = atob(midiBase64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const file = new File([bytes], midiName ?? 'recording.mid', { type: 'audio/midi' });
        handleMidiUpload(file);
      } catch { /* ignore */ }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* Print styles – hide nav, show only sheet */}
      <style>{`
        @media print {
          .sheet-nav { display: none !important; }
          body { background: white !important; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#f0eff8', display: 'flex', flexDirection: 'column' }}>

        {/* ── Top nav ── */}
        <nav className="sheet-nav" style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          backdropFilter: 'blur(12px)',
          padding: '0 clamp(12px, 3vw, 24px)',
          display: 'flex',
          alignItems: 'center',
          height: 56,
          gap: 'clamp(10px, 3vw, 24px)',
          flexShrink: 0,
          zIndex: 100,
          overflowX: 'auto',
          overflowY: 'hidden',
        }}>
          {/* Melodica logo + name */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', flexShrink: 0 }}>
            <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple-light)', fontSize: 24 }}>piano</span>
            <span className="hide-mobile" style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700, fontSize: 19, color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}>Melodica</span>
          </Link>

          {/* Back to Studio */}
          <Link
            href={projectId ? `/studio?id=${projectId}${midiFromUrl ? `&midi=${encodeURIComponent(midiFromUrl)}` : ''}` : '/studio'}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              textDecoration: 'none', color: 'var(--text-secondary)',
              fontSize: 13, fontWeight: 600, transition: 'all 0.2s ease',
              padding: '8px 14px', borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg-card)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.borderColor = 'var(--accent-purple)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>arrow_back</span>
            <span className="hide-mobile">Piano Roll</span>
          </Link>

          <div style={{ flex: 1 }} />

          {/* Download sheet */}
          <button
            onClick={handleDownload}
            disabled={isDownloading || !musicXml}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: isDownloading ? 'var(--bg-card)' : 'linear-gradient(135deg, var(--accent-purple), #6d28d9)',
              border: 'none', borderRadius: 10,
              padding: '10px 20px', cursor: isDownloading ? 'not-allowed' : 'pointer',
              color: 'white', fontSize: 14, fontWeight: 700,
              boxShadow: isDownloading ? 'none' : '0 4px 15px rgba(139,92,246,0.3)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              opacity: !musicXml ? 0.5 : 1,
            }}
            onMouseEnter={e => {
              if (!isDownloading) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(139,92,246,0.45)';
              }
            }}
            onMouseLeave={e => {
              if (!isDownloading) {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(139,92,246,0.3)';
              }
            }}
          >
            {isDownloading ? (
              <>
                <span className="material-symbols-rounded" style={{ fontSize: 18, animation: 'spin 1s linear infinite' }}>progress_activity</span>
                <span className="hide-mobile">Processing...</span>
              </>
            ) : (
              <>
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>download</span>
                <span className="hide-mobile">Download Sheet</span>
              </>
            )}
          </button>
        </nav>

        {/* ── Sheet music area ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'clamp(16px, 4vw, 40px) clamp(12px, 3vw, 32px)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: 22, width: '100%', maxWidth: 860 }}>
            <h2 style={{ fontFamily: 'serif', fontSize: 22, color: '#1a1830', marginBottom: 4 }}>
              {uploadedName ? uploadedName.replace(/\.(mid|midi)$/i, '') : 'Melodica Score'}
            </h2>
            <p style={{ fontSize: 12, color: '#6b6890', fontStyle: 'italic' }}>
              {noteCount} notes · C Major · 4/4
            </p>
          </div>

          <div className="osmd-render-container" style={{ width: '100%', maxWidth: 860 }}>
            <div style={{ background: 'white', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: 'clamp(12px, 3vw, 24px)', overflowX: 'auto' }}>
              {musicXml ? (
                <OsmdViewer musicXml={musicXml} zoom={1.0} drawTitle={false} />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120 }}>
                  <p style={{ color: '#9d99bb', fontSize: 14 }}>Generating notation…</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function SheetMusicPage() {
  return (
    <Suspense fallback={null}>
      <SheetMusicContent />
    </Suspense>
  );
}
