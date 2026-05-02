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

  const startStreaming = useCallback((fullContent, messageId) => {
    const store = useTutorStore.getState();
    abortedRef.current = false;
    isActiveRef.current = true;

    store.startStreaming(messageId);

    // Split into words for natural-feeling streaming
    const words = fullContent.split(/(\s+)/);
    let currentIndex = 0;
    let accumulated = '';

    const WORDS_PER_TICK = 2;     // Words to add per frame
    const TICK_INTERVAL = 30;     // ms between ticks

    const tick = () => {
      if (abortedRef.current || currentIndex >= words.length) {
        isActiveRef.current = false;
        if (!abortedRef.current) {
          store.finishStreaming(fullContent);
        }
        return;
      }

      // Add next batch of words
      const end = Math.min(currentIndex + WORDS_PER_TICK, words.length);
      for (let i = currentIndex; i < end; i++) {
        accumulated += words[i];
      }
      currentIndex = end;

      store.updateStreamingContent(accumulated);

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
