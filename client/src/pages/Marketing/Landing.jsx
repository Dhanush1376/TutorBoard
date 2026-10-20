import React, { Suspense, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { ErrorBoundary } from 'react-error-boundary';
import {
  EASE,
  HEADLINE,
  Container,
  SplitText,
  PrimaryButton,
  ClosingCTA,
  VelocityBand,
  HERO_TEXT_OUT,
  heroProgressFor,
  mapRange,
  morphAt,
  useMediaQuery,
  useScrollContainer,
  useSections,
  useSpy,
  useStartLearning,
} from './kit';
import HowItWorksSection from './HowItWorks';
import FeaturesSection from './Features';
import SolutionsSection from './Solutions';
import AboutSection from './About';

// three.js only loads once the hero is on screen; the headline never waits for it.
const ParticleMorph = React.lazy(() => import('./ParticleMorph'));

// Order matches the shapes in ParticleMorph.jsx.
const HERO_SUBJECTS = [
  { name: 'Biology', line: 'The double helix, twisting base pair by base pair.' },
  { name: 'Chemistry', line: 'Electrons streaming round their nucleus.' },
  { name: 'Physics', line: 'Field lines flowing from pole to pole.' },
  { name: 'Astronomy', line: 'A planet tracing its orbit round a star.' },
  { name: 'Geography', line: 'A turning globe, tilted 23.4° on its axis.' },
  { name: 'History', line: 'The Great Pyramid, course by course to the capstone.' },
  { name: 'Economics', line: 'Growth, bar by bar, with the trend riding on top.' },
  { name: 'Engineering', line: 'Three meshing gears, interlocking with synchronous teeth.' },
  { name: 'Mathematics', line: 'The surface z = sin x · cos y, rippling.' },
];
const TOTAL = String(HERO_SUBJECTS.length).padStart(2, '0');

const LEDE = 'Stop reading walls of text. Experience the generative visual canvas that brings every idea to life before your eyes.';


function Hero() {
  const ref = useRef(null);
  useSpy(null, ref);
  const container = useScrollContainer();
  const { scrollYProgress } = useScroll({ container: container || undefined, target: ref, offset: ['start start', 'end end'] });
  const inView = useInView(ref, { amount: 0 });
  const reduce = useReducedMotion();
  const compact = useMediaQuery('(max-width: 1023px)');
  const { scrollToSection } = useSections();
  const start = useStartLearning();
  const [idx, setIdx] = useState(0);
  const buttons = (
    <div className="flex items-center gap-3 whitespace-nowrap">
      <PrimaryButton onClick={start}>Start learning free</PrimaryButton>
      <button
        type="button"
        onClick={() => scrollToSection('how-it-works')}
        className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-[var(--mk-line-strong)] px-5 text-[13.5px] tracking-[-0.01em] text-[var(--text-primary)] backdrop-blur-sm transition-colors duration-300 hover:bg-[var(--mk-ink-soft)]"
      >
        See how it works
      </button>
    </div>
  );

  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const k = Math.min(Math.round(morphAt(p)), HERO_SUBJECTS.length - 1);
    if (k !== idx) setIdx(k);
  });

  // Headline hands the stage to the particles, then the subject caption takes over.
  const out = HERO_TEXT_OUT;
  const textOpacity = useTransform(scrollYProgress, mapRange([0, out], [1, 0]));
  // The two halves of the headline part sideways as the subject takes over.
  const leftX = useTransform(scrollYProgress, (p) => `${-mapRange([0, out], [0, 22])(p)}vw`);
  const rightX = useTransform(scrollYProgress, (p) => `${mapRange([0, out], [0, 22])(p)}vw`);
  const textBlur = useTransform(scrollYProgress, (p) => `blur(${mapRange([0, out], [0, 12])(p)}px)`);
  const textEvents = useTransform(scrollYProgress, (p) => (p < out * 0.6 ? 'auto' : 'none'));
  const capOpacity = useTransform(scrollYProgress, mapRange([out * 0.9, out * 1.8, 0.97, 1], [0, 1, 1, 0.6]));
  const capY = useTransform(scrollYProgress, mapRange([out * 0.9, out * 1.8], [40, 0]));
  const capEvents = useTransform(scrollYProgress, (p) => (p > out * 1.2 ? 'auto' : 'none'));

  // Jump straight to a subject: scroll the hero to where that shape is fully formed.
  const jump = (k) => {
    const sc = container?.current;
    const el = ref.current;
    if (!sc || !el) return;
    const top = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
    sc.scrollTo({ top: top + heroProgressFor(k, HERO_SUBJECTS.length) * (el.offsetHeight - sc.clientHeight), behavior: 'smooth' });
  };

  return (
    <section ref={ref} className="relative h-[600vh]" aria-label="TutorBoard">
      <div className="sticky top-0 h-screen overflow-hidden">
        <div className="mk-dots absolute inset-0 opacity-0 dark:opacity-50 [mask-image:radial-gradient(ellipse_at_62%_50%,black_10%,transparent_65%)]" />
        <div className="absolute inset-0">
          <ErrorBoundary fallback={null}>
            <Suspense fallback={null}>
              <ParticleMorph progress={scrollYProgress} active={inView} reduce={!!reduce} compact={compact} openY={0.05} />
            </Suspense>
          </ErrorBoundary>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-[var(--bg-primary)] via-[rgba(var(--bg-primary-rgb),0.78)] to-transparent lg:hidden" />

        {/* Opening: two blocks on a diagonal, the galaxy between them. */}
        <motion.div style={{ opacity: textOpacity, filter: textBlur, pointerEvents: textEvents }} className="absolute inset-0">
          <div className="pointer-events-none absolute left-0 top-0 h-[45%] w-[65%] bg-[radial-gradient(ellipse_at_10%_25%,rgba(var(--bg-primary-rgb),0.85),transparent_65%)]" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-[45%] w-[65%] bg-[radial-gradient(ellipse_at_90%_80%,rgba(var(--bg-primary-rgb),0.85),transparent_65%)]" />
          <Container className="relative flex h-full flex-col justify-between pb-10 pt-28 sm:pb-14 lg:pt-32">
            <motion.div style={{ x: leftX }} className="max-w-[560px]">
              <h1 className={`${HEADLINE} text-[clamp(2.8rem,7vw,6.6rem)] leading-[0.95]`}>
                <SplitText text="Every subject," delay={0.15} />
                <span className="sr-only"> drawn live.</span>
              </h1>
              <motion.p
                className="mt-4 max-w-[34ch] border-l-2 border-[var(--mk-accent)] pl-3 text-[13px] leading-[1.55] text-[var(--text-secondary)] sm:mt-5 sm:max-w-[40ch] sm:text-[15.5px] sm:leading-[1.6]"
                initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.5 }}
              >
                {LEDE}
              </motion.p>
            </motion.div>
            <motion.div style={{ x: rightX }} className="flex flex-col items-end text-right">
              <div aria-hidden="true" className={`${HEADLINE} text-[clamp(2.8rem,7vw,6.6rem)] leading-[0.95] text-[var(--text-tertiary)]`}>
                <SplitText text="drawn live." delay={0.32} />
              </div>
              <motion.div
                className="mt-6"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease: EASE, delay: 0.65 }}
              >
                {buttons}
              </motion.div>
            </motion.div>
          </Container>
        </motion.div>

        <motion.div style={{ opacity: capOpacity, y: capY }} className="pointer-events-none absolute inset-x-0 bottom-0 pb-10 sm:pb-14">
          <Container className="flex items-end justify-between gap-8">
            <div className="min-w-0">
              <div className="text-[12px] font-medium text-[var(--text-tertiary)]">
                {String(idx + 1).padStart(2, '0')} / {TOTAL} · one canvas, every subject
              </div>
              <div className="relative mt-2 h-[clamp(2.1rem,3.4vw,3rem)] overflow-hidden">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={idx}
                    className={`${HEADLINE} text-[clamp(1.8rem,3vw,2.6rem)] leading-[1.12]`}
                    initial={{ y: '100%', opacity: 0 }}
                    animate={{ y: '0%', opacity: 1 }}
                    exit={{ y: '-100%', opacity: 0 }}
                    transition={{ duration: 0.75, ease: EASE }}
                  >
                    {HERO_SUBJECTS[idx].name}
                  </motion.div>
                </AnimatePresence>
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={idx}
                  className="mt-1 max-w-[34ch] text-[13.5px] text-[var(--text-secondary)] sm:text-[14px]"
                  initial={{ opacity: 0, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, filter: 'blur(4px)' }}
                  transition={{ duration: 0.35 }}
                >
                  {HERO_SUBJECTS[idx].line}
                </motion.p>
              </AnimatePresence>
              <motion.div style={{ pointerEvents: capEvents }} className="mt-4 flex gap-1 sm:hidden" aria-label="Subjects">
                {HERO_SUBJECTS.map((s, i) => (
                  <button key={s.name} type="button" onClick={() => jump(i)} aria-label={s.name} className="cursor-pointer py-2">
                    <span
                      className={`block h-[2px] rounded-full transition-all duration-500 ${
                        i === idx ? 'w-7 bg-[var(--mk-accent)]' : 'w-3.5 bg-[var(--mk-line-strong)]'
                      }`}
                    />
                  </button>
                ))}
              </motion.div>
            </div>
            <motion.ol style={{ pointerEvents: capEvents }} className="hidden shrink-0 flex-col items-end gap-0.5 pb-1 sm:flex" aria-label="Subjects">
              {HERO_SUBJECTS.map((s, i) => (
                <li key={s.name}>
                  <button
                    type="button"
                    onClick={() => jump(i)}
                    aria-current={i === idx ? 'step' : undefined}
                    className="group flex cursor-pointer items-center justify-end gap-3 py-[3px] text-[12px] font-medium"
                  >
                    <span className="text-[var(--text-tertiary)] opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span
                      className={`transition-colors duration-500 ${
                        i === idx ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] group-hover:text-[var(--text-secondary)]'
                      }`}
                    >
                      {s.name}
                    </span>
                    <span
                      className={`h-px transition-all duration-500 ${
                        i === idx ? 'w-8 bg-[var(--mk-accent)]' : 'w-3 bg-[var(--mk-line-strong)] group-hover:w-5 group-hover:bg-[var(--text-tertiary)]'
                      }`}
                    />
                  </button>
                </li>
              ))}
            </motion.ol>
          </Container>
        </motion.div>

      </div>
    </section>
  );
}

export default function Landing() {
  const { scrollToSection } = useSections();
  return (
    <>
      <Hero />
      <VelocityBand items={['Ask', 'Plan', 'Draw', 'Narrate', 'Rewind', 'Understand']} />
      <HowItWorksSection />
      <FeaturesSection />
      <SolutionsSection />
      <AboutSection />
      <ClosingCTA
        title="Ask your first question."
        muted="Watch it become a lesson."
        secondary={{ label: 'Back to the top', onClick: () => scrollToSection(null) }}
      />
    </>
  );
}
