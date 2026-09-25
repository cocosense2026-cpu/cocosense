import { useEffect, useRef } from 'react';

/**
 * Re-runs `callback` every `intervalMs`, in addition to whenever the
 * caller's own effect deps change (since callers still call this from
 * inside their existing data-fetching useEffect). Pauses while the tab
 * is in the background (document.hidden) so an idle browser tab isn't
 * silently hammering the API -- resumes and fetches immediately when
 * the tab becomes visible again, so data is never stale-looking when
 * you switch back to it.
 */
export function usePolling(callback: () => void, intervalMs: number) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    const tick = () => {
      if (!document.hidden) savedCallback.current();
    };
    const id = setInterval(tick, intervalMs);

    const onVisibility = () => {
      if (!document.hidden) savedCallback.current();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs]);
}
