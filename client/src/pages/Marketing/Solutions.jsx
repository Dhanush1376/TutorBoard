import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { EASE, Container, SectionIntro, SectionHead, Reveal, MockFrame, LiveDot, VelocityBand, useActive, useSpy } from './kit';
import { TangentMock, ConceptMapMock, ClassroomMock } from './SolutionMocks';

const AUDIENCES = [
  {
    tab: 'Students',
    title: 'Homework, drawn out.',
    body: 'Stuck on a problem set? Ask TutorBoard to draw it. Watch a tangent slide along a curve, a reaction balance, or a proof come together one line at a time.',
    points: ['Step-by-step visual explanations', 'Pause and ask about any step', 'Rewind the hard part before the exam'],
    label: 'calculus · derivatives',
    Mock: TangentMock,
  },
  {
    tab: 'Self-learners',
    title: 'Learn anything, in order.',
    body: 'Breaking into tech or exploring astrophysics on a weekend, follow ideas from first principles. Each concept builds visibly on the last.',
    points: ['Follow-up questions build on the canvas', 'Concepts connect as you go', 'Recent sessions kept to revisit'],
    label: 'your learning path',
    Mock: ConceptMapMock,
  },
  {
    tab: 'Educators',
    title: 'Explain it once, clearly.',
    body: 'Generate explainer visuals live in class, then share the lesson so students can step through it again at their own pace.',
    points: ['Visuals generated mid-lecture', 'Narrated scenes students can replay', 'Runs in the browser, nothing to install'],
    label: 'presenter view',
    Mock: ClassroomMock,
  },
];

const SUBJECTS = [
  ['Biology', 'Physics', 'Chemistry', 'History', 'Economics', 'Calculus', 'Geography', 'Astronomy'],
  ['Anatomy', 'Earth science', 'Statistics', 'Geometry', 'Algorithms', 'Linear algebra', 'Ecology', 'Probability'],
];

const ROTATE_MS = 9000;

function Showcase() {
  const [tab, setTab] = useState(0);
  const [touched, setTouched] = useState(false);
  const [ref, active] = useActive(0.3);
  const reduce = useReducedMotion();
  const auto = active && !touched && !reduce;
  const a = AUDIENCES[tab];

  useEffect(() => {
    if (!auto) return undefined;
    const id = setTimeout(() => setTab((t) => (t + 1) % AUDIENCES.length), ROTATE_MS);
    return () => clearTimeout(id);
  }, [auto, tab]);

  const pick = (i) => {
    setTouched(true);
    setTab(i);
  };

  return (
    <Container>
      <div ref={ref} className="grid gap-12 lg:grid-cols-12 lg:items-center lg:gap-16">
        <div className="lg:col-span-5">
          <Reveal>
            <div role="tablist" aria-label="Who it is for" className="relative inline-flex rounded-full border border-[var(--mk-line)] bg-[var(--mk-surface)] p-1">
              {AUDIENCES.map((x, i) => (
                <button
                  key={x.tab}
                  type="button"
                  role="tab"
                  aria-selected={tab === i}
                  onClick={() => pick(i)}
                  className={`relative h-9 cursor-pointer rounded-full px-3.5 text-[13px] tracking-[-0.01em] transition-colors duration-300 sm:px-4 ${
                    tab === i ? 'text-[var(--bg-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {tab === i && (
                    <motion.span
                      layoutId="sol-tab"
                      className="absolute inset-0 overflow-hidden rounded-full bg-[var(--text-primary)]"
                      transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                    >
                      {auto && (
                        <motion.span
                          key={tab}
                          className="absolute bottom-0 left-0 h-[2px] bg-[rgba(var(--bg-primary-rgb),0.35)]"
                          initial={{ width: '0%' }}
                          animate={{ width: '100%' }}
                          transition={{ duration: ROTATE_MS / 1000, ease: 'linear' }}
                        />
                      )}
                    </motion.span>
                  )}
                  <span className="relative">{x.tab}</span>
                </button>
              ))}
            </div>
          </Reveal>

          <div className="relative mt-10 hidden min-h-[330px] sm:min-h-[300px] lg:block">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -6, filter: 'blur(6px)' }}
                transition={{ duration: 0.45, ease: EASE }}
              >
                <h2 className="text-[clamp(1.9rem,3.4vw,2.6rem)] font-[450] leading-[1.05] tracking-[-0.04em] text-[var(--text-primary)]">{a.title}</h2>
                <p className="mt-5 max-w-[44ch] text-[15.5px] leading-[1.65] text-[var(--text-secondary)]">{a.body}</p>
                <ul className="mt-8 border-t border-[var(--mk-line)]">
                  {a.points.map((p, i) => (
                    <motion.li
                      key={p}
                      className="flex items-center gap-4 border-b border-[var(--mk-line)] py-3.5 text-[14.5px] tracking-[-0.01em] text-[var(--text-primary)]"
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.45, ease: EASE, delay: 0.12 + i * 0.07 }}
                    >
                      <span className="font-mono text-[10.5px] text-[var(--text-tertiary)]">{String(i + 1).padStart(2, '0')}</span>
                      {p}
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        <Reveal delay={0.1} className="lg:col-span-7" amount={0.15}>
          <MockFrame
            label={`tutorboard — ${a.label}`}
            meta={<LiveDot on={active} label={<span className="hidden sm:inline">live</span>} />}
            bodyClassName="aspect-[1/1] sm:aspect-[16/11]"
          >
            <AnimatePresence initial={false}>
              <motion.div
                key={tab}
                className="absolute inset-0"
                initial={{ opacity: 0, filter: 'blur(8px)', scale: 0.985 }}
                animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
                exit={{ opacity: 0, filter: 'blur(8px)', scale: 1.01 }}
                transition={{ duration: 0.55, ease: EASE }}
              >
                <a.Mock active={active} />
              </motion.div>
            </AnimatePresence>
          </MockFrame>
        </Reveal>
      </div>
    </Container>
  );
}

export default function SolutionsSection() {
  const ref = useSpy('solutions');
  return (
    <section id="solutions" ref={ref} className="relative">
      <SectionIntro
        index="03"
        label="Solutions"
        title="One canvas."
        muted="Every kind of learner."
        lede="Studying, revising, or presenting to a room: TutorBoard makes ideas visual for everyone."
      />

      <Showcase />

      <div className="pb-8 pt-24 lg:pt-36">
        <Container>
          <SectionHead index="3.4" label="Across subjects" title="If it can be drawn," muted="it can be taught here." />
        </Container>
        <div className="mt-14 space-y-0 lg:mt-20">
          <VelocityBand items={SUBJECTS[0]} />
          <VelocityBand items={SUBJECTS[1]} speed={-2} className="border-t-0" />
        </div>
      </div>
    </section>
  );
}
