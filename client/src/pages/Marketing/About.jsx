import React, { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue, useTransform, useSpring, useInView, animate } from 'framer-motion';
import { Sparkles, ArrowRight } from 'lucide-react';

const WORDS = ["Visual", "Spatial", "Interactive", "Tactile", "Kinetic"];

function AnimatedCounter({ from, to, duration = 2 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const [val, setVal] = useState(from);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(from, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setVal(Math.round(v)),
    });
    return controls.stop;
  }, [inView]);

  return <span ref={ref}>{val.toLocaleString()}</span>;
}

function MagneticWord({ children, delay = 0 }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 200, damping: 20 });
  const sy = useSpring(y, { stiffness: 200, damping: 20 });
  const ref = useRef(null);

  const handleMove = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const pull = Math.max(0, 1 - dist / 120);
    x.set(dx * pull * 0.3);
    y.set(dy * pull * 0.3);
  };

  return (
    <motion.span
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      style={{ x: sx, y: sy, display: 'inline-block' }}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.span>
  );
}

function CyclingWord() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex(i => (i + 1) % WORDS.length), 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <span style={{ display: 'inline-block', position: 'relative', color: 'var(--text-primary)', minWidth: 220 }}>
      <motion.span
        key={index}
        initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        style={{ display: 'inline-block', fontStyle: 'italic' }}
      >
        {WORDS[index]}
      </motion.span>
    </span>
  );
}

function FloatingOrb({ style, delay = 0 }) {
  return (
    <motion.div
      style={{
        position: 'absolute',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(var(--text-primary-rgb,0,0,0), 0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
        ...style,
      }}
      animate={{ y: [0, -30, 0], scale: [1, 1.08, 1] }}
      transition={{ duration: 6 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
    />
  );
}

function StatPill({ label, value, from = 0, suffix = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      whileHover={{ scale: 1.04 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '28px 36px',
        borderRadius: 24,
        border: '1.5px solid var(--border-color)',
        background: 'var(--bg-secondary)',
        backdropFilter: 'blur(20px)',
        cursor: 'default',
      }}
    >
      <span style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-2px', fontFamily: 'var(--font-serif, serif)', color: 'var(--text-primary)', lineHeight: 1 }}>
        <AnimatedCounter from={from} to={value} />{suffix}
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)' }}>{label}</span>
    </motion.div>
  );
}

const About = () => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useTransform(mouseY, [-300, 300], [8, -8]);
  const rotateY = useTransform(mouseX, [-300, 300], [-8, 8]);
  const heroRef = useRef(null);

  const handleMouseMove = (e) => {
    const rect = heroRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set(e.clientX - rect.left - rect.width / 2);
    mouseY.set(e.clientY - rect.top - rect.height / 2);
  };

  return (
    <div style={{ overflow: 'hidden' }}>
      {/* Hero */}
      <div
        ref={heroRef}
        onMouseMove={handleMouseMove}
        style={{ position: 'relative', minHeight: '85vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '80px 24px' }}
      >
        <FloatingOrb style={{ width: 600, height: 600, top: '-20%', left: '-15%', opacity: 0.6 }} delay={0} />
        <FloatingOrb style={{ width: 400, height: 400, bottom: '0%', right: '-10%', opacity: 0.4 }} delay={2} />

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 20px',
            borderRadius: 99,
            border: '1px solid var(--border-color)',
            background: 'var(--bg-secondary)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
            marginBottom: 40,
          }}
        >
         
          Founded 2026
        </motion.div>

        {/* Headline */}
        <h1 style={{
          fontSize: 'clamp(52px, 8vw, 96px)',
          lineHeight: 1.0,
          fontFamily: 'var(--font-serif, serif)',
          letterSpacing: '-3px',
          color: 'var(--text-primary)',
          marginBottom: 16,
          maxWidth: 900,
        }}>
          <MagneticWord delay={0.1}>The&nbsp;</MagneticWord>
          <MagneticWord delay={0.2}>Future&nbsp;</MagneticWord>
          <MagneticWord delay={0.3}>of&nbsp;</MagneticWord>
          <br />
          <MagneticWord delay={0.4}>Learning&nbsp;</MagneticWord>
          <span style={{ display: 'inline-block' }}>
            <span style={{ opacity: 0.4 }}>is&nbsp;</span>
            <CyclingWord />
          </span>
        </h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          style={{ fontSize: 18, lineHeight: 1.7, color: 'var(--text-secondary)', maxWidth: 560, marginTop: 24, marginBottom: 48 }}
        >
          An LLM that only generates text is like a brilliant tutor who refuses to use a whiteboard.
          We built TutorBoard to change that.
        </motion.p>

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.9 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '16px 36px',
            borderRadius: 99,
            background: 'var(--text-primary)',
            color: 'var(--bg-primary)',
            border: 'none',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '-0.01em',
          }}
        >
          Start Learning Visually <ArrowRight size={16} />
        </motion.button>

        {/* Scroll hint */}
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{ position: 'absolute', bottom: 32, left: '50%', translateX: '-50%', opacity: 0.3 }}
        >
          <div style={{ width: 1, height: 48, background: 'var(--text-primary)', margin: '0 auto' }} />
        </motion.div>
      </div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', padding: '40px 24px 80px' }}
      >
        <StatPill label="Learners" value={12000} from={0} suffix="+" />
        <StatPill label="Concepts Visualized" value={340000} from={0} suffix="+" />
        <StatPill label="Accuracy Rate" value={99} from={0} suffix="%" />
      </motion.div>

      {/* Mission Section */}
      <div style={{ padding: '60px 24px 100px', maxWidth: 900, margin: '0 auto' }}>
        {['We absorb complex concepts best when we can see them, interact with them, and break them down spatially.',
          'That\'s why we built TutorBoard—an intelligent canvas designed specifically to illustrate, rather than just explain.',
          'Our mission is to bridge the gap between abstract text and intuitive understanding, providing learners with a sandbox where concepts come alive.'
        ].map((text, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.7, delay: i * 0.1 }}
            style={{
              fontSize: 'clamp(18px, 2.5vw, 26px)',
              lineHeight: 1.6,
              color: i === 1 ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: i === 1 ? 600 : 400,
              marginBottom: 32,
              paddingLeft: i === 1 ? 24 : 0,
              borderLeft: i === 1 ? '3px solid var(--text-primary)' : 'none',
            }}
          >
            {text}
          </motion.p>
        ))}
      </div>
    </div>
  );
};

export default About;