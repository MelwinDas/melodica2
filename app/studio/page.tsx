'use client';
import Link from 'next/link';
import { useState, useRef } from 'react';

type StudioTab = 'ai-generate' | 'file-upload' | 'file-export';

const tracks = [
  { name: 'Synth Lead', color: '#8b5cf6', muted: false, volume: 80 },
  { name: 'Bass Line', color: '#14b8a6', muted: false, volume: 65 },
  { name: 'Drum Kit', color: '#ec4899', muted: false, volume: 90 },
  { name: 'Pad Layer', color: '#f59e0b', muted: true, volume: 45 },
  { name: 'FX Chain', color: '#6366f1', muted: false, volume: 30 },
];

export default function StudioPage() {
  const [tab, setTab] = useState<StudioTab>('ai-generate');
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(128);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [exportFormat, setExportFormat] = useState('mp3');
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerate = () => {
    if (!aiPrompt) return;
    setGenerating(true);
    setTimeout(() => { setGenerating(false); setGenerated(true); }, 2800);
  };

  const handleFileUpload = (name: string) => {
    setUploadedFile(name);
    setAnalyzing(true);
    setTimeout(() => setAnalyzing(false), 2500);
  };

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => setExporting(false), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-primary)' }}>
      {/* Top menubar */}
      <div style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 20px', height: 44 }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, marginRight: 24 }}>
          <span className="material-symbols-rounded" style={{ color: 'var(--accent-purple)', fontSize: 20 }}>piano</span>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16 }}>Melodica</span>
        </Link>
        {['File', 'Edit', 'View', 'Track', 'Help'].map(item => (
          <button key={item} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, padding: '0 10px', height: 44, transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >{item}</button>
        ))}
        <div className="flex items-center gap-3" style={{ marginLeft: 'auto' }}>
          <button onClick={() => setIsPlaying(!isPlaying)} style={{ background: 'var(--accent-purple)', border: 'none', borderRadius: 8, padding: '5px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: 'white', fontSize: 13, fontWeight: 600 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{isPlaying ? 'pause' : 'play_arrow'}</span>
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: '4px 12px', display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>BPM</span>
            <input type="number" value={bpm} onChange={e => setBpm(Number(e.target.value))} style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, width: 36, textAlign: 'center' }} />
          </div>
          <span style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--accent-teal-light)', background: 'var(--bg-card)', padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)' }}>00:01:24</span>
        </div>
        <Link href="/dashboard" style={{ marginLeft: 16, color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
          <span className="material-symbols-rounded" style={{ fontSize: 16 }}>arrow_back</span>
          Dashboard
        </Link>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Tracks panel */}
        <div style={{ width: '55%', display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--border)' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tracks</h2>
            <button style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', color: 'var(--accent-purple-light)', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span className="material-symbols-rounded" style={{ fontSize: 14 }}>add</span>Add Track
            </button>
          </div>
          {/* Timeline ruler */}
          <div style={{ height: 24, background: 'var(--bg-panel)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', paddingLeft: 160 }}>
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={i} style={{ flex: 1, fontSize: 9, color: 'var(--text-muted)', textAlign: 'left', paddingLeft: 4, borderLeft: '1px solid var(--border)' }}>{i + 1}</div>
            ))}
          </div>
          {/* Tracks */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {tracks.map((track, idx) => (
              <div key={track.name} style={{ display: 'flex', alignItems: 'stretch', borderBottom: '1px solid var(--border)', height: 60, opacity: track.muted ? 0.4 : 1 }}>
                <div style={{ width: 160, flexShrink: 0, padding: '0 12px', background: 'var(--bg-panel)', borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 3, height: 30, borderRadius: 2, background: track.color, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{track.name}</p>
                    <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                      <button style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 3, width: 18, height: 14, fontSize: 8, cursor: 'pointer', color: 'var(--text-muted)' }}>M</button>
                      <button style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 3, width: 18, height: 14, fontSize: 8, cursor: 'pointer', color: 'var(--text-muted)' }}>S</button>
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1, padding: '8px 4px', display: 'flex', alignItems: 'center', background: idx % 2 === 0 ? 'var(--bg-primary)' : 'var(--bg-secondary)' }}>
                  <div style={{ width: `${40 + idx * 8}%`, height: 40, borderRadius: 4, background: `${track.color}25`, border: `1px solid ${track.color}55`, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 1, overflow: 'hidden', cursor: 'grab' }}>
                    {Array.from({ length: 22 }).map((_, j) => (
                      <div key={j} style={{ flex: 1, borderRadius: 1, background: track.color, height: `${8 + Math.abs(Math.sin(j * 0.6 + idx)) * 18}px`, opacity: 0.7 }} />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ width: '45%', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {[
              { id: 'ai-generate', label: 'AI Generate', icon: 'auto_awesome' },
              { id: 'file-upload', label: 'Upload', icon: 'upload_file' },
              { id: 'file-export', label: 'Export', icon: 'ios_share' },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as StudioTab)} style={{ flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer', background: tab === t.id ? 'rgba(139,92,246,0.1)' : 'transparent', color: tab === t.id ? 'var(--accent-purple-light)' : 'var(--text-secondary)', fontSize: 12, fontWeight: 600, borderBottom: tab === t.id ? '2px solid var(--accent-purple)' : '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.2s' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 16 }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {tab === 'ai-generate' && (
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>AI Studio Generation</h3>
                <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="e.g. 'Dreamy synthwave with lush pads and a driving bassline at 128 BPM...'" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', color: 'var(--text-primary)', fontSize: 13, width: '100%', height: 90, resize: 'none', outline: 'none', fontFamily: 'Inter, sans-serif', marginBottom: 16 }} />
                <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 16 }}>
                  {[['Genre', ['Synthwave', 'Jazz', 'Classical', 'Ambient']], ['Mood', ['Energetic', 'Dreamy', 'Dark', 'Uplifting']], ['Tempo', ['Slow', 'Medium', 'Fast']], ['Duration', ['1 min', '2 min', '3 min']]].map(([label, opts]) => (
                    <div key={label as string}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>{label as string}</label>
                      <select style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontSize: 12, width: '100%', outline: 'none' }}>
                        {(opts as string[]).map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
                <button onClick={handleGenerate} disabled={generating || !aiPrompt} style={{ width: '100%', padding: '13px', background: generating ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', border: 'none', borderRadius: 10, cursor: generating ? 'wait' : 'pointer', color: 'white', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: !aiPrompt ? 0.5 : 1 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{generating ? 'refresh' : 'auto_awesome'}</span>
                  {generating ? 'Generating...' : 'Generate Track'}
                </button>
                {generated && (
                  <div style={{ marginTop: 16, background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.3)', borderRadius: 12, padding: '16px' }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-teal-light)' }}>✓ Track Generated!</p>
                      <button className="btn-teal" style={{ padding: '6px 14px', fontSize: 12 }}>Add to Project</button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 28 }}>
                      {Array.from({ length: 32 }).map((_, i) => <div key={i} style={{ flex: 1, borderRadius: 2, background: 'var(--accent-teal)', height: `${8 + Math.abs(Math.sin(i * 0.5)) * 16}px`, opacity: 0.7 }} />)}
                    </div>
                  </div>
                )}
                {/* Effects rack */}
                <div style={{ marginTop: 20, background: 'var(--bg-panel)', borderRadius: 12, padding: '16px', border: '1px solid var(--border)' }}>
                  <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Audio Effects Rack – Synth Lead</h4>
                  {[['Reverb', 40], ['Delay', 25], ['Compression', 70], ['EQ High', 55]].map(([name, val]) => (
                    <div key={name as string} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 90, flexShrink: 0 }}>{name as string}</span>
                      <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: 4, height: 5, position: 'relative' }}>
                        <div style={{ width: `${val}%`, height: '100%', background: 'linear-gradient(90deg, #8b5cf6 0%, #14b8a6 100%)', borderRadius: 4 }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 28, textAlign: 'right' }}>{val}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'file-upload' && (
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Upload & Transcribe</h3>
                <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f.name); }} onClick={() => fileInputRef.current?.click()} style={{ border: `2px dashed ${dragOver ? 'var(--accent-purple)' : uploadedFile ? 'var(--accent-teal)' : 'var(--border-light)'}`, borderRadius: 14, padding: '36px 24px', textAlign: 'center', cursor: 'pointer', background: dragOver ? 'rgba(139,92,246,0.05)' : uploadedFile ? 'rgba(20,184,166,0.05)' : 'var(--bg-card)', transition: 'all 0.2s', marginBottom: 20 }}>
                  <input ref={fileInputRef} type="file" accept=".mp3,.wav,.mid" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f.name); }} />
                  <span className="material-symbols-rounded" style={{ fontSize: 44, color: uploadedFile ? 'var(--accent-teal)' : 'var(--text-muted)', display: 'block', marginBottom: 10 }}>{uploadedFile ? 'audio_file' : 'upload_file'}</span>
                  {uploadedFile ? (
                    <>
                      <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-teal-light)', marginBottom: 4 }}>{uploadedFile}</p>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{analyzing ? '🎵 Analyzing pitch and velocity...' : '✓ Analysis complete'}</p>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Drag and drop your audio file</p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Supported formats: .mp3, .wav, .mid</p>
                    </>
                  )}
                </div>
                <div style={{ background: 'var(--bg-panel)', borderRadius: 12, padding: '16px', border: '1px solid var(--border)', marginBottom: 16 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Transcription Settings</h4>
                  {[['Sheet Music Generation', true], ['MIDI Export', true], ['Chord Detection', false], ['Beat Quantization', true]].map(([label, enabled]) => (
                    <div key={label as string} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>{label as string}</p>
                      <div style={{ width: 34, height: 18, borderRadius: 9, background: enabled ? 'var(--accent-teal)' : 'var(--bg-card)', border: `1px solid ${enabled ? 'var(--accent-teal)' : 'var(--border)'}`, position: 'relative', cursor: 'pointer' }}>
                        <div style={{ position: 'absolute', top: 2, left: enabled ? 16 : 2, width: 12, height: 12, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                      </div>
                    </div>
                  ))}
                </div>
                {uploadedFile && !analyzing && (
                  <Link href="/sheet-music" className="btn-teal" style={{ display: 'block', textAlign: 'center', padding: '13px', fontSize: 14 }}>View Sheet Music</Link>
                )}
              </div>
            )}

            {tab === 'file-export' && (
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Export Project</h3>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 10 }}>Export Format</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['mp3', 'wav', 'flac', 'midi', 'pdf', 'stems'].map(fmt => (
                      <button key={fmt} onClick={() => setExportFormat(fmt)} style={{ padding: '10px', border: `1px solid ${exportFormat === fmt ? 'var(--accent-purple)' : 'var(--border)'}`, borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, background: exportFormat === fmt ? 'rgba(139,92,246,0.15)' : 'var(--bg-card)', color: exportFormat === fmt ? 'var(--accent-purple-light)' : 'var(--text-secondary)', textTransform: 'uppercase', transition: 'all 0.2s' }}>{fmt}</button>
                    ))}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-panel)', borderRadius: 12, padding: '16px', border: '1px solid var(--border)', marginBottom: 16 }}>
                  <h4 style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Quality Settings</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {[['Sample Rate', ['44.1 kHz', '48 kHz', '96 kHz']], ['Bit Depth', ['16-bit', '24-bit', '32-bit float']], ['Bitrate', ['320 kbps', '256 kbps', '192 kbps']], ['Normalize', ['-0.1 dBFS', '-1.0 dBFS', 'Off']]].map(([label, opts]) => (
                      <div key={label as string}>
                        <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{label as string}</label>
                        <select style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontSize: 12, width: '100%', outline: 'none' }}>
                          {(opts as string[]).map(o => <option key={o}>{o}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={handleExport} disabled={exporting} style={{ width: '100%', padding: '13px', background: exporting ? 'rgba(139,92,246,0.3)' : 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', border: 'none', borderRadius: 10, cursor: exporting ? 'wait' : 'pointer', color: 'white', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{exporting ? 'hourglass_top' : 'ios_share'}</span>
                  {exporting ? 'Exporting...' : `Export ${exportFormat.toUpperCase()}`}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
