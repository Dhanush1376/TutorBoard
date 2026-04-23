import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import VisaiLogo from '../layout/VisaiLogo';

const CinematicTransition = ({ userName, isLogin, onComplete }) => {
  const [phase, setPhase] = useState('focus'); // focus -> welcome -> ascension
  const displayName = userName || 'Explorer';
  const greeting = isLogin ? `Welcome back, ${displayName}` : `Welcome to the future, ${displayName}`;

  useEffect(() => {
    // Phase 1: Focus (Logo & Background Initialization)
    const t1 = setTimeout(() => setPhase('welcome'), 1200);
    // Phase 2: Welcome (Typewriter & Greeting)
    const t2 = setTimeout(() => setPhase('ascension'), 3800);
    // Phase 3: Ascension (Final Fade & Callback)
    const t3 = setTimeout(() => onComplete?.(), 4800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div 
      className="fixed inset-0 z-[99999] overflow-hidden flex items-center justify-center font-sans transition-colors duration-700 select-none"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* CINEMATIC OVERLAYS */}
      <div className="absolute inset-0 z-[10] pointer-events-none opacity-[0.03] mix-blend-overlay">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          <filter id="noiseFilter">
            <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#noiseFilter)" />
        </svg>
      </div>

      {/* Skip Button */}
      <motion.button
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 0.6, y: 0 }}
        whileHover={{ opacity: 1, scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onComplete?.()}
        className="absolute top-10 right-10 z-[100] px-6 py-2.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-xl text-[10px] font-normal uppercase tracking-[0.2em] text-white transition-all shadow-lg flex items-center gap-2 group"
      >
        <span>Skip Introduction</span>
        <motion.div animate={{ x: [0, 4, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </motion.div>
      </motion.button>
      
      {/* STEP 1: LIVING BACKGROUND (Branded Atmosphere) */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            x: [0, 80, 0],
            y: [0, -50, 0],
            rotate: [0, 45, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/4 -left-1/4 w-[120vw] h-[120vw] rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--text-tertiary) 0%, transparent 60%)',
            filter: 'blur(160px)',
            opacity: 0.15
          }}
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            x: [0, -100, 0],
            y: [0, 80, 0],
            rotate: [0, -30, 0]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-1/4 -right-1/4 w-[110vw] h-[110vw] rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--text-primary) 0%, transparent 60%)',
            filter: 'blur(180px)',
            opacity: 0.1
          }}
        />
        
        {/* Particle Overlay */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          {[...Array(15)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                x: Math.random() * 100 + '%', 
                y: Math.random() * 100 + '%',
                opacity: 0 
              }}
              animate={{ 
                y: [null, '-=10%'],
                opacity: [0, 0.4, 0]
              }}
              transition={{ 
                duration: Math.random() * 5 + 5, 
                repeat: Infinity, 
                delay: Math.random() * 5 
              }}
              className="absolute w-1 h-1 bg-white rounded-full blur-[1px]"
            />
          ))}
        </div>

        <div className="absolute inset-0 bg-[var(--bg-primary)]/50 backdrop-blur-[40px]" />
      </div>

      {/* STEP 2: LOGO & CORE LIGHT */}
      <AnimatePresence mode="wait">
        {phase === 'focus' && (
          <motion.div
            key="logo-phase"
            initial={{ opacity: 0, scale: 0.8, filter: 'blur(30px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.2, filter: 'blur(40px)' }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex flex-col items-center gap-12"
          >
            <div className="relative">
               <motion.div 
                 animate={{ 
                   scale: [1, 1.5, 1], 
                   opacity: [0.1, 0.25, 0.1],
                   rotate: 360
                 }}
                 transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                 className="absolute inset-[-60px] bg-gradient-to-tr from-[var(--text-primary)] to-transparent blur-[100px] rounded-full"
               />
               <VisaiLogo size="xl" className="relative z-10 text-[var(--text-primary)]" />
            </div>
            <div className="flex flex-col items-center gap-4">
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 0.5, y: 0 }}
                transition={{ delay: 0.5 }}
                className="text-[10px] font-normal uppercase tracking-[0.8em] text-[var(--text-primary)] translate-x-[0.4em]"
              >
                TutorBoard
              </motion.p>
              <div className="h-[1px] w-8 bg-[var(--text-primary)] opacity-20" />
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                transition={{ delay: 0.8 }}
                className="text-[9px] font-normal uppercase tracking-[0.3em] text-[var(--text-secondary)] italic"
              >
                Orchestrating Knowledge
              </motion.p>
            </div>
          </motion.div>
        )}

        {/* STEP 3: WELCOME SEQUENCE */}
        {(phase === 'welcome' || phase === 'ascension') && (
          <motion.div
            key="welcome-phase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98, filter: 'blur(30px)' }}
            className="relative z-20 text-center px-12"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="mb-6 flex justify-center"
            >
              <div className="px-4 py-1 rounded-full border border-white/5 bg-white/5 backdrop-blur-sm text-[9px] font-normal uppercase tracking-[0.4em] text-[var(--text-tertiary)] opacity-60">
                Connection Established
              </div>
            </motion.div>

            <motion.h1
              className="text-[42px] md:text-[72px] font-serif text-[var(--text-primary)] tracking-tight mb-10 leading-[1.1] italic font-light"
              initial={{ opacity: 0, y: 40, filter: 'blur(20px)', scale: 0.9 }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 }}
              transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
            >
              {greeting}
            </motion.h1>
            
            <div className="relative h-[2px] w-64 mx-auto mb-10">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 3, delay: 0.5, ease: "circOut" }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--text-primary)] to-transparent opacity-30"
              />
              <motion.div
                animate={{ 
                  left: ['-10%', '110%'],
                  opacity: [0, 1, 0]
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-0 w-12 h-full bg-white blur-sm"
              />
            </div>
            
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 1.2 }}
              className="flex flex-col items-center gap-6"
            >
              <div className="flex items-center gap-3">
                 <motion.div 
                   animate={{ rotate: 360 }}
                   transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                   className="w-1.5 h-1.5 rounded-full border border-[var(--text-primary)] border-t-transparent"
                 />
                 <p className="text-[11px] font-normal uppercase tracking-[0.6em] text-[var(--text-secondary)] opacity-50">
                   Preparing your personal canvas
                 </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* STEP 4: FINAL ASCENSION FLASH */}
      <AnimatePresence>
        {phase === 'ascension' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, ease: "easeInOut" }}
            className="absolute inset-0 z-[1000] pointer-events-none backdrop-blur-3xl"
            style={{ background: 'var(--bg-primary)' }}
          >
            <motion.div 
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1.5, opacity: 1 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 bg-[var(--text-primary)] opacity-5 rounded-full blur-[100px]"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute bottom-12 left-0 right-0 text-center pointer-events-none">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.2 }}
          transition={{ delay: 1 }}
          className="flex flex-col items-center gap-2"
        >
          <span className="text-[9px] font-normal uppercase tracking-[1em] text-[var(--text-primary)] translate-x-[0.5em]">
            TutorBoard Engine v4.2
          </span>
          <div className="flex gap-4 items-center">
            <div className="w-1 h-1 rounded-full bg-[var(--text-primary)] opacity-30" />
            <div className="w-1 h-1 rounded-full bg-[var(--text-primary)] opacity-30" />
            <div className="w-1 h-1 rounded-full bg-[var(--text-primary)] opacity-30" />
          </div>
        </motion.div>
      </div>

    </div>
  );
};

export default CinematicTransition;
