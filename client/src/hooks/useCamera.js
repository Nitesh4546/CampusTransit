import { useCallback, useEffect, useRef, useState } from 'react';

export default function useCamera(active) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | starting | live | error
  const [error, setError] = useState(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!active) { stop(); setStatus('idle'); return; }
    let cancelled = false;
    setStatus('starting'); setError(null);

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('CAMERA_UNSUPPORTED');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; } // late-resolve guard
        streamRef.current = stream;
        const v = videoRef.current;
        if (!v) { stop(); throw new Error('VIDEO_NOT_MOUNTED'); }
        v.srcObject = stream;
        await v.play();
        if (!cancelled) setStatus('live');
      } catch (e) {
        if (!cancelled) { setError(e); setStatus('error'); }
      }
    })();

    return () => { cancelled = true; stop(); };
  }, [active, stop]);

  // stop when tab is hidden / page is left / bfcache
  useEffect(() => {
    const off = () => { if (document.hidden) { stop(); setStatus('idle'); } };
    document.addEventListener('visibilitychange', off);
    window.addEventListener('pagehide', stop);
    return () => {
      document.removeEventListener('visibilitychange', off);
      window.removeEventListener('pagehide', stop);
    };
  }, [stop]);

  return { videoRef, status, error, stop };
}
