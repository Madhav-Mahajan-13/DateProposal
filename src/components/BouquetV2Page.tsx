import { useEffect, useRef, useState } from 'react';
import { startBouquetV2, type Phase } from '../bouquetv2/renderer';
import './bouquet-v2.css';

const BACKGROUND = '#0d080c';

export default function BouquetV2Page() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('opening');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    document.title = 'White roses';
    const body = document.body.style.background;
    document.body.style.background = BACKGROUND;
    const theme = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    const themeColor = theme?.content;
    if (theme) theme.content = BACKGROUND;

    let stop: (() => void) | undefined;
    if (canvas.current && overlay.current) {
      // ?at=6 starts six seconds into the bloom, handy for previewing.
      const at = Number(new URLSearchParams(location.search).get('at'));
      try {
        stop = startBouquetV2(canvas.current, overlay.current, {
          reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)')
            .matches,
          onPhase: setPhase,
          startAt: Number.isFinite(at) ? Math.max(0, Math.min(30, at)) : 0,
        });
      } catch {
        queueMicrotask(() => setFailed(true));
      }
    }
    return () => {
      stop?.();
      document.body.style.background = body;
      if (theme && themeColor) theme.content = themeColor;
    };
  }, []);

  return (
    <main className="bouquet-v2" aria-label="A bouquet of white roses">
      <canvas ref={canvas} className="bouquet-v2__canvas" />
      <canvas
        ref={overlay}
        className="bouquet-v2__overlay"
        aria-hidden="true"
      />
      <p className="bouquet-v2__hint" aria-live="polite">
        {failed
          ? 'White roses, for you. (This browser can’t draw them.)'
          : phase === 'opening'
            ? 'the roses are opening…'
            : 'drag to turn · tap to bloom again · space to pause'}
      </p>
    </main>
  );
}
