/**
 * narrationTiming.ts — shared timing model for narration-gated playback.
 *
 * A step may only advance when BOTH its animation timeline and its narration
 * have finished. When real TTS is active we get an exact end event; when it
 * isn't (voice muted, SSE lessons, TTS failure) we fall back to these
 * estimates so pacing still follows the narration's length.
 */

/** Estimated silent-reading time for subtitle-only playback. */
export function estimateReadingMs(text, speed = 1) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 800;
  const base = words * 240 + 900; // ~250 wpm + settle time
  const clamped = Math.min(14000, Math.max(1800, base));
  return clamped / Math.max(0.25, speed);
}

/** Estimated speech time for TTS (used as a safety ceiling). */
export function estimateSpeechMs(text, rate = 1) {
  const chars = String(text || '').trim().length;
  if (chars === 0) return 800;
  const base = (chars / 14) * 1000 + 600; // ~14 chars/sec at rate 1
  return Math.min(45000, Math.max(1500, base)) / Math.max(0.5, rate);
}

/**
 * Smart pause after a step completes, before the next begins — longer for
 * content that deserves absorption time (equations, results, diagrams).
 */
export function smartPauseMs(step, speed = 1) {
  const type = (step?.type || '').toLowerCase();
  const hasFormula = Boolean(step?.keyFormula) || type.includes('equation') || type.includes('formula');
  const isConclusion = type.includes('result') || type.includes('summary') || type.includes('conclusion');
  const base = hasFormula || isConclusion ? 1200 : 550;
  return base / Math.max(0.25, speed);
}

/**
 * Absolute ceiling for waiting on a step's completion signals. Guarantees
 * playback can never stall even if a signal is lost.
 */
export function stepDeadlineMs(step, speed = 1) {
  const narration = step?.narration || step?.explanation || step?.pedagogicalNarration || '';
  const estimate = Math.max(estimateReadingMs(narration, speed), estimateSpeechMs(narration, speed));
  const declared = step?.durationMs || step?.duration || 0;
  return Math.max(estimate * 1.6, declared / Math.max(0.25, speed), 6000);
}
