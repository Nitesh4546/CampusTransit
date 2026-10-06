import { useEffect, useRef, useState } from 'react';

/**
 * Screen Wake Lock API hook — prevents screen from sleeping.
 * Re-acquires lock on visibility change.
 */
export function useWakeLock() {
  const [active, setActive] = useState(false);
  const [error, setError] = useState(null);
  const lockRef = useRef(null);

  async function acquire() {
    if (!('wakeLock' in navigator)) {
      setError('Wake Lock API not supported');
      return;
    }
    try {
      lockRef.current = await navigator.wakeLock.request('screen');
      setActive(true);
      setError(null);
      lockRef.current.addEventListener('release', () => setActive(false));
    } catch (err) {
      setError(err.message);
    }
  }

  async function release() {
    if (lockRef.current) {
      await lockRef.current.release();
      lockRef.current = null;
      setActive(false);
    }
  }

  useEffect(() => {
    acquire();

    // Re-acquire on tab focus
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !lockRef.current) {
        acquire();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      release();
    };
  }, []);

  return { active, error, acquire, release };
}
