/**
 * useStreamingResponse — Simulated streaming hook
 * 
 * Takes a full response string and reveals it word-by-word,
 * creating a ChatGPT-like typing effect.
 */
import { useRef, useCallback } from 'react';
import useTutorStore from '../store/tutorStore';

export default function useStreamingResponse() {
  const animFrameRef = useRef(null);
  const abortedRef = useRef(false);
  const isActiveRef = useRef(false);

  const startStreaming = useCallback((fullContent, messageId, sessionId = null, onComplete = null) => {
    const store = useTutorStore.getState();
    const streamToken = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    abortedRef.current = false;
    isActiveRef.current = true;

    // FIX I-02: If real SSE streaming is already active, bypass simulation to avoid UI collision
    if (store.isStreaming) {
      import.meta.env.DEV && console.log('[useStreamingResponse] ⏩ Real stream active, bypassing simulation.');
      store.finishStreaming(fullContent, sessionId, null, [], null, null, 0, streamToken);
      isActiveRef.current = false;
      if (onComplete) onComplete(fullContent);
      return;
    }

    store.startStreaming(messageId, sessionId, streamToken);

    // Split into words for natural-feeling streaming
    const words = fullContent.split(/(\s+)/);
    let currentIndex = 0;
    let accumulated = '';

    const WORDS_PER_TICK = 3;     // Words to add per frame
    const TICK_INTERVAL = 18;     // ms between ticks

    const tick = () => {
      if (abortedRef.current || currentIndex >= words.length) {
        isActiveRef.current = false;
        if (!abortedRef.current) {
          store.finishStreaming(fullContent, sessionId, null, [], null, null, 0, streamToken);
          if (onComplete) onComplete(fullContent);
        }
        return;
      }

      // Add next batch of words
      const end = Math.min(currentIndex + WORDS_PER_TICK, words.length);
      for (let i = currentIndex; i < end; i++) {
        accumulated += words[i];
      }
      currentIndex = end;

      store.updateStreamingContent(accumulated, sessionId, streamToken);

      animFrameRef.current = setTimeout(tick, TICK_INTERVAL);
    };

    // Start with a small delay for natural feel
    animFrameRef.current = setTimeout(tick, 100);
  }, []);

  const stopStreaming = useCallback(() => {
    abortedRef.current = true;
    isActiveRef.current = false;
    if (animFrameRef.current) {
      clearTimeout(animFrameRef.current);
      animFrameRef.current = null;
    }
    useTutorStore.getState().abortStreaming();
  }, []);

  return { startStreaming, stopStreaming, isActiveRef };
}
