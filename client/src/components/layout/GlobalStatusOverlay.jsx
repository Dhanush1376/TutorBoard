import React, { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useTutorStore from '../../store/tutorStore';
import { useTheme } from '../../context/ThemeContext';

/* ─── State config ───────────────────────────────────────────────────────── */
const CONFIG = {
  sync: {
    label:       'Workspace sync',
    title:       'Getting everything\nready',
    defaultMsg:  'Synchronizing your canvas data with the TutorBoard engine.',
    pill:        'Connecting to engine',
    drawSigil:   drawSync,
  },

  network: {
    label:       'Connection lost',
    title:       'Unable to reach\nTutorBoard',
    defaultMsg:  "Check your internet connection. We'll retry automatically.",
    pill:        'Auto-reconnecting',
    pillColor:   '#E24B4A',
    accent:      '#E24B4A',
    drawSigil:   drawNetwork,
  },
  error: {
    label:       'System error',
    title:       'Something\nwent wrong',
    defaultMsg:  'An unexpected error occurred. Hanging on while we recover.',
    pill:        'Recovery in progress',
    pillColor:   '#BA7517',
    accent:      '#BA7517',
    drawSigil:   drawError,
  },
};

/* ─── Sigil draw functions ───────────────────────────────────────────────── */
function drawSync(ctx, t, accent) {
  const cx = 40, cy = 40, R = 30;
  ctx.clearRect(0, 0, 80, 80);

  ctx.strokeStyle = `${accent}1F`; // ~12%
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  for (let i = 0; i < 3; i++) {
    const dash = 40 - i * 13;
    const circ = Math.PI * 2 * R;
    ctx.setLineDash([dash, circ - dash]);
    ctx.lineDashOffset = -((t * 2 + i * 1.1) % circ);
    ctx.strokeStyle = `${accent}${Math.floor((0.9 - i * 0.28) * 255).toString(16).padStart(2, '0')}`;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const inner = 3 + Math.sin(t * 1.5) * 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, inner, 0, Math.PI * 2);
  ctx.fillStyle = accent;
  ctx.fill();

  ctx.strokeStyle = `${accent}26`; // ~15%
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 16, 0, Math.PI * 2);
  ctx.stroke();
}

function drawNetwork(ctx, t, accent) {
  const cx = 40, cy = 40;
  ctx.clearRect(0, 0, 80, 80);

  const pulse = 0.5 + 0.5 * Math.sin(t * 0.6);
  for (let i = 3; i >= 1; i--) {
    ctx.beginPath();
    ctx.arc(cx, cy, i * 12, 0, Math.PI * 2);
    ctx.strokeStyle = `${accent}${Math.floor(pulse * (1 / i) * 102).toString(16).padStart(2, '0')}`; // pulse * (1/i) * 0.4
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.strokeStyle = `${accent}40`; // 25%
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 30, 0, Math.PI * 2);
  ctx.stroke();

  const len = 7;
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - len, cy - len); ctx.lineTo(cx + len, cy + len);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + len, cy - len); ctx.lineTo(cx - len, cy + len);
  ctx.stroke();
}

function drawError(ctx, t, accent) {
  const cx = 40, cy = 40, R = 28;
  ctx.clearRect(0, 0, 80, 80);

  ctx.strokeStyle = `${accent}33`; // 20%
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();

  const rot = t * 0.4;
  ctx.beginPath();
  for (let i = 0; i <= 3; i++) {
    const a = (i / 3) * Math.PI * 2 + rot - Math.PI / 2;
    const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.strokeStyle = `${accent}B3`; // 70%
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();

  const blink = Math.sin(t * 2) > 0 ? 'FF' : '33';
  ctx.beginPath();
  ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = `${accent}${blink}`;
  ctx.fill();
}

/* ─── Background canvas ──────────────────────────────────────────────────── */
const BgCanvas = ({ accent, isDark }) => {
  const ref  = useRef(null);
  const tick = useRef(0);
  const raf  = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const makeParticles = (w, h) =>
      Array.from({ length: 38 }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.2 + 0.3,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        a: Math.random() * 0.5 + 0.05,
      }));

    let parts = [];

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      parts = makeParticles(canvas.width, canvas.height);
    };
    resize();

    const loop = () => {
      tick.current++;
      const { width: w, height: h } = canvas;
      const t = tick.current * 0.008;

      ctx.clearRect(0, 0, w, h);
      
      // Theme-aware colors
      const bgBase = isDark ? '#0b0b0a' : '#fdfaf3';
      const accentColor = accent; // Use state accent
      
      ctx.fillStyle = bgBase;
      ctx.fillRect(0, 0, w, h);

      const cx = w * 0.5 + Math.sin(t * 0.7) * w * 0.12;
      const cy = h * 0.5 + Math.cos(t * 0.5) * h * 0.1;
      const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w,h) * 0.55);
      g1.addColorStop(0,   accentColor + (isDark ? '28' : '1A')); // ~15% or 10%
      g1.addColorStop(0.5, accentColor + (isDark ? '14' : '0D')); // ~8% or 5%
      g1.addColorStop(1,   'transparent');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);

      const cx2 = w * 0.15 + Math.cos(t * 0.4) * w * 0.08;
      const cy2 = h * 0.85 + Math.sin(t * 0.6) * h * 0.06;
      const g2  = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, Math.max(w,h) * 0.35);
      g2.addColorStop(0, accentColor + (isDark ? '18' : '0F'));
      g2.addColorStop(1, 'transparent');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      for (const p of parts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        
        const baseAlpha = isDark ? p.a : p.a * 0.7;
        const color = isDark ? '#ffffff' : '#000000';
        const alphaHex = Math.floor(baseAlpha * (isDark ? 50 : 30)).toString(16).padStart(2, '0');
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = color + alphaHex;
        ctx.fill();
      }

      raf.current = requestAnimationFrame(loop);
    };

    loop();
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener('resize', resize);
    };
  }, [accent, isDark]);

  return (
    <canvas
      ref={ref}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  );
};

/* ─── Sigil canvas ───────────────────────────────────────────────────────── */
const SigilCanvas = ({ cfg }) => {
  const ref  = useRef(null);
  const tick = useRef(0);
  const raf  = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const loop = () => {
      tick.current++;
      cfg.drawSigil(ctx, tick.current * 0.05, cfg.accent);
      raf.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf.current);
  }, [cfg]);

  return <canvas ref={ref} width={80} height={80} style={{ position: 'absolute', inset: 0 }} />;
};

/* ─── Main component ─────────────────────────────────────────────────────── */
const GlobalStatusOverlay = () => {
  const { globalOverlay } = useTutorStore();
  const { mode } = useTheme();
  const isDark = mode === 'dark';
  const { isActive, message, type = 'sync' } = globalOverlay;
  const accentColor = isDark ? '#fdfaf3' : '#1c1711';

  
  const cfg = useMemo(() => {
    const base = CONFIG[type] ?? CONFIG.sync;
    if (type === 'sync') {
      return { ...base, accent: accentColor, pillColor: accentColor };
    }
    return base;
  }, [type, accentColor]);
  const titleLines = cfg.title.split('\n');


  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          key="status-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: isDark ? '#0b0b0a' : '#fdfaf3',
          }}
        >

          <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700&family=DM+Mono&display=swap');
            @keyframes tb-pill-blink { 0%,100%{opacity:1} 50%{opacity:0.15} }
          `}</style>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0  }}
            exit={{    opacity: 0, y: 8  }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'relative',
              width: '100vw', height: '100vh',
              overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >

            <BgCanvas accent={cfg.accent} isDark={isDark} />

            <div style={{
              position: 'relative', zIndex: 2,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 32,
              textAlign: 'center', padding: '3rem 2.5rem',
            }}>
              {/* Sigil */}
              <div style={{ position: 'relative', width: 80, height: 80 }}>
                {/* Glow behind sigil */}
                <div style={{ 
                  position: 'absolute', inset: -20, 
                  background: cfg.accent, borderRadius: '50%',
                  opacity: 0.08, filter: 'blur(30px)' 
                }} />
                <SigilCanvas cfg={cfg} />
              </div>

              {/* Text */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{
                  fontFamily: '"DM Mono", monospace',
                  fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
                  color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                  fontWeight: 400,
                }}>
                  {cfg.label}
                </span>
                <h2 style={{
                  fontFamily: '"Syne", sans-serif',
                  fontSize: 24, fontWeight: 400, lineHeight: 1.1,
                  letterSpacing: '-0.03em', color: isDark ? '#fff' : '#0f0f0e', margin: 0,
                }}>
                  {titleLines.map((ln, i) => (
                    <React.Fragment key={i}>
                      {ln}
                      {i < titleLines.length - 1 && <br />}
                    </React.Fragment>
                  ))}
                </h2>
                <p style={{
                  fontFamily: 'inherit',
                  fontSize: 14, fontWeight: 400, lineHeight: 1.6,
                  color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.5)', 
                  margin: 0, maxWidth: '280px',
                }}>
                  {message || cfg.defaultMsg}
                </p>
              </div>

              {/* Pill */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '6px 16px 6px 12px', borderRadius: 100,
                border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)',
                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: cfg.pillColor,
                  animation: 'tb-pill-blink 1.8s ease-in-out infinite',
                }} />
                <span style={{
                  fontFamily: '"DM Mono", monospace',
                  fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.4)',
                  fontWeight: 400,
                }}>
                  {cfg.pill}
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalStatusOverlay;
