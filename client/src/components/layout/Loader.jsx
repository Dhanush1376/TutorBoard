import React, { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';

/* ─── State config (Default Sync Loader) ─────────────────────────────────── */
const CONFIG = {
  sync: {
    label:       'System Loading',
    title:       'Preparing Workspace',
    defaultMsg:  'Initializing the TutorBoard engine and syncing assets.',
    pill:        'Initializing',
    drawSigil:   drawSync,
  }
};


/* ─── Sigil draw functions ───────────────────────────────────────────────── */
function drawSync(ctx, t, accent) {
  const cx = 40, cy = 40, R = 30;
  ctx.clearRect(0, 0, 80, 80);

  ctx.strokeStyle = `${accent}1F`;
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

  ctx.strokeStyle = `${accent}26`;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.arc(cx, cy, 16, 0, Math.PI * 2);
  ctx.stroke();
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
      const bgBase = isDark ? '#0b0b0a' : '#fdfaf3';
      const accentColor = accent;
      
      ctx.fillStyle = bgBase;
      ctx.fillRect(0, 0, w, h);

      const cx = w * 0.5 + Math.sin(t * 0.7) * w * 0.12;
      const cy = h * 0.5 + Math.cos(t * 0.5) * h * 0.1;
      const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w,h) * 0.55);
      g1.addColorStop(0,   accentColor + (isDark ? '28' : '1A'));
      g1.addColorStop(0.5, accentColor + (isDark ? '14' : '0D'));
      g1.addColorStop(1,   'transparent');
      ctx.fillStyle = g1;
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
const Loader = ({ fullScreen = true, glass = false }) => {
  const { mode } = useTheme();
  const isDark = mode === 'dark';
  const accentColor = isDark ? '#fdfaf3' : '#1c1711';
  const cfg = useMemo(() => ({
    ...CONFIG.sync,
    accent: accentColor,
    pillColor: accentColor
  }), [accentColor]);


  const content = (
    <div 
      className={`flex flex-col items-center justify-center 
        ${fullScreen ? "h-screen w-full" : "w-full py-8"} 
        ${glass ? "fixed inset-0 z-[1000] backdrop-blur-3xl bg-[rgba(var(--bg-primary-rgb, 255,255,255), 0.7)]" : "bg-[var(--bg-primary)]"}
      `}
      style={{
        backgroundColor: isDark ? '#0b0b0a' : '#fdfaf3',
        position: fullScreen ? 'fixed' : 'relative',
        inset: 0,
        zIndex: 1000
      }}
    >

       <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700&family=DM+Mono&display=swap');
        @keyframes tb-pill-blink { 0%,100%{opacity:1} 50%{opacity:0.15} }
      `}</style>

      <div style={{
        position: 'relative',
        width: '100vw', height: '100vh',
        overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>

        <BgCanvas accent={cfg.accent} isDark={isDark} />

        <div style={{
          position: 'relative', zIndex: 2,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 32,
          textAlign: 'center', padding: '3rem 2.5rem',
        }}>
          {/* Sigil */}
          <div style={{ position: 'relative', width: 80, height: 80 }}>
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
              fontWeight: 600,
            }}>
              {cfg.label}
            </span>
            <h2 style={{
              fontFamily: '"Syne", sans-serif',
              fontSize: 24, fontWeight: 700, lineHeight: 1.1,
              letterSpacing: '-0.03em', color: isDark ? '#fff' : '#0f0f0e', margin: 0,
            }}>
              {cfg.title}
            </h2>
            <p style={{
              fontFamily: 'inherit',
              fontSize: 14, fontWeight: 400, lineHeight: 1.6,
              color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.5)', 
              margin: 0, maxWidth: '280px',
            }}>
              {cfg.defaultMsg}
            </p>
          </div>

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
              fontWeight: 500,
            }}>
              {cfg.pill}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  return fullScreen ? content : content;
};

export default Loader;
