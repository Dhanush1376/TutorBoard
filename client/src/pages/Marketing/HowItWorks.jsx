import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { MessageSquare, Sparkles, Hand, Layers, ArrowRight, Check } from 'lucide-react';

const STEPS = [
  {
    icon: MessageSquare,
    number: '01',
    title: 'Ask a question',
    description: 'Start a conversation with the AI tutor. Ask anything from "How does a binary search tree work?" to "Explain cell division." The AI understands natural language intent.',
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.06)',
    demoLines: [
      { role: 'user', text: 'How does a binary search tree work?' },
      { role: 'ai', text: 'Let me draw that for you on the canvas...' },
    ],
  },
  {
    icon: Sparkles,
    number: '02',
    title: 'AI Generates Visuals',
    description: "Instead of a wall of text, TutorBoard's engine instantly spins up an interactive, code-driven visualization right onto the canvas.",
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.06)',
    demoLines: null,
  },
  {
    icon: Hand,
    number: '03',
    title: 'Interact and Learn',
    description: 'Drag around the infinite canvas, zoom in on details, add your own notes, or draw over the diagrams. True learning happens by interacting.',
    color: '#10b981',
    bg: 'rgba(16,185,129,0.06)',
    demoLines: null,
  },
  {
    icon: Layers,
    number: '04',
    title: 'Drill Down',
    description: 'Follow up with more questions in the sidebar. The UI preserves previous steps so you can always scroll back and revive a past visual state.',
    color: '#ec4899',
    bg: 'rgba(236,72,153,0.06)',
    demoLines: null,
  },
];

function BSTDemo() {
  const nodes = [
    { val: 8, x: 140, y: 20 },
    { val: 3, x: 60, y: 80 },
    { val: 12, x: 220, y: 80 },
    { val: 1, x: 20, y: 140 },
    { val: 6, x: 100, y: 140 },
    { val: 10, x: 180, y: 140 },
    { val: 14, x: 260, y: 140 },
  ];
  const edges = [[8,3],[8,12],[3,1],[3,6],[12,10],[12,14]];
  const nodeMap = Object.fromEntries(nodes.map(n => [n.val, n]));
  const [highlighted, setHighlighted] = useState(null);

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width="290" height="170" style={{ overflow: 'visible' }}>
        {edges.map(([a,b], i) => {
          const na = nodeMap[a], nb = nodeMap[b];
          return (
            <motion.line
              key={i}
              x1={na.x + 16} y1={na.y + 16} x2={nb.x + 16} y2={nb.y + 16}
              stroke="rgba(99,102,241,0.2)" strokeWidth={1.5}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: 0.5 + i * 0.1, duration: 0.4 }}
            />
          );
        })}
        {nodes.map((n, i) => (
          <motion.g
            key={n.val}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.08, duration: 0.4, type: 'spring', stiffness: 300 }}
            style={{ transformOrigin: `${n.x + 16}px ${n.y + 16}px` }}
            onMouseEnter={() => setHighlighted(n.val)}
            onMouseLeave={() => setHighlighted(null)}
          >
            <circle
              cx={n.x + 16} cy={n.y + 16} r={16}
              fill={highlighted === n.val ? '#6366f1' : 'rgba(99,102,241,0.12)'}
              stroke={highlighted === n.val ? '#6366f1' : 'rgba(99,102,241,0.35)'}
              strokeWidth={1.5}
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
            />
            <text
              x={n.x + 16} y={n.y + 21}
              textAnchor="middle"
              fontSize={12}
              fontWeight={600}
              fill={highlighted === n.val ? 'white' : '#6366f1'}
              style={{ userSelect: 'none', transition: 'all 0.2s' }}
            >
              {n.val}
            </text>
          </motion.g>
        ))}
      </svg>
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 8 }}>Hover nodes to explore</p>
    </div>
  );
}

function CanvasDemo() {
  const items = [
    { label: 'DNA double helix', x: 20, y: 20, color: '#10b981' },
    { label: 'Cell nucleus', x: 140, y: 50, color: '#6366f1' },
    { label: 'Mitosis stages', x: 60, y: 100, color: '#f59e0b' },
  ];
  return (
    <div style={{ position: 'relative', height: 160, border: '1px dashed rgba(16,185,129,0.3)', borderRadius: 12, overflow: 'hidden', background: 'rgba(16,185,129,0.04)' }}>
      <div style={{ position: 'absolute', top: 8, left: 8, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(16,185,129,0.5)', textTransform: 'uppercase' }}>Canvas</div>
      {items.map((item, i) => (
        <motion.div
          key={i}
          drag
          dragConstraints={{ left: 0, right: 180, top: 0, bottom: 100 }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.2 }}
          whileDrag={{ scale: 1.08, zIndex: 10 }}
          style={{
            position: 'absolute',
            left: item.x, top: item.y,
            padding: '5px 10px',
            borderRadius: 8,
            background: `${item.color}18`,
            border: `1px solid ${item.color}44`,
            fontSize: 12,
            fontWeight: 500,
            color: item.color,
            cursor: 'grab',
            userSelect: 'none',
          }}
        >
          {item.label}
        </motion.div>
      ))}
      <motion.div
        animate={{ opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 3, repeat: Infinity }}
        style={{ position: 'absolute', bottom: 10, right: 10, fontSize: 10, color: '#10b981' }}
      >
        ✦ drag to explore
      </motion.div>
    </div>
  );
}

function HistoryDemo() {
  const [active, setActive] = useState(1);
  const history = [
    { label: 'Introduction', icon: '📖', step: 0 },
    { label: 'Core concepts', icon: '🔍', step: 1 },
    { label: 'Applications', icon: '⚡', step: 2 },
    { label: 'Quiz', icon: '✅', step: 3 },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {history.map((h, i) => (
        <motion.div
          key={i}
          onClick={() => setActive(i)}
          whileHover={{ x: 4 }}
          whileTap={{ scale: 0.97 }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 10, cursor: 'pointer',
            background: active === i ? 'rgba(236,72,153,0.1)' : 'transparent',
            border: active === i ? '1px solid rgba(236,72,153,0.3)' : '1px solid transparent',
            transition: 'all 0.2s',
          }}
        >
          <span style={{ fontSize: 14 }}>{h.icon}</span>
          <span style={{ fontSize: 13, fontWeight: active === i ? 600 : 400, color: active === i ? '#ec4899' : 'var(--text-secondary)', flex: 1 }}>{h.label}</span>
          {active === i && <Check size={13} color="#ec4899" />}
        </motion.div>
      ))}
    </div>
  );
}

const STEP_DEMOS = [
  <div style={{ background: 'var(--bg-primary)', borderRadius: 12, border: '1px solid var(--border-color)', padding: 16, fontFamily: 'monospace', fontSize: 13 }}>
    {[
      { role: 'user', text: 'How does a binary search tree work?' },
      { role: 'ai', text: 'Let me draw that for you on the canvas...' },
    ].map((m, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, x: m.role === 'user' ? 20 : -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: i * 0.4 }}
        style={{
          padding: '8px 12px', marginBottom: 8, borderRadius: 10,
          background: m.role === 'user' ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)',
          color: m.role === 'user' ? '#6366f1' : 'var(--text-primary)',
          fontSize: 13, lineHeight: 1.5,
          alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
          maxWidth: '85%',
          marginLeft: m.role === 'user' ? 'auto' : 0,
        }}
      >
        {m.text}
      </motion.div>
    ))}
  </div>,
  <BSTDemo />,
  <CanvasDemo />,
  <HistoryDemo />,
];

function StepCard({ step, index, isActive, onClick }) {
  const Icon = step.icon;
  return (
    <motion.div
      onClick={onClick}
      initial={{ opacity: 0, x: -30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.6 }}
      whileHover={{ x: isActive ? 0 : 4 }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 16,
        padding: 20,
        borderRadius: 16,
        cursor: 'pointer',
        border: isActive ? `1.5px solid ${step.color}44` : '1.5px solid transparent',
        background: isActive ? step.bg : 'transparent',
        transition: 'all 0.3s',
      }}
    >
      <div style={{
        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
        background: isActive ? `${step.color}20` : 'var(--bg-secondary)',
        border: `1.5px solid ${isActive ? step.color + '40' : 'var(--border-color)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.3s',
        color: isActive ? step.color : 'var(--text-tertiary)',
      }}>
        <Icon size={20} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: isActive ? step.color : 'var(--text-tertiary)', marginBottom: 4 }}>
          {step.number}
        </div>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px', letterSpacing: '-0.3px' }}>{step.title}</h3>
        <AnimatePresence>
          {isActive && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ fontSize: 14, lineHeight: 1.65, color: 'var(--text-secondary)', margin: 0 }}
            >
              {step.description}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

const HowItWorks = () => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActive(a => (a + 1) % STEPS.length), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ padding: '60px 0 100px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 80, alignItems: 'start' }}>
      {/* Left Side: Text & Steps */}
      <div>
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 20, padding: '6px 16px', borderRadius: 99, border: '1px solid var(--border-color)' }}
        >
          The Experience
        </motion.div>
        
        <h1 style={{ fontSize: 'clamp(38px, 6vw, 60px)', lineHeight: 1.05, fontFamily: 'var(--font-serif, serif)', letterSpacing: '-2px', color: 'var(--text-primary)', margin: '0 0 24px' }}>
          How{' '}
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 3, repeat: Infinity }}
            style={{ fontStyle: 'italic' }}
          >
            TutorBoard
          </motion.span>
          {' '}Works
        </h1>
        
        <p style={{ fontSize: 17, lineHeight: 1.7, color: 'var(--text-secondary)', margin: '0 0 48px', maxWidth: 500 }}>
          Text-based chatbots are fundamentally broken for complex learning. We built an AI engine that doesn't just talk—it draws, animates, and builds interactive sandboxes.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {STEPS.map((step, i) => (
            <StepCard key={i} step={step} index={i} isActive={active === i} onClick={() => setActive(i)} />
          ))}
        </div>
      </div>

      {/* Right Side: Interactive Cards / Previews */}
      <div style={{ position: 'sticky', top: 120 }}>
        <motion.div
          style={{
            borderRadius: 32,
            border: '1.5px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            padding: 32,
            minHeight: 340,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-xl)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: STEPS[active].color, opacity: 0.2 }} />
          
          <div style={{ display: 'flex', alignItems: 'center', justifyBetween: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: STEPS[active].color }}>
              Step {STEPS[active].number} · Live Preview
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <div style={{ width: '100%' }}>
                {STEP_DEMOS[active]}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Progress dots inside card */}
          <div style={{ display: 'flex', gap: 8, marginTop: 32, justifyContent: 'center' }}>
            {STEPS.map((s, i) => (
              <motion.button
                key={i}
                onClick={() => setActive(i)}
                animate={{ 
                  width: active === i ? 24 : 8, 
                  background: active === i ? s.color : 'var(--border-color)',
                  opacity: active === i ? 1 : 0.4
                }}
                transition={{ duration: 0.4 }}
                style={{ height: 8, borderRadius: 4, border: 'none', cursor: 'pointer', padding: 0 }}
              />
            ))}
          </div>
        </motion.div>

        <motion.p 
          key={`caption-${active}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginTop: 20, textTransform: 'uppercase', letterSpacing: '0.1em' }}
        >
          Interactive Demonstration
        </motion.p>
      </div>
    </div>
  );
};

export default HowItWorks;