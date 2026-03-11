'use client';

import { useEffect, useRef } from 'react';

interface OsmdViewerProps {
  musicXml: string;      // MusicXML string to render
  zoom?: number;         // 0.5 – 2.0, default 1.0
  drawTitle?: boolean;
}

export default function OsmdViewer({ musicXml, zoom = 1.0, drawTitle = false }: OsmdViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<import('opensheetmusicdisplay').OpenSheetMusicDisplay | null>(null);

  useEffect(() => {
    if (!containerRef.current || !musicXml) return;
    const el = containerRef.current;

    let cancelled = false;

    (async () => {
      const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay');

      if (cancelled) return;

      // Re-use existing OSMD instance if possible
      if (!osmdRef.current) {
        osmdRef.current = new OpenSheetMusicDisplay(el, {
          autoResize: true,
          backend: 'svg',
          drawTitle,
          drawSubtitle: false,
          drawComposer: false,
          drawCredits: false,
          drawLyricist: false,
          drawMeasureNumbers: true,
          drawTimeSignatures: true,
          followCursor: false,
        });
      }

      const osmd = osmdRef.current;
      osmd.zoom = zoom;

      try {
        await osmd.load(musicXml);
        if (!cancelled) osmd.render();
      } catch (e) {
        console.error('[OsmdViewer] render error', e);
      }
    })();

    return () => { cancelled = true; };
  }, [musicXml, zoom, drawTitle]);

  return (
    <div
      ref={containerRef}
      style={{
        background: 'white',
        borderRadius: 10,
        padding: '16px 12px',
        overflow: 'auto',
        minHeight: 120,
        width: '100%',
      }}
    />
  );
}
