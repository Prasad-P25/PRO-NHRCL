import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { watchForUpdates } from '@/lib/versionWatch';

/**
 * Shows a small top banner when a newer version of the app has been deployed,
 * with a one-tap Refresh. Safe by design — it never force-reloads (so it can't
 * interrupt a photo upload or unsaved work); the user chooses when to refresh.
 */
export function UpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    const stop = watchForUpdates(() => setShow(true));
    return stop;
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-3 bg-blue-600 px-4 py-2 text-sm text-white shadow-md">
      <span className="font-medium">A new version of the app is available.</span>
      <button
        onClick={() => window.location.reload()}
        className="inline-flex items-center gap-1 rounded-md bg-white/20 px-3 py-1 font-semibold hover:bg-white/30"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Refresh
      </button>
      <button
        onClick={() => setShow(false)}
        className="ml-1 text-white/80 hover:text-white"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
