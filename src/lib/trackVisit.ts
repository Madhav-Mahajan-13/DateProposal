export interface Visit {
  id: string;
  visitedAt: string;
  ip: string;
  page: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'bot';
  os: string;
  browser: string;
  screen: {
    width: number | null;
    height: number | null;
    pixelRatio: number | null;
  };
  viewport: { width: number | null; height: number | null };
  language: string;
  timezone: string;
  referrer: string;
  country: string;
  city: string;
  userAgent: string;
}

interface UADataLike {
  getHighEntropyValues?: (
    hints: string[],
  ) => Promise<{ platformVersion?: string }>;
}

// Logs one visit per page load. Failures are silent: tracking must never
// get in the way of the page itself.
export async function trackVisit() {
  let platformVersion: string | undefined;
  try {
    const uaData = (navigator as Navigator & { userAgentData?: UADataLike })
      .userAgentData;
    platformVersion = (
      await uaData?.getHighEntropyValues?.(['platformVersion'])
    )?.platformVersion;
  } catch {
    /* not available in this browser */
  }
  let timezone = '';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    /* ignore */
  }
  try {
    await fetch('/api/visit', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        page: window.location.pathname,
        screen: {
          width: window.screen.width,
          height: window.screen.height,
          pixelRatio: window.devicePixelRatio,
        },
        viewport: { width: window.innerWidth, height: window.innerHeight },
        touchPoints: navigator.maxTouchPoints,
        platformVersion,
        language: navigator.language,
        timezone,
        referrer: document.referrer,
      }),
    });
  } catch {
    /* ignore */
  }
}
