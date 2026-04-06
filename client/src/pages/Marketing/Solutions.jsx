import React from 'react';
import { motion } from 'framer-motion';
import { BookOpen, GraduationCap, Presentation } from 'lucide-react';

const solutions = [
  {
    icon: <BookOpen className="w-6 h-6" />,
    title: "For Self-Learners",
    target: "Master complex subjects solo.",
    description: "Whether you're breaking into tech, studying for medical exams, or exploring astrophysics on the weekend, TutorBoard transforms abstract concepts into interactive visuals you can fundamentally grasp."
  },
  {
    icon: <GraduationCap className="w-6 h-6" />,
    title: "For Students",
    target: "Ace your classes.",
    description: "Stuck on a homework problem? Ask TutorBoard to draw it out. Work through step-by-step visualizations of calculus curves, chemical bonds, or historical timelines."
  },
  {
    icon: <Presentation className="w-6 h-6" />,
    title: "For Educators",
    target: "Build interactive lessons.",
    description: "Generate explainer visuals on the fly and share the canvas sessions with your classroom. Let students click through the diagrams at their own pace."
  }
];

const Solutions = () => {
  return (
    <div style={{ padding: '60px 0 100px', display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 1.5fr', gap: 64, alignItems: 'start' }}>
      <div style={{ position: 'sticky', top: 120 }}>
        <motion.div
           initial={{ opacity: 0, x: -30 }}
           whileInView={{ opacity: 1, x: 0 }}
           viewport={{ once: true }}
           style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 20, padding: '6px 16px', borderRadius: 99, border: '1px solid var(--border-color)' }}
        >
          Use Cases
        </motion.div>
        <h1 style={{ fontSize: 'clamp(38px, 6vw, 66px)', lineHeight: 1.05, fontFamily: 'var(--font-serif, serif)', letterSpacing: '-2px', color: 'var(--text-primary)', margin: '0 0 24px' }}>
          Built for every<br />
          <span style={{ fontStyle: 'italic', opacity: 0.55 }}>type of learner</span>
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0, maxWidth: 400 }}>
          No matter what your goal is, visual learning accelerates comprehension. See how TutorBoard fits into your unique workflow.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {solutions.map((sol, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: idx * 0.1 }}
            style={{
              padding: 32,
              borderRadius: 24,
              border: '1.5px solid var(--border-color)',
              background: 'var(--bg-secondary)',
              position: 'relative',
              overflow: 'hidden',
              cursor: 'default',
            }}
            whileHover={{ scale: 1.02, x: 8 }}
          >
            <div style={{ position: 'absolute', top: 0, right: 0, width: 120, height: 120, background: 'var(--text-primary)', opacity: 0.02, borderRadius: '0 0 0 100%' }} />
            <div style={{ color: 'var(--text-primary)', marginBottom: 24, opacity: 0.7 }}>{sol.icon}</div>
            <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4, letterSpacing: '-0.3px' }}>{sol.title}</h3>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginBottom: 16 }}>{sol.target}</div>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>
              {sol.description}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Solutions;
