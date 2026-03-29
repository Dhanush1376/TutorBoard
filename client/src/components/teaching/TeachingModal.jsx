import React, { useState, useEffect, useCallback } from 'react';
import { X, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Board from '../Board';
import StepController from './StepController';
import ProgressIndicator from './ProgressIndicator';
import InlineChat from './InlineChat';

const TeachingModal = ({ isOpen, onClose, title, steps }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  const totalSteps = steps?.length || 0;
  const activeStepData = totalSteps > 0 ? steps[currentStep] : null;

  // Simple Oscillator-based "Tick" Sound
  const playStepSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
    } catch (e) {
      // Sound blocked by browser or not supported
    }
  }, []);

  // Reset on new data
  useEffect(() => {
    setCurrentStep(0);
    setIsPlaying(false);
  }, [steps]);

  // Audio cue on step change
  useEffect(() => {
    if (isOpen) playStepSound();
  }, [currentStep, isOpen, playStepSound]);

  // Auto-play loop
  useEffect(() => {
    let interval;
    if (isPlaying && totalSteps > 0) {
      const duration = 2500 / speed;
      interval = setInterval(() => {
        setCurrentStep(prev => {
          if (prev >= totalSteps - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, duration);
    }
    return () => clearInterval(interval);
  }, [isPlaying, speed, totalSteps]);

  // Voice narration
  useEffect(() => {
    if (voiceEnabled && activeStepData?.description) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(activeStepData.description);
      utterance.rate = speed;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      window.speechSynthesis.speak(utterance);
    } else {
      window.speechSynthesis.cancel();
    }
    return () => window.speechSynthesis.cancel();
  }, [currentStep, voiceEnabled, activeStepData?.description, speed]);

  // Keyboard controls
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' || e.key === 'l') handleNext();
      if (e.key === 'ArrowLeft' || e.key === 'h') handlePrev();
      if (e.key === ' ') { e.preventDefault(); handlePlayPause(); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, currentStep, isPlaying]);

  const handlePlayPause = useCallback(() => setIsPlaying(p => !p), []);
  const handlePrev = useCallback(() => {
    setCurrentStep(p => Math.max(0, p - 1));
    setIsPlaying(false);
  }, []);
  const handleNext = useCallback(() => {
    setCurrentStep(p => Math.min(totalSteps - 1, p + 1));
    setIsPlaying(false);
  }, [totalSteps]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[200] flex flex-col bg-[var(--bg-primary)] overflow-hidden"
        >
          {/* ─── 1. IMMERSIVE BOARD BACKDROP ─── */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            <Board stepData={activeStepData} />
            
            {/* Immersive Cinematic Spotlight */}
            <div 
              className="absolute inset-0 pointer-events-none transition-opacity duration-1000 bg-[radial-gradient(circle_at_50%_45%,transparent_0%,var(--bg-primary)_120%)] opacity-70"
            />
          </div>

          {/* ─── 2. TOP BAR ─── */}
          <div className="relative z-10 flex items-center justify-between px-6 pt-5">
            
            {/* Title Badge */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex items-center gap-3 bg-[var(--bg-secondary)]/80 backdrop-blur-2xl border border-[var(--border-color)] px-5 py-2.5 rounded-2xl shadow-xl"
            >
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-[0.15em]">
                {title || 'Teaching Session'}
              </span>
            </motion.div>

            {/* Right Controls */}
            <div className="flex items-center gap-2">
              {/* Voice Toggle */}
              <button
                onClick={() => setVoiceEnabled(v => !v)}
                className={`p-2.5 rounded-xl border transition-all ${
                  voiceEnabled
                    ? 'bg-[var(--text-primary)] text-[var(--bg-primary)] border-transparent'
                    : 'bg-[var(--bg-secondary)]/80 backdrop-blur-xl border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title={voiceEnabled ? 'Disable narration' : 'Enable narration'}
              >
                {voiceEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>

              {/* Close */}
              <button
                onClick={onClose}
                className="p-2.5 rounded-xl bg-[var(--bg-secondary)]/80 backdrop-blur-xl border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-all"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ─── 3. EXPLANATION PANEL ─── */}
          {activeStepData?.description && (
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              className="relative z-10 ml-6 mt-6 max-w-sm"
            >
              <div className="bg-[var(--bg-secondary)]/80 backdrop-blur-2xl border border-[var(--border-color)] rounded-2xl p-5 shadow-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest">
                    Step {currentStep + 1}
                  </span>
                  {activeStepData.type && (
                    <span className="px-2 py-0.5 bg-[var(--bg-tertiary)] rounded-full text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                      {activeStepData.type}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--text-primary)] leading-relaxed font-medium">
                  {activeStepData.description}
                </p>
                {activeStepData.animation_instructions && (
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-2 italic">
                    {activeStepData.animation_instructions}
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* ─── 4. BOTTOM CONTROL DOCK ─── */}
          <div className="relative z-10 mt-auto w-full flex flex-col items-center gap-4 pb-6 pt-8 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)]/60 to-transparent">
            
            {/* Inline Doubt Chat */}
            <div className="w-full px-6">
              <InlineChat 
                currentStep={currentStep}
                stepDescription={activeStepData?.description}
                stepData={activeStepData?.data}
              />
            </div>

            {/* Progress Bar */}
            <div className="w-full max-w-xl px-6">
              <ProgressIndicator 
                totalSteps={totalSteps} 
                currentStep={currentStep} 
                onStepClick={(i) => { setCurrentStep(i); setIsPlaying(false); }} 
              />
            </div>

            {/* Playback Controls */}
            <StepController
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              onPrev={handlePrev}
              onNext={handleNext}
              canPrev={currentStep > 0}
              canNext={currentStep < totalSteps - 1}
              speed={speed}
              onSpeedChange={setSpeed}
            />
          </div>

        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TeachingModal;
