'use client';

import React, { useRef, useCallback, useEffect } from 'react';
import './BorderGlow.css';

function parseHSL(hslStr) {
  const match = hslStr.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
  if (!match) return { h: 270, s: 80, l: 80 };
  return { h: parseFloat(match[1]), s: parseFloat(match[2]), l: parseFloat(match[3]) };
}

function buildGlowVars(glowColor, intensity) {
  const { h, s, l } = parseHSL(glowColor);
  const base = `${h}deg ${s}% ${l}%`;
  const opacities = [100, 60, 50, 40, 30, 20, 10];
  const keys = ['', '-60', '-50', '-40', '-30', '-20', '-10'];
  const vars = {};
  for (let i = 0; i < opacities.length; i++) {
    vars[`--glow-color${keys[i]}`] = `hsl(${base} / ${Math.min(opacities[i] * intensity, 100)}%)`;
  }
  return vars;
}

const GRADIENT_POSITIONS = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%'];
const GRADIENT_KEYS = ['--gradient-one', '--gradient-two', '--gradient-three', '--gradient-four', '--gradient-five', '--gradient-six', '--gradient-seven'];
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1];

function buildGradientVars(colors) {
  const vars = {};
  for (let i = 0; i < 7; i++) {
    const c = colors[Math.min(COLOR_MAP[i], colors.length - 1)];
    vars[GRADIENT_KEYS[i]] = `radial-gradient(at ${GRADIENT_POSITIONS[i]}, ${c} 0px, transparent 50%)`;
  }
  vars['--gradient-base'] = `linear-gradient(${colors[0]} 0 100%)`;

  // Sparkling beam: sharp white diamond spark glint at apex (0deg) with warm orange tail
  const cApex = colors[0] || '#ffffff';
  const cBody = colors[1] || '#fb923c';
  const cTail = colors[2] || '#ea580c';
  const isWhiteApex = !cApex.startsWith('#') || cApex.toLowerCase() === '#ffffff' || cApex.toLowerCase() === '#fff';

  if (isWhiteApex) {
    vars['--spark-beam'] = `conic-gradient(from var(--cursor-angle) at center, #ffffff 0deg, rgba(255, 255, 255, 0.96) 1.5deg, #fdba74 4.5deg, ${cBody} 12deg, ${cTail} 24deg, transparent 38deg, transparent 322deg, ${cTail} 336deg, ${cBody} 348deg, #fdba74 355.5deg, rgba(255, 255, 255, 0.96) 358.5deg, #ffffff 360deg)`;
  } else {
    vars['--spark-beam'] = `conic-gradient(from var(--cursor-angle) at center, ${cApex} 0deg, ${cBody} 14deg, ${cTail} 28deg, transparent 42deg, transparent 318deg, ${cTail} 332deg, ${cBody} 346deg, ${cApex} 360deg)`;
  }

  return vars;
}

function isLightColor(color) {
  if (!color || typeof color !== 'string') return false;
  if (color.startsWith('var(')) return false;
  const value = color.trim().replace('#', '');
  if (!/^[\da-f]{3}([\da-f]{3})?$/i.test(value)) return false;
  const hex = value.length === 3 ? value.split('').map(char => char + char).join('') : value;
  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return red * 0.2126 + green * 0.7152 + blue * 0.0722 > 180;
}

function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
function easeInCubic(x) { return x * x * x; }

function animateValue({ start = 0, end = 100, duration = 1000, delay = 0, ease = easeOutCubic, onUpdate, onEnd }) {
  const t0 = performance.now() + delay;
  function tick() {
    const elapsed = performance.now() - t0;
    const t = Math.min(elapsed / duration, 1);
    onUpdate(start + (end - start) * ease(t));
    if (t < 1) requestAnimationFrame(tick);
    else if (onEnd) onEnd();
  }
  setTimeout(() => requestAnimationFrame(tick), delay);
}

const BorderGlow = ({
  children,
  className = '',
  edgeSensitivity = 20,
  glowColor = '26 92% 58%',
  backgroundColor = 'var(--bg-primary, #000000)',
  borderRadius = 9999,
  glowRadius = 10,
  glowIntensity = 0.35,
  coneSpread = 20,
  speed = 0.016,
  animated = false,
  isFocused = false,
  hoverGlow = false,
  colors = ['#ffffff', '#fb923c', '#ea580c'],
  fillOpacity = 0,
  style = {},
  onClick,
  ...restProps
}) => {
  const cardRef = useRef(null);

  const getCenterOfElement = useCallback((el) => {
    const { width, height } = el.getBoundingClientRect();
    return [width / 2, height / 2];
  }, []);

  const getEdgeProximity = useCallback((el, x, y) => {
    const [cx, cy] = getCenterOfElement(el);
    const dx = x - cx;
    const dy = y - cy;
    let kx = Infinity;
    let ky = Infinity;
    if (dx !== 0) kx = cx / Math.abs(dx);
    if (dy !== 0) ky = cy / Math.abs(dy);
    return Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
  }, [getCenterOfElement]);

  const getCursorAngle = useCallback((el, x, y) => {
    const [cx, cy] = getCenterOfElement(el);
    const dx = x - cx;
    const dy = y - cy;
    if (dx === 0 && dy === 0) return 0;
    const radians = Math.atan2(dy, dx);
    let degrees = radians * (180 / Math.PI) + 90;
    if (degrees < 0) degrees += 360;
    return degrees;
  }, [getCenterOfElement]);

  const handlePointerEnter = useCallback(() => {
    if (hoverGlow && !isFocused && cardRef.current) {
      animateValue({
        start: parseFloat(cardRef.current.style.getPropertyValue('--edge-proximity')) || 0,
        end: 100,
        duration: 160,
        onUpdate: (v) => cardRef.current?.style.setProperty('--edge-proximity', v),
      });
    }
  }, [hoverGlow, isFocused]);

  const handlePointerLeave = useCallback(() => {
    if (hoverGlow && !isFocused && cardRef.current) {
      animateValue({
        start: parseFloat(cardRef.current.style.getPropertyValue('--edge-proximity')) || 100,
        end: 0,
        duration: 280,
        onUpdate: (v) => cardRef.current?.style.setProperty('--edge-proximity', v),
      });
    }
  }, [hoverGlow, isFocused]);

  const handlePointerMove = useCallback((e) => {
    const card = cardRef.current;
    if (!card || isFocused) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const angle = getCursorAngle(card, x, y);
    card.style.setProperty('--cursor-angle', `${angle.toFixed(3)}deg`);

    if (!hoverGlow) {
      const edge = getEdgeProximity(card, x, y);
      card.style.setProperty('--edge-proximity', `${(edge * 100).toFixed(3)}`);
    } else {
      card.style.setProperty('--edge-proximity', '100');
    }
  }, [getEdgeProximity, getCursorAngle, isFocused, hoverGlow]);

  // Focus-triggered animation: organic fluid flow momentum + corner white spark glint
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    let animFrameId = null;
    let isCancelled = false;

    if (isFocused) {
      card.classList.add('sweep-active', 'is-focused');

      // Smoothly ramp up edge-proximity
      animateValue({
        start: parseFloat(card.style.getPropertyValue('--edge-proximity')) || 0,
        end: 100,
        duration: 180,
        onUpdate: (v) => card.style.setProperty('--edge-proximity', v),
      });

      let currentAngle = parseFloat(card.style.getPropertyValue('--cursor-angle')) || 90;
      const startTime = performance.now();
      let lastTime = startTime;

      // Natural fluid physics parameters:
      // Starts right at idle speed (zero shock), crests like a gentle wave over ~380ms,
      // and asymptotically coasts into slow idle drift via continuous fluid damping.
      const tRise = 380;
      const boostAmp = 0.26;
      const idleSpeed = speed;

      const loop = (now) => {
        if (isCancelled) return;
        const delta = Math.min(now - lastTime, 64);
        lastTime = now;

        const elapsed = now - startTime;
        const tau = Math.max(0, elapsed / tRise);
        // Seamless impulse response: continuous derivative everywhere (zero artificial jerk)
        const boost = boostAmp * tau * Math.exp(1 - tau);
        const currentSpeed = idleSpeed + boost;

        currentAngle = (currentAngle + delta * currentSpeed) % 360;
        card.style.setProperty('--cursor-angle', `${currentAngle.toFixed(2)}deg`);

        // Corner / Accent point luminous bloom (like pic 2):
        // As the slow drift passes the curved corner (around 90deg and 270deg),
        // the glow softly expands into that luminous, dreamy atmospheric bloom for ~1 second
        const angleMod = currentAngle % 360;
        const distFromRightCorner = Math.abs(angleMod - 90);
        const distFromLeftCorner = Math.abs(angleMod - 270);
        const minDist = Math.min(distFromRightCorner, distFromLeftCorner);

        // Within 28deg of the corner apex:
        let cornerBloom = 0;
        if (minDist < 28) {
          cornerBloom = Math.pow(Math.cos((minDist / 28) * (Math.PI / 2)), 2);
        }

        // Bloom is prominent when moving slowly at the corner
        const slowFactor = Math.max(0, Math.min(1, 1 - boost / (boostAmp * 0.4)));
        const activeBloom = cornerBloom * slowFactor;

        // Dynamic bloom: outer padding, cone spread, and glow opacity smoothly swell at the corner
        const dynamicRadius = glowRadius + 4 * activeBloom;
        const dynamicCone = coneSpread + 4 * activeBloom;

        card.style.setProperty('--glow-padding', `${dynamicRadius.toFixed(1)}px`);
        card.style.setProperty('--cone-spread', dynamicCone.toFixed(1));
        card.style.setProperty('--corner-bloom', activeBloom.toFixed(3));

        animFrameId = requestAnimationFrame(loop);
      };

      animFrameId = requestAnimationFrame(loop);
    } else {
      card.classList.remove('is-focused');

      const startVal = parseFloat(card.style.getPropertyValue('--edge-proximity')) || 0;
      if (startVal > 0) {
        animateValue({
          start: startVal,
          end: 0,
          duration: 350,
          onUpdate: (v) => card.style.setProperty('--edge-proximity', v),
          onEnd: () => {
            if (!isFocused) card.classList.remove('sweep-active');
          },
        });
      } else {
        card.classList.remove('sweep-active');
      }
    }

    return () => {
      isCancelled = true;
      if (animFrameId) cancelAnimationFrame(animFrameId);
    };
  }, [isFocused, speed]);

  // Intro sweep animation on mount if animated prop is true
  useEffect(() => {
    if (!animated || !cardRef.current || isFocused) return;
    const card = cardRef.current;
    const angleStart = 110;
    const angleEnd = 465;
    card.classList.add('sweep-active');
    card.style.setProperty('--cursor-angle', `${angleStart}deg`);

    animateValue({ duration: 500, onUpdate: v => card.style.setProperty('--edge-proximity', v) });
    animateValue({ ease: easeInCubic, duration: 1500, end: 50, onUpdate: v => {
      card.style.setProperty('--cursor-angle', `${(angleEnd - angleStart) * (v / 100) + angleStart}deg`);
    }});
    animateValue({ ease: easeOutCubic, delay: 1500, duration: 2250, start: 50, end: 100, onUpdate: v => {
      card.style.setProperty('--cursor-angle', `${(angleEnd - angleStart) * (v / 100) + angleStart}deg`);
    }});
    animateValue({ ease: easeInCubic, delay: 2500, duration: 1500, start: 100, end: 0,
      onUpdate: v => card.style.setProperty('--edge-proximity', v),
      onEnd: () => {
        if (!isFocused) card.classList.remove('sweep-active');
      },
    });
  }, [animated, isFocused]);

  const glowVars = buildGlowVars(glowColor, glowIntensity);
  const lightSurface = isLightColor(backgroundColor);

  return (
    <div
      ref={cardRef}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onClick={onClick}
      className={`border-glow-card${lightSurface ? ' border-glow-card--light' : ''} ${className}`}
      style={{
        '--card-bg': backgroundColor,
        '--edge-sensitivity': edgeSensitivity,
        '--border-radius': typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
        '--glow-padding': `${glowRadius}px`,
        '--cone-spread': coneSpread,
        '--fill-opacity': fillOpacity,
        ...glowVars,
        ...buildGradientVars(colors),
        ...style,
      }}
      {...restProps}
    >
      <span className="edge-light" />
      <div className="border-glow-inner">
        {children}
      </div>
    </div>
  );
};

export default BorderGlow;
