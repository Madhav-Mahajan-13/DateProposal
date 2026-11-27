import { useEffect, useRef } from 'react';
import { startBouquet } from '../bouquet/lineRoses';
import './bouquet.css';

const BACKGROUND = '#07080b';

export default function BouquetPage() {
  const canvas = useRef<HTMLCanvasElement>(null);

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
    if (canvas.current) {
      try {
        // ?at=8 starts the animation 8 seconds in, handy for previewing.
        const at = Number(new URLSearchParams(location.search).get('at'));
        stop = startBouquet(canvas.current, {
          reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)')
            .matches,
          startAt: Number.isFinite(at) ? Math.max(0, Math.min(60, at)) : 0,
        });
      } catch {
        /* without a canvas the dark page simply stays empty */
      }
    }
    return () => {
      stop?.();
      document.body.style.background = body;
      if (theme && themeColor) theme.content = themeColor;
    };
  }, []);

  return (
    <main
      className="bouquet-page"
      aria-label="Three white roses, drawn in light"
    >
      <canvas ref={canvas} className="bouquet-canvas" />
      <div className="bouquet-vignette" aria-hidden="true" />
      <p className="bouquet-message">i am sorry, keep smiling </p>
    </main>
  );
}
