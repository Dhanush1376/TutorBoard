import { useEffect, useRef, useCallback } from 'react';
import useTutorStore from '../store/tutorStore';
import { estimateReadingMs, estimateSpeechMs } from '../engine/narrationTiming';

/**
 * useVoiceNarrator — narration playback via the Web Speech API, synchronized
 * with the step timeline.
 *
 * - speakAsync(text) resolves when speech actually ENDS (not on a timer), so
 *   callers can gate step advancement on real narration completion.
 * - Long texts are chunked by sentence: Chrome silently kills utterances
 *   longer than ~15s, which was a source of "narration vanished" bugs.
 * - Speech rate follows playbackSpeed, so speeding up a lesson speeds the
 *   voice, keeping voice and animation in lockstep.
 * - narrateStep(index, text) drives the store's voiceDone signal, falling
 *   back to a reading-time estimate when voice is muted or TTS fails.
 */
const useVoiceNarrator = () => {
  const { isVoiceEnabled, isPlaying, playbackSpeed } = useTutorStore();
  const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
  const sessionRef = useRef(0);       // increments to invalidate in-flight speech
  const fallbackTimerRef = useRef(null);

  const cancel = useCallback(() => {
    sessionRef.current += 1;
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
    if (synth) synth.cancel();
  }, [synth]);

  /**
   * Speak text, resolving when it finishes (or is cancelled / fails).
   * Returns { completed } — completed=false means it was cut off.
   */
  const speakAsync = useCallback((text) => {
    return new Promise((resolve) => {
      if (!synth || !isVoiceEnabled || !text) {
        resolve({ completed: false, spoke: false });
        return;
      }

      const session = ++sessionRef.current;
      synth.cancel();

      // Strip markdown for cleaner speech, then chunk by sentence.
      const cleanText = String(text).replace(/\*\*|\*|#|`|_/g, '');
      const sentences = cleanText.match(/[^.!?]+[.!?]+[\s]*|[^.!?]+$/g) || [cleanText];

      // Group sentences into chunks under ~180 chars for engine stability.
      const chunks = [];
      let current = '';
      for (const s of sentences) {
        if ((current + s).length > 180 && current) {
          chunks.push(current.trim());
          current = s;
        } else {
          current += s;
        }
      }
      if (current.trim()) chunks.push(current.trim());

      const voices = synth.getVoices();
      const preferredVoice = voices.find(v =>
        (v.name.includes('Google') || v.name.includes('Natural')) && v.lang.startsWith('en')
      );
      const rate = Math.min(2, Math.max(0.6, playbackSpeed || 1));

      let idx = 0;
      const speakNext = () => {
        if (session !== sessionRef.current) {
          resolve({ completed: false, spoke: true });
          return;
        }
        if (idx >= chunks.length) {
          resolve({ completed: true, spoke: true });
          return;
        }
        const utterance = new SpeechSynthesisUtterance(chunks[idx]);
        if (preferredVoice) utterance.voice = preferredVoice;
        utterance.rate = rate;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        utterance.onend = () => { idx += 1; speakNext(); };
        utterance.onerror = () => { resolve({ completed: false, spoke: true }); };
        synth.speak(utterance);
      };
      speakNext();
    });
  }, [synth, isVoiceEnabled, playbackSpeed]);

  /** Legacy fire-and-forget API. */
  const speak = useCallback((text) => { speakAsync(text); }, [speakAsync]);

  /**
   * Narrate a step and mark the store's voiceDone signal when narration is
   * truly over. With voice muted (or TTS unavailable) a reading-time estimate
   * stands in, so pacing still follows narration length.
   */
  const narrateStep = useCallback((index, text) => {
    cancel();
    const store = useTutorStore.getState();
    const speed = Math.max(0.25, store.playbackSpeed || 1);

    if (!text) {
      store.markStepVoiceDone?.(index);
      return;
    }

    if (synth && isVoiceEnabled) {
      const session = sessionRef.current + 1; // speakAsync will bump to this
      // Safety net: even if TTS never fires end events, release the gate.
      fallbackTimerRef.current = setTimeout(() => {
        if (sessionRef.current === session) {
          useTutorStore.getState().markStepVoiceDone?.(index);
        }
      }, estimateSpeechMs(text, speed) * 1.8);

      speakAsync(text).then(({ completed, spoke }) => {
        if (fallbackTimerRef.current) {
          clearTimeout(fallbackTimerRef.current);
          fallbackTimerRef.current = null;
        }
        if (completed) {
          // Speech finished naturally — release the gate.
          useTutorStore.getState().markStepVoiceDone?.(index);
        } else if (!spoke) {
          // Speech never started (muted / no TTS) — pace by reading time.
          fallbackTimerRef.current = setTimeout(() => {
            useTutorStore.getState().markStepVoiceDone?.(index);
          }, estimateReadingMs(text, speed));
        }
        // Interrupted speech (a newer step took over) marks nothing —
        // the newer step now owns the gate.
      });
    } else {
      // Subtitle-only pacing.
      fallbackTimerRef.current = setTimeout(() => {
        useTutorStore.getState().markStepVoiceDone?.(index);
      }, estimateReadingMs(text, speed));
    }
  }, [synth, isVoiceEnabled, speakAsync, cancel]);

  // Global mute/unmute
  useEffect(() => {
    if (!isVoiceEnabled) cancel();
  }, [isVoiceEnabled, cancel]);

  // Pause/resume follows the lesson's play state.
  useEffect(() => {
    if (!synth) return;
    if (!isPlaying && synth.speaking && !synth.paused) {
      synth.pause();
    } else if (isPlaying && synth.paused) {
      synth.resume();
    }
  }, [isPlaying, synth]);

  // Cleanup on unmount.
  useEffect(() => cancel, [cancel]);

  return { speak, speakAsync, narrateStep, cancel };
};

export default useVoiceNarrator;
