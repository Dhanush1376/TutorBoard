import { useEffect, useRef, useCallback } from 'react';
import useTutorStore from '../store/tutorStore';

/**
 * useVoiceNarrator — Hook to manage AI narration playback via Web Speech API.
 * Handles the speech queue, cancellation, and synchronization with the store.
 */
const useVoiceNarrator = () => {
  const { isVoiceEnabled, isPlaying } = useTutorStore();
  const synth = window.speechSynthesis;
  const utteranceRef = useRef(null);

  /**
   * cancel — Stop all current speech.
   */
  const cancel = useCallback(() => {
    if (synth) {
      synth.cancel();
    }
  }, [synth]);

  /**
   * speak — Speak a given text.
   */
  const speak = useCallback((text) => {
    if (!synth || !isVoiceEnabled || !text) return;

    // Cancel existing speech before starting new one
    cancel();

    // Remove markdown symbols for cleaner speech
    const cleanText = text.replace(/\*\*|\*|#|`/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Find a nice voice (optional, defaults to system default)
    const voices = synth.getVoices();
    const preferredVoice = voices.find(v => 
      (v.name.includes('Google') || v.name.includes('Natural')) && v.lang.startsWith('en')
    );
    if (preferredVoice) utterance.voice = preferredVoice;

    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utteranceRef.current = utterance;
    synth.speak(utterance);
  }, [synth, isVoiceEnabled, cancel]);

  // Handle global mute/unmute
  useEffect(() => {
    if (!isVoiceEnabled) {
      cancel();
    }
  }, [isVoiceEnabled, cancel]);

  // Handle play/pause sync
  useEffect(() => {
    if (!isPlaying && synth.speaking) {
      synth.pause();
    } else if (isPlaying && synth.paused) {
      synth.resume();
    }
  }, [isPlaying, synth]);

  return { speak, cancel };
};

export default useVoiceNarrator;
