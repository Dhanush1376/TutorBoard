/**
 * useScenePerformance v1.0 — Performance Monitoring & Quality Scaling Hook
 *
 * Provides:
 * - Real-time FPS counter with rolling average
 * - Memory pressure detection (via Performance API)
 * - Automatic quality tier scaling when FPS drops
 * - prefers-reduced-motion detection
 * - Performance budget enforcement
 */

import { useRef, useState, useEffect, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface QualityTier {
  label: string;
  enableBlur: boolean;
  enableShadows: boolean;
  enableParticles: boolean;
  maxEntities: number;
  animationFidelity: number;
}

export type QualityTierName = 'ULTRA' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL';

export interface PerformanceConfig {
  targetFPS?: number;
  upgradeFPS?: number;
  sampleWindowMs?: number;
  downgradeCooldownMs?: number;
  upgradeCooldownMs?: number;
  enableAutoScaling?: boolean;
}

// ── Quality Tiers ────────────────────────────────────────────────────────────

export const QUALITY_TIERS: Record<QualityTierName, QualityTier> = {
  ULTRA:    { label: 'Ultra',    enableBlur: true,  enableShadows: true,  enableParticles: true,  maxEntities: 500, animationFidelity: 1.0 },
  HIGH:     { label: 'High',     enableBlur: true,  enableShadows: true,  enableParticles: false, maxEntities: 300, animationFidelity: 0.8 },
  MEDIUM:   { label: 'Medium',   enableBlur: false, enableShadows: true,  enableParticles: false, maxEntities: 200, animationFidelity: 0.6 },
  LOW:      { label: 'Low',      enableBlur: false, enableShadows: false, enableParticles: false, maxEntities: 100, animationFidelity: 0.4 },
  MINIMAL:  { label: 'Minimal',  enableBlur: false, enableShadows: false, enableParticles: false, maxEntities: 50,  animationFidelity: 0.2 },
};

const TIER_ORDER: QualityTierName[] = ['ULTRA', 'HIGH', 'MEDIUM', 'LOW', 'MINIMAL'];

// ── Configuration ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Required<PerformanceConfig> = {
  targetFPS: 55,
  upgradeFPS: 58,
  sampleWindowMs: 2000,
  downgradeCooldownMs: 5000,
  upgradeCooldownMs: 10000,
  enableAutoScaling: true,
};

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useScenePerformance(config: PerformanceConfig = {}) {
  const settings = { ...DEFAULT_CONFIG, ...config };

  const [fps, setFps] = useState<number>(60);
  const [qualityTier, setQualityTier] = useState<QualityTierName>('ULTRA');
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [isMonitoring, setIsMonitoring] = useState<boolean>(false);

  const frameTimesRef = useRef<number[]>([]);
  const rafIdRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  const lastDowngradeRef = useRef<number>(0);
  const lastUpgradeRef = useRef<number>(0);
  const tierIndexRef = useRef<number>(0);

  // ── Auto-Scaling Logic ─────────────────────────────────────────────────

  const _autoScale = useCallback((currentFps: number, now: number) => {
    if (currentFps < settings.targetFPS) {
      if (now - lastDowngradeRef.current > settings.downgradeCooldownMs) {
        const nextIndex = Math.min(tierIndexRef.current + 1, TIER_ORDER.length - 1);
        if (nextIndex !== tierIndexRef.current) {
          tierIndexRef.current = nextIndex;
          setQualityTier(TIER_ORDER[nextIndex]);
          lastDowngradeRef.current = now;
          console.log(`[ScenePerformance] ⬇️ Downgraded to ${TIER_ORDER[nextIndex]} (FPS: ${currentFps})`);
        }
      }
    }
    else if (currentFps > settings.upgradeFPS) {
      if (now - lastUpgradeRef.current > settings.upgradeCooldownMs) {
        const nextIndex = Math.max(tierIndexRef.current - 1, 0);
        if (nextIndex !== tierIndexRef.current) {
          tierIndexRef.current = nextIndex;
          setQualityTier(TIER_ORDER[nextIndex]);
          lastUpgradeRef.current = now;
          console.log(`[ScenePerformance] ⬆️ Upgraded to ${TIER_ORDER[nextIndex]} (FPS: ${currentFps})`);
        }
      }
    }
  }, [settings.targetFPS, settings.upgradeFPS, settings.downgradeCooldownMs, settings.upgradeCooldownMs]);

  // ── FPS Monitoring Loop ────────────────────────────────────────────────

  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;
    setIsMonitoring(true);
    frameTimesRef.current = [];
    lastFrameRef.current = performance.now();

    const tick = (now: number) => {
      let delta = now - lastFrameRef.current;
      lastFrameRef.current = now;

      // ── Harden: Cap delta to prevent spikes (e.g. tab switching) ───────────
      // If delta > 500ms, we assume the tab was inactive and reset the window
      if (delta > 500) {
        frameTimesRef.current = [];
        delta = 16; // Assume 60fps for the first frame after wake
      } else if (delta > 200) {
        delta = 200; // Cap at 5fps equivalent for heavy spikes
      }

      frameTimesRef.current.push(delta);

      // ── Optimized Windowing ──────────────────────────────────────────────
      const cutoff = settings.sampleWindowMs;
      let totalTime = 0;
      let count = 0;
      const filtered: number[] = [];
      
      // Iterate backwards and collect frames within the sample window
      for (let i = frameTimesRef.current.length - 1; i >= 0; i--) {
        const t = frameTimesRef.current[i];
        if (totalTime + t > cutoff) break;
        totalTime += t;
        filtered.push(t);
        count++;
      }
      
      // Update ref with pruned array (maintain order)
      frameTimesRef.current = filtered.reverse();

      if (count > 2) { // Need at least a few samples for a stable average
        const avgDelta = totalTime / count;
        const currentFps = Math.round(1000 / avgDelta);
        setFps(currentFps);

        if (settings.enableAutoScaling && !reducedMotion) {
          _autoScale(currentFps, now);
        }
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
  }, [isMonitoring, settings.sampleWindowMs, settings.enableAutoScaling, reducedMotion, _autoScale]);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  // ── Reduced Motion Detection ───────────────────────────────────────────

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);

    if (mq.matches) {
      setQualityTier('MINIMAL');
      tierIndexRef.current = 4;
    }

    const handler = (e: MediaQueryListEvent) => {
      setReducedMotion(e.matches);
      if (e.matches) {
        setQualityTier('MINIMAL');
        tierIndexRef.current = 4;
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // ── Manual Tier Override ───────────────────────────────────────────────

  const setTier = useCallback((tier: QualityTierName) => {
    const index = TIER_ORDER.indexOf(tier);
    if (index >= 0) {
      tierIndexRef.current = index;
      setQualityTier(tier);
    }
  }, []);

  // ── Cleanup ────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return {
    fps,
    qualityTier,
    quality: QUALITY_TIERS[qualityTier],
    reducedMotion,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    setTier,
  };
}

export default useScenePerformance;
