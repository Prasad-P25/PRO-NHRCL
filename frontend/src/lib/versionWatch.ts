/**
 * Detects when a newer build has been deployed so the app can offer to refresh
 * itself — instead of users getting stuck on a stale, cached page after a deploy.
 *
 * How: each production build stamps a new hashed filename into index.html
 * (e.g. assets/index-AbC123.js). We fetch index.html periodically (bypassing the
 * cache) and compare that hash to the one we first saw. If it changed, a new
 * version is live.
 *
 * Returns a cleanup function that stops watching.
 */
export function watchForUpdates(onUpdate: () => void): () => void {
  let known: string | null = null;
  let stopped = false;

  const currentHash = async (): Promise<string | null> => {
    try {
      const res = await fetch('/index.html', { cache: 'no-store' });
      if (!res.ok) return null;
      const html = await res.text();
      const m = html.match(/assets\/index-[A-Za-z0-9_-]+\.js/);
      return m ? m[0] : null;
    } catch {
      return null; // offline or transient error — try again next tick
    }
  };

  const check = async () => {
    if (stopped) return;
    const h = await currentHash();
    if (!h) return;
    if (known === null) {
      known = h; // first sighting = the version currently running
      return;
    }
    if (h !== known) {
      known = h;
      onUpdate();
    }
  };

  // Check on start, every 5 minutes, and whenever the user returns to the tab.
  check();
  const interval = setInterval(check, 5 * 60 * 1000);
  const onVisible = () => {
    if (document.visibilityState === 'visible') check();
  };
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    stopped = true;
    clearInterval(interval);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
