import React, { useState, useEffect, useCallback } from 'react';
import { X, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Board from '../Board';
import StepController from './StepController';
import ProgressIndicator from './ProgressIndicator';
import InlineChat from './InlineChat';

// Domain badge styling
const DOMAIN_STYLES = {
  dsa: { bg: 'rgba(5, 150, 105, 0.15)', border: 'rgba(5, 150, 105, 0.3)', text: '#059669', label: 'DSA' },
  mathematics: { bg: 'rgba(124, 58, 237, 0.15)', border: 'rgba(124, 58, 237, 0.3)', text: '#7c3aed', label: 'Math' },
  physics: { bg: 'rgba(37, 99, 235, 0.15)', border: 'rgba(37, 99, 235, 0.3)', text: '#2563eb', label: 'Physics' },
  chemistry: { bg: 'rgba(220, 38, 38, 0.15)', border: 'rgba(220, 38, 38, 0.3)', text: '#dc2626', label: 'Chemistry' },
  biology: { bg: 'rgba(22, 163, 74, 0.15)', border: 'rgba(22, 163, 74, 0.3)', text: '#16a34a', label: 'Biology' },
  mechanical: { bg: 'rgba(217, 119, 6, 0.15)', border: 'rgba(217, 119, 6, 0.3)', text: '#d97706', label: 'Mechanical' },
  general: { bg: 'rgba(107, 114, 128, 0.15)', border: 'rgba(107, 114, 128, 0.3)', text: '#6b7280', label: 'General' },
};

const TeachingModal = ({ isOpen, onClose, title, steps, domain, visualizationType, elements, motion: motionData, connections, sequence, objects }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [doubtVisualization, setDoubtVisualization] = useState(null);

  // Derived state: should we show the original steps or a doubt visualization?
  const displaySteps = doubtVisualization?.steps || doubtVisualization?.sequence || steps || [];
  const displayTitle = doubtVisualization?.title || title || 'Teaching Session';
  const displayDomain = doubtVisualization?.domain || domain;
  const displayVizType = doubtVisualization?.visualizationType || visualizationType;
  const displayDSL = doubtVisualization?.dsl || null;
  const displayStyle = doubtVisualization?.style || 'educational';
  const displayElements = doubtVisualization?.elements || elements;
  const displayMotion = doubtVisualization?.motion || motionData;
  const displayConnections = doubtVisualization?.connections || connections;
  const displaySequence = doubtVisualization?.sequence || sequence;
  const displayObjects = doubtVisualization?.objects || objects;

  const totalSteps = displaySteps?.length || 0;
  const activeStepData = totalSteps > 0 ? displaySteps[currentStep] : null;
  const normalizedDomain = displayDomain ? displayDomain.toLowerCase() : null;

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
    setDoubtVisualization(null);
  }, [steps]);

  const handleVisualUpdate = useCallback((visualData) => {
    setDoubtVisualization(visualData);
    setCurrentStep(0);
    setIsPlaying(false);
  }, []);

  const handleClearDoubtViz = useCallback(() => {
    setDoubtVisualization(null);
    setCurrentStep(0);
    setIsPlaying(false);
  }, []);

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

  // Keyboard controls — skip when typing in inputs
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      const tag = e.target.tagName.toLowerCase();
      const isTyping = tag === 'input' || tag === 'textarea' || e.target.isContentEditable;

      if (e.key === 'Escape') onClose();

      if (!isTyping) {
        if (e.key === 'ArrowRight' || e.key === 'l') handleNext();
        if (e.key === 'ArrowLeft' || e.key === 'h') handlePrev();
        if (e.key === ' ') { e.preventDefault(); handlePlayPause(); }
      }
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
          className="absolute inset-0 z-[200] flex flex-col bg-[var(--bg-primary)] overflow-hidden"
        >
          {/* ─── 1. IMMERSIVE BOARD BACKDROP ─── */}
          <div className="absolute inset-0 z-0 overflow-hidden">
            <Board 
              stepData={activeStepData} 
              steps={displaySteps} 
              currentStep={currentStep} 
              domain={displayDomain} 
              visualizationType={displayVizType} 
              dsl={displayDSL}
              style={displayStyle}
              elements={displayElements}
              motion={displayMotion}
              sequence={displaySequence}
              connections={displayConnections}
              objects={displayObjects}
            />
            
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
              {normalizedDomain && DOMAIN_STYLES[normalizedDomain] && (
                <span 
                  className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-[0.1em]"
                  style={{ 
                    backgroundColor: DOMAIN_STYLES[normalizedDomain].bg, 
                    borderWidth: '1px',
                    borderColor: DOMAIN_STYLES[normalizedDomain].border,
                    color: DOMAIN_STYLES[normalizedDomain].text 
                  }}
                >
                  {DOMAIN_STYLES[normalizedDomain].label}
                </span>
              )}
              <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-[0.15em]">
                {displayTitle}
              </span>
            </motion.div>

            {/* Back to Lesson Button (Floating) */}
            <AnimatePresence>
              {doubtVisualization && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9, x: 20 }}
                  onClick={handleClearDoubtViz}
                  className="absolute left-1/2 -translate-x-1/2 top-5 px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-primary)] rounded-full text-[10px] font-bold uppercase tracking-widest shadow-xl hover:opacity-90 active:scale-95 transition-all z-20"
                >
                  Return to Lesson
                </motion.button>
              )}
            </AnimatePresence>

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

          {/* ─── 3. EXPLANATION PANEL (Hide for quiz mode as it has dedicated renderer) ─── */}
          {(activeStepData?.description || activeStepData?.label || activeStepData?.text || activeStepData?.type) && displayVizType !== 'quiz' && (
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
                    <span className="px-2 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-full text-[9px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                      {activeStepData.type.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[var(--text-primary)] leading-relaxed font-medium">
                  {activeStepData.description || activeStepData.label || activeStepData.text || "Visual step processing..."}
                </p>
                {(activeStepData.animation_instructions || activeStepData.animation) && (
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-2 italic">
                    {activeStepData.animation_instructions || activeStepData.animation}
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
                onVisualUpdate={handleVisualUpdate}
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
