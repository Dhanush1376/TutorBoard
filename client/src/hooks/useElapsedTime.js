import { useState, useEffect, useRef } from 'react';

/**
 * Tracks the elapsed time since the session started.
 * Returns the formatted time string and raw seconds.
 */
export function useElapsedTime(isPlaying, resetKey) {
  const [seconds, setSeconds] = useState(0);
  const tickTimerRef = useRef(null);

  useEffect(() => {
    setSeconds(0);
  }, [resetKey]);

  useEffect(() => {
    if (isPlaying) {
      const intervalMs = 100;
      tickTimerRef.current = setInterval(() => {
        setSeconds(s => +(s + intervalMs / 1000).toFixed(2));
      }, intervalMs);
    } else {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    }

    return () => {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    };
  }, [isPlaying]);

  const formatTime = (totalSeconds) => {
    const s = Math.floor(totalSeconds);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    seconds,
    formatted: formatTime(seconds),
    setSeconds,
    formatTime
  };
}
