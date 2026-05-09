import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useVoiceInput — Hook to manage Speech-to-Text via Web Speech API.
 * Provides listening state and transcript handling.
 */
const useVoiceInput = ({ onTranscript, onStateChange }) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const callbacksRef = useRef({ onTranscript, onStateChange });

  // Update refs when props change without re-triggering effects
  useEffect(() => {
    callbacksRef.current = { onTranscript, onStateChange };
  }, [onTranscript, onStateChange]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition API not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      callbacksRef.current.onStateChange?.(true);
    };

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript) {
        callbacksRef.current.onTranscript?.(transcript.trim());
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      callbacksRef.current.onStateChange?.(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      callbacksRef.current.onStateChange?.(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []); // Only initialize once

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      try {
        recognitionRef.current.start();
      } catch (e) {
        console.warn('Speech recognition already started:', e);
      }
    }
  }, [isListening]);

  return { isListening, toggleListening };
};

export default useVoiceInput;
