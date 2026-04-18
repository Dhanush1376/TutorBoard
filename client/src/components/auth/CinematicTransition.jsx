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
      className="fixed inset-0 z-[99999] overflow-hidden flex items-center justify-center font-sans transition-colors duration-700"
      style={{ background: 'var(--bg-primary)' }}
    >
      
      {/* ── STEP 1: LIVING BACKGROUND (Branded Atmosphere) ── */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-40">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            x: [0, 50, 0],
            y: [0, -30, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/4 -left-1/4 w-[80vw] h-[80vw] rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--text-tertiary) 0%, transparent 70%)',
            filter: 'blur(100px)',
            opacity: 0.15
          }}
        />
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            x: [0, -40, 0],
            y: [0, 40, 0],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-1/4 -right-1/4 w-[70vw] h-[70vw] rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--text-primary) 0%, transparent 70%)',
            filter: 'blur(120px)',
            opacity: 0.1
          }}
        />
      </div>

      {/* ── STEP 2: LOGO & CORE LIGHT ── */}
      <AnimatePresence mode="wait">
        {phase === 'focus' && (
          <motion.div
            key="logo-phase"
            initial={{ opacity: 0, scale: 0.9, filter: 'blur(15px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.05, filter: 'blur(20px)' }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex flex-col items-center gap-8"
          >
            <div className="relative">
               <motion.div 
                 animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.2, 0.1] }}
                 transition={{ duration: 3, repeat: Infinity }}
                 className="absolute inset-0 bg-[var(--text-primary)] blur-[60px] rounded-full"
               />
               <VisaiLogo size="xl" className="relative z-10 text-[var(--text-primary)]" />
            </div>
            <p className="text-[11px] font-black uppercase tracking-[0.5em] text-[var(--text-tertiary)] opacity-60">
              Synchronizing Intelligence
            </p>
          </motion.div>
        )}

        {/* ── STEP 3: WELCOME SEQUENCE ── */}
        {(phase === 'welcome' || phase === 'ascension') && (
          <motion.div
            key="welcome-phase"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98, filter: 'blur(10px)' }}
            className="relative z-20 text-center px-8"
          >
            <motion.h1
              className="text-[34px] md:text-[52px] font-serif text-[var(--text-primary)] tracking-tight mb-6 leading-tight"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {greeting}
            </motion.h1>
            
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '30%' }}
              transition={{ duration: 2, delay: 0.3, ease: "easeInOut" }}
              className="h-[1.5px] mx-auto bg-gradient-to-r from-transparent via-[var(--text-primary)] to-transparent opacity-30"
            />
            
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 1 }}
              className="mt-8 text-[12px] font-black uppercase tracking-[0.4em] text-[var(--text-tertiary)]"
            >
              Building your learning landscape
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── STEP 4: FINAL ASCENSION FLASH ── */}
      <AnimatePresence>
        {phase === 'ascension' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="absolute inset-0 z-[100] pointer-events-none"
            style={{ background: 'var(--text-primary)' }}
          />
        )}
      </AnimatePresence>

      <div className="absolute bottom-12 left-0 right-0 text-center pointer-events-none">
        <span className="text-[10px] font-black uppercase tracking-[0.6em] text-[var(--text-tertiary)] opacity-30">
          TutorBoard · Advanced Orchestration
        </span>
      </div>

    </div>
  );
};

export default CinematicTransition;
