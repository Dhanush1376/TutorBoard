import React, { useState, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Maximize, Edit3, Repeat, Orbit } from 'lucide-react';

const FEATURES = [
  {
    icon: Maximize,
    title: "Infinite Knowledge Canvas",
    tag: "Spatial Learning",
    description: "Break out of the scrolling chat paradigm. Explore concepts spatially on an infinite whiteboard where ideas have room to breathe and connect.",
    accent: '#6366f1',
    demo: (
      <div style={{ position: 'relative', width: '100%', height: 200, overflow: 'hidden', borderRadius: 16, background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
        {[...Array(9)].map((_, i) => (
          <motion.div
            key={i}
            animate={{
              x: [Math.sin(i) * 20, Math.cos(i) * 20, Math.sin(i) * 20],
              y: [Math.cos(i) * 15, Math.sin(i) * 15, Math.cos(i) * 15],
              opacity: [0.4, 0.9, 0.4],
            }}
            transition={{ duration: 3 + i * 0.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              width: 6 + (i % 3) * 4,
              height: 6 + (i % 3) * 4,
              borderRadius: 4,
              background: `rgba(99,102,241,${0.3 + (i % 3) * 0.2})`,
              left: `${10 + (i % 3) * 30}%`,
              top: `${15 + Math.floor(i / 3) * 28}%`,
            }}
          />
        ))}
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', bottom: 20, right: 20, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 8, background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}
        >
          <div style={{ width: 8, height: 8, borderRadius: 2, background: '#6366f1' }} />
          <span style={{ fontSize: 11, color: '#6366f1', fontWeight: 600 }}>Infinite canvas</span>
        </motion.div>
      </div>
    ),
  },
  {
    icon: Edit3,
    title: "Rich Drawing Tools",
    tag: "Annotation",
    description: "Annotate AI diagrams with a full suite of drawing tools: pens, shapes, text blocks, and sticky notes. Make learning yours.",
    accent: '#f59e0b',
    demo: (
      <div style={{ position: 'relative', width: '100%', height: 200, overflow: 'hidden', borderRadius: 16, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
        {[
          { type: 'circle', x: 40, y: 60, size: 48, color: 'rgba(245,158,11,0.2)', stroke: 'rgba(245,158,11,0.5)', delay: 0 },
          { type: 'rect', x: 120, y: 80, w: 60, h: 36, color: 'rgba(245,158,11,0.1)', stroke: 'rgba(245,158,11,0.4)', delay: 0.3 },
          { type: 'line', x1: 80, y1: 90, x2: 130, y2: 90, delay: 0.6 },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: s.delay, duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
            style={{
              position: 'absolute',
              left: s.x,
              top: s.y,
              width: s.type === 'circle' ? s.size : s.w,
              height: s.type === 'circle' ? s.size : s.h,
              borderRadius: s.type === 'circle' ? '50%' : 8,
              background: s.color,
              border: `2px solid ${s.stroke}`,
            }}
          />
        ))}
        <motion.div
          animate={{ scaleX: [0, 1, 1, 1], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }}
          style={{ position: 'absolute', bottom: 40, left: 40, transformOrigin: 'left', height: 3, width: 80, background: '#f59e0b', borderRadius: 2 }}
        />
        <motion.div
          animate={{ opacity: [0, 1, 1, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1, delay: 1 }}
          style={{ position: 'absolute', top: 24, right: 24, padding: '6px 12px', borderRadius: 8, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', fontSize: 11, fontWeight: 600, color: '#f59e0b' }}
        >
          ✏ Drawing...
        </motion.div>
      </div>
    ),
  },
  {
    icon: Repeat,
    title: "Historical Scrubbing",
    tag: "Time Travel",
    description: "Every step of your learning journey is saved. Click on an old chat message to instantly restore the canvas to that exact moment in time.",
    accent: '#10b981',
    demo: (
      <div style={{ position: 'relative', width: '100%', height: 200, overflow: 'hidden', borderRadius: 16, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.15)', padding: 16 }}>
        {[
          { label: 'Step 1: Basics', time: '2 min ago' },
          { label: 'Step 2: Deep dive', time: '5 min ago' },
          { label: 'Step 3: Apply', time: '8 min ago' },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: i * 0.15 }}
            whileHover={{ x: 4, background: 'rgba(16,185,129,0.12)' }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, marginBottom: 8, cursor: 'pointer', transition: 'all 0.2s', border: i === 1 ? '1px solid rgba(16,185,129,0.4)' : '1px solid transparent', background: i === 1 ? 'rgba(16,185,129,0.08)' : 'transparent' }}
          >
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: i === 1 ? '#10b981' : 'rgba(16,185,129,0.3)', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: i === 1 ? 600 : 400, color: 'var(--text-primary)', flex: 1 }}>{s.label}</span>
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.time}</span>
          </motion.div>
        ))}
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ position: 'absolute', bottom: 12, right: 12, fontSize: 11, color: '#10b981', fontWeight: 600 }}
        >
          ↺ Click to restore
        </motion.div>
      </div>
    ),
  },
  {
    icon: Orbit,
    title: "Multi-Model Intelligence",
    tag: "AI Routing",
    description: "TutorBoard routes specific subjects to specialized AI models, ensuring accurate visualizations for math, science, coding, and more.",
    accent: '#ec4899',
    demo: (
      <div style={{ position: 'relative', width: '100%', height: 200, overflow: 'hidden', borderRadius: 16, background: 'rgba(236,72,153,0.05)', border: '1px solid rgba(236,72,153,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div style={{ position: 'relative', width: 120, height: 120 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1.5px dashed rgba(236,72,153,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(236,72,153,0.15)', border: '2px solid rgba(236,72,153,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🧠</div>
          </div>
          {[
            { label: '∑', angle: 0, color: '#6366f1' },
            { label: '⚗', angle: 90, color: '#10b981' },
            { label: '</>', angle: 180, color: '#f59e0b' },
            { label: '∇', angle: 270, color: '#ec4899' },
          ].map(({ label, angle, color }, i) => (
            <motion.div
              key={i}
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              style={{ position: 'absolute', inset: 0 }}
            >
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                style={{
                  position: 'absolute',
                  width: 28, height: 28,
                  borderRadius: '50%',
                  background: `${color}22`,
                  border: `1.5px solid ${color}66`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12,
                  top: `${50 - 50 * Math.cos(angle * Math.PI / 180)}%`,
                  left: `${50 + 50 * Math.sin(angle * Math.PI / 180)}%`,
                  transform: 'translate(-50%,-50%)',
                }}
              >
                {label}
              </motion.div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    ),
  },
];

function FeatureCard({ feature, index }) {
  const [hovered, setHovered] = useState(false);
  const Icon = feature.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.7, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        padding: 28,
        borderRadius: 24,
        border: `1.5px solid ${hovered ? feature.accent + '44' : 'var(--border-color)'}`,
        background: hovered ? `${feature.accent}05` : 'var(--bg-secondary)',
        transition: 'border-color 0.3s, background 0.3s',
        cursor: 'default',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {feature.demo}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <motion.div
          animate={hovered ? { rotate: [0, -10, 10, 0], scale: 1.1 } : { rotate: 0, scale: 1 }}
          transition={{ duration: 0.4 }}
          style={{
            width: 44, height: 44, borderRadius: 12,
            background: `${feature.accent}15`,
            border: `1.5px solid ${feature.accent}30`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            color: feature.accent,
          }}
        >
          <Icon size={20} />
        </motion.div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: feature.accent, marginBottom: 4 }}>{feature.tag}</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>{feature.title}</h3>
        </div>
      </div>
      <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>{feature.description}</p>
    </motion.div>
  );
}

const Features = () => {
  return (
    <div style={{ padding: '60px 0 100px', display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 1.6fr', gap: 64, alignItems: 'start' }}>
      {/* Left Column: Headline & Intro */}
      <div style={{ position: 'sticky', top: 120 }}>
        <motion.div
           initial={{ opacity: 0, x: -30 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ duration: 0.7 }}
           style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 20, padding: '6px 16px', borderRadius: 99, border: '1px solid var(--border-color)' }}
        >
          Built for Deep Work
        </motion.div>
        
        <h1 style={{ fontSize: 'clamp(38px, 6vw, 66px)', lineHeight: 1.05, fontFamily: 'var(--font-serif, serif)', letterSpacing: '-2px', color: 'var(--text-primary)', margin: '0 0 24px' }}>
          Supercharge your<br />
          <span style={{ fontStyle: 'italic', opacity: 0.55 }}>study sessions</span>
        </h1>
        
        <p style={{ fontSize: 17, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0, maxWidth: 450 }}>
          We built TutorBoard from the ground up to eliminate the mental burden of visualization. Let our AI illustrate complex topics in real-time, while you focus on truly mastering the concepts.
        </p>

        <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-primary)' }} />
            Zero Latency Visual Generation
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-primary)' }} />
            Cross-Model Intent Recognition
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-primary)' }} />
            Full Historical Session Recall
          </div>
        </div>
      </div>

      {/* Right Column: Feature Deck */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {FEATURES.map((f, i) => (
          <FeatureCard key={i} feature={f} index={i} />
        ))}
      </div>
    </div>
  );
};

export default Features;