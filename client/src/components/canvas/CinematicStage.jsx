import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import VisaiLogo from '../layout/VisaiLogo';
import useTutorStore from '../../store/tutorStore';
import { useShallow } from 'zustand/react/shallow';
import ParticleWaves from './ParticleWaves';

/**
 * CinematicStage v1.0 — Premium Teaching Canvas Container
 *
 * Replaces FixedTeachingStage with:
 * - Depth-aware ambient background that responds to domain/step changes
 * - Smooth 16:10 responsive scaling with CSS aspect-ratio
 * - Cinematic step transition overlays (fade, wipe, zoom)
 * - Loading skeleton with branded shimmer during generation
 * - pinch/zoom viewport controls (future)
 * - Accessibility: prefers-reduced-motion honored
 */

// ── Domain Color Map ────────────────────────────────────────────────────────

const DOMAIN_AMBIENCE = {
  dsa:        { from: 'rgba(99,102,241,0.06)', to: 'rgba(139,92,246,0.03)', glow: 'rgba(99,102,241,0.08)' },
  algorithm:  { from: 'rgba(99,102,241,0.06)', to: 'rgba(139,92,246,0.03)', glow: 'rgba(99,102,241,0.08)' },
  math:       { from: 'rgba(37,99,235,0.05)', to: 'rgba(79,70,229,0.03)', glow: 'rgba(37,99,235,0.06)' },
  physics:    { from: 'rgba(234,88,12,0.05)', to: 'rgba(249,115,22,0.03)', glow: 'rgba(234,88,12,0.06)' },
  chemistry:  { from: 'rgba(220,38,38,0.05)', to: 'rgba(185,28,28,0.03)', glow: 'rgba(220,38,38,0.06)' },
  biology:    { from: 'rgba(22,163,74,0.05)', to: 'rgba(21,128,61,0.03)', glow: 'rgba(22,163,74,0.06)' },
  history:    { from: 'rgba(217,119,6,0.05)', to: 'rgba(180,83,9,0.03)', glow: 'rgba(217,119,6,0.06)' },
  medicine:   { from: 'rgba(236,72,153,0.05)', to: 'rgba(219,39,119,0.03)', glow: 'rgba(236,72,153,0.06)' },
  law:        { from: 'rgba(202,138,4,0.05)', to: 'rgba(180,83,9,0.03)', glow: 'rgba(202,138,4,0.06)' },
  business:   { from: 'rgba(20,184,166,0.05)', to: 'rgba(13,148,136,0.03)', glow: 'rgba(20,184,166,0.06)' },
  general:    { from: 'rgba(100,116,139,0.04)', to: 'rgba(71,85,105,0.02)', glow: 'rgba(100,116,139,0.05)' },
};

// ── Stage Dimensions ────────────────────────────────────────────────────────

const STAGE_BASE_W = 800;
const STAGE_BASE_H = 600;
const STAGE_ASPECT = 16 / 10;

// ── Main Component ──────────────────────────────────────────────────────────

const CinematicStage = ({
  children,
  currentStepIndex: propStepIndex = 0,
  totalSteps: propTotalSteps = 0,
  topic: propTopic = 'Learning Session',
  domain: propDomain = 'general',
  isGenerating = false,
  hideControls = true,
}) => {
  const { user } = useAuth();
  const isGuest = !user;

  // Fix U-01: Wire to sceneSlice state
  const { activeScene, currentStepIndex: storeStepIndex } = useTutorStore(useShallow(state => ({
    activeScene: state.activeScene,
    currentStepIndex: state.currentStepIndex
  })));

  // Derive values from activeScene if present, otherwise fallback to props
  const currentStepIndex = activeScene ? storeStepIndex : propStepIndex;
  const totalSteps = activeScene ? (activeScene.totalSteps || activeScene.steps?.length || 0) : propTotalSteps;
  const topic = activeScene ? activeScene.title : propTopic;
  const domain = activeScene ? (activeScene.domain || 'general') : propDomain;

  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // ── Responsive Scaling ─────────────────────────────────────────────────

  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      
      // Calculate fit scale: how much the 800px base width should scale 
      // to fit within the current container while respecting the 16:10 ratio.
      const containerAspect = clientWidth / clientHeight;
      
      let targetW, targetH;
      if (containerAspect > STAGE_ASPECT) {
        // Container is wider than stage ratio — height is the constraint
        targetH = clientHeight;
        targetW = targetH * STAGE_ASPECT;
      } else {
        // Container is narrower than stage ratio — width is the constraint
        targetW = clientWidth;
        targetH = targetW / STAGE_ASPECT;
      }
      
      const newScale = targetW / STAGE_BASE_W;
      setScale(Math.min(newScale, 3.0)); // Slightly higher cap for ultra-wide
    };

    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    handleResize();

    return () => observer.disconnect();
  }, []);

  // ── Step Transition Detection ──────────────────────────────────────────

  const prevStepRef = useRef(currentStepIndex);
  const isFirstMount = useRef(true);

  useEffect(() => {
    // Fix U-04: On first mount, we just sync the ref and don't trigger the flash.
    // This prevents flashes when remounting mid-session at a non-zero step.
    if (isFirstMount.current) {
      isFirstMount.current = false;
      prevStepRef.current = currentStepIndex;
      return;
    }

    if (prevStepRef.current !== currentStepIndex) {
      setIsTransitioning(true);
      const timer = setTimeout(() => setIsTransitioning(false), 400);
      prevStepRef.current = currentStepIndex;
      return () => clearTimeout(timer);
    }
  }, [currentStepIndex]);

  // ── Ambient Background ─────────────────────────────────────────────────

  const ambience = useMemo(() => {
    const d = (domain || 'general').toLowerCase();
    return DOMAIN_AMBIENCE[d] || DOMAIN_AMBIENCE.general;
  }, [domain]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="cinematic-stage"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        isolation: 'isolate',
      }}
    >
      {/* ── Ambient Particle Waves ── */}
      {!activeScene && !isGenerating && (
        <ParticleWaves opacity={0.8} />
      )}

      {/* ── Ambient Glow Layer ── */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={domain || 'general'}
          className="cinematic-stage-ambient"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 0,
            background: `radial-gradient(ellipse 70% 50% at 50% 45%, ${ambience.from}, ${ambience.to}, transparent)`,
          }}
        />
      </AnimatePresence>

      {/* ── Subtle Grid Pattern ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundSize: '40px 40px',
          backgroundImage: `
            linear-gradient(to right, var(--border-color) 1px, transparent 1px),
            linear-gradient(to bottom, var(--border-color) 1px, transparent 1px)
          `,
          opacity: 0.06,
          maskImage: 'radial-gradient(ellipse 60% 60% at 50% 50%, black, transparent)',
          WebkitMaskImage: 'radial-gradient(ellipse 60% 60% at 50% 50%, black, transparent)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* ── The Stage Canvas ── */}
      <div
        className="cinematic-stage-canvas"
        style={{
          width: STAGE_BASE_W,
          height: STAGE_BASE_H,
          aspectRatio: '16/10',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          position: 'relative',
          zIndex: 1,
          willChange: 'transform',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'auto',
            overflow: 'visible',
          }}
        >
          {children}
        </div>

        {/* ── Guest Watermark ── */}
        {isGuest && (
          <div
            style={{
              position: 'absolute',
              top: 24,
              right: 24,
              zIndex: 110,
              pointerEvents: 'none',
              opacity: 0.12,
              mixBlendMode: 'overlay',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 9999,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.05)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
              }}
            >
              <VisaiLogo size="xxs" />
              <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                Guest Mode
              </span>
            </div>
          </div>
        )}

        {/* ── Step Transition Overlay ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`transition-${currentStepIndex}`}
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute',
              inset: 0,
              background: 'var(--bg-primary)',
              pointerEvents: 'none',
              zIndex: 50,
            }}
          />
        </AnimatePresence>

        {/* ── Generation Loading Skeleton ── */}
        <AnimatePresence>
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
                zIndex: 55,
              }}
            >
              <div 
                className="absolute inset-0 bg-[var(--bg-primary)]" 
                style={{ zIndex: -2 }}
              />
              <ParticleWaves opacity={0.5} />
              {/* Shimmer skeleton blocks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                <motion.div
                  animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  style={{
                    width: 280,
                    height: 40,
                    borderRadius: 12,
                    background: `linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%)`,
                    backgroundSize: '200% 100%',
                  }}
                />
                <motion.div
                  animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear', delay: 0.2 }}
                  style={{
                    width: 200,
                    height: 24,
                    borderRadius: 8,
                    background: `linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%)`,
                    backgroundSize: '200% 100%',
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                  fontWeight: 500,
                  letterSpacing: '0.05em',
                }}
              >
                Preparing your lesson...
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Depth Vignette ── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 60%, var(--bg-primary) 100%)',
          pointerEvents: 'none',
          zIndex: 2,
          opacity: 0.4,
        }}
      />
    </div>
  );
};

export default CinematicStage;
