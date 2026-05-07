import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useVoiceInput — Hook to manage Speech-to-Text via Web Speech API.
 * Provides listening state and transcript handling.
 */
const useVoiceInput = ({ onTranscript, onStateChange }) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

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
      onStateChange?.(true);
    };

    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript) {
        onTranscript?.(transcript.trim());
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      onStateChange?.(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      onStateChange?.(false);
    };

    recognitionRef.current = recognition;
  }, [onTranscript, onStateChange]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  }, [isListening]);

  return { isListening, toggleListening };
};

export default useVoiceInput;
