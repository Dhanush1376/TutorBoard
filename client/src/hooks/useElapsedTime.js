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
      tickTimerRef.current = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
    } else {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    }

    return () => {
      if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    };
  }, [isPlaying]);

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    seconds,
    formatted: formatTime(seconds),
    setSeconds,
    formatTime
  };
}
