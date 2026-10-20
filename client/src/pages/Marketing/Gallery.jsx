import React, { useLayoutEffect, useRef, useState } from 'react';
import { motion, useInView, useMotionValue, useScroll, useSpring, useTransform } from 'framer-motion';
import { Chip, Container, Eyebrow, HEADLINE, SplitText, useScrollContainer, useSequence, useTypewriter } from './kit';
import { TimelineMock, MathMock } from './FeatureMocks';
import { WaterScene, MarketScene, PendulumScene, HelixScene } from './GalleryVignettes';
import { TangentMock } from './SolutionMocks';
import { SeasonsViz, SEASONS } from './LessonStage';

function SeasonsLoop({ active }) {
  const { phase } = useSequence([2800, 2800, 3200], active, 1);
  const state = SEASONS[[1, 3, 5][phase]];
  return (
    <div className="absolute inset-x-[5%] inset-y-0 flex items-center">
      <SeasonsViz state={state} />
    </div>
  );
}

// Each card is a lesson someone could ask for: the question, what it covers, how long it runs.
const CARDS = [
  { subject: 'Chemistry', q: 'Why is water a polar molecule?', concepts: ['valence electrons', 'covalent bonds', '104.5° angle', 'dipole'], scenes: 4, time: '1:40', Body: WaterScene },
  { subject: 'Economics', q: 'What happens to price when demand rises?', concepts: ['supply', 'equilibrium', 'demand shock', 'surplus'], scenes: 5, time: '2:10', Body: MarketScene },
  { subject: 'Physics', q: 'Why does a pendulum keep a steady rhythm?', concepts: ['angle', 'velocity', 'KE ⇄ PE', 'period'], scenes: 4, time: '1:30', Body: PendulumScene },
  { subject: 'Earth science', q: 'Why do we have seasons?', concepts: ['orbit', '23.4° tilt', 'direct light', 'hemispheres'], scenes: 4, time: '1:45', Body: SeasonsLoop },
  { subject: 'Calculus', q: 'What does a derivative actually measure?', concepts: ['tangent', 'slope', 'f′(x)', 'max and min'], scenes: 3, time: '1:20', Body: TangentMock },
  { subject: 'History', q: 'How did WWI lead to WWII?', concepts: ['1914', 'Versailles', '1929 crash', '1939'], scenes: 5, time: '2:30', Body: TimelineMock },
  { subject: 'Genetics', q: 'How does DNA store information?', concepts: ['double helix', 'base pairs', 'A–T', 'G–C'], scenes: 4, time: '1:50', Body: HelixScene },
  { subject: 'Algebra', q: 'Where does the quadratic formula come from?', concepts: ['completing the square', 'discriminant', 'roots'], scenes: 4, time: '1:35', Body: MathMock },
];

function metrics(vw, vh) {
  const small = vw < 640;
  const cw = small ? Math.round(vw * 0.82) : Math.min(500, Math.round(vw * 0.36));
  const gap = small ? 14 : 22;
  const pad = Math.max(0, (vw - 1160) / 2) + (small ? 20 : vw < 1024 ? 32 : 40);
  const track = pad * 2 + CARDS.length * cw + (CARDS.length - 1) * gap;
  const distance = Math.max(0, track - vw);
  return { cw, gap, pad, distance, height: vh + distance };
}

/** A full-bleed tile: the lesson fills it; its question types itself out as the tile arrives. */
function Tile({ card, index, active }) {
  const { Body } = card;
  const ref = useRef(null);
  const seen = useInView(ref, { amount: 0.6, once: true });
  const typed = useTypewriter(card.q, seen, false, 22);
  const typing = seen && typed.length < card.q.length;
  return (
    <article
      ref={ref}
      className="group relative h-[clamp(380px,58vh,560px)] shrink-0 overflow-hidden rounded-[22px] border border-black/[0.15] hover:border-black/[0.3] dark:border-white/[0.1] dark:hover:border-white/[0.2] bg-white dark:bg-[#0c0c0b] shadow-[0_4px_20px_-4px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,1)] dark:shadow-[0_16px_40px_-16px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,box-shadow,transform] duration-500 hover:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.12),0_8px_20px_-4px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,1)] dark:hover:shadow-[0_30px_60px_-20px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.08)] hover:-translate-y-1.5"
      style={{ width: 'var(--card-w)' }}
    >
      <div className="mk-dots absolute inset-0 opacity-25 dark:opacity-50" />
      <div className="@container absolute inset-x-0 bottom-[22%] top-0">
        <Body active={active} />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[44%] bg-gradient-to-t from-white via-white/85 to-transparent dark:from-[#0c0c0b] dark:via-[#0c0c0b]/85 dark:to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
        <div className="text-[12px] font-medium text-[var(--mk-accent)]">
          {String(index + 1).padStart(2, '0')} · {card.subject}
        </div>
        <h3 className="mt-2 min-h-[2.6em] text-[17px] font-[450] leading-[1.3] tracking-[-0.015em] text-[var(--text-primary)] sm:text-[19px]" aria-label={card.q}>
          <span aria-hidden="true">
            {typed}
            {typing && <span className="mk-caret ml-px inline-block h-[0.95em] w-[2px] translate-y-[2px] bg-[var(--mk-accent)]" />}
          </span>
        </h3>
        <div className="grid grid-rows-[0fr] opacity-0 transition-all duration-500 group-hover:grid-rows-[1fr] group-hover:opacity-100">
          <div className="flex flex-wrap gap-1.5 overflow-hidden pt-2">
            {card.concepts.map((c) => (
              <Chip key={c} className="bg-neutral-100/90 dark:bg-white/5 border-black/[0.06] dark:border-white/10 text-neutral-600 dark:text-neutral-300 shadow-xs">
                {c}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

/** Your scroll drives the row sideways: a Netflix-style shelf of lessons, each one playing. */
export default function Gallery() {
  const ref = useRef(null);
  const container = useScrollContainer();
  const [m, setM] = useState(() => metrics(window.innerWidth, window.innerHeight));
  const geo = useMotionValue(m);
  const { scrollYProgress } = useScroll({ container: container || undefined, target: ref, offset: ['start start', 'end end'] });
  const raw = useTransform([scrollYProgress, geo], ([p, g]) => -p * g.distance);
  const x = useSpring(raw, { stiffness: 260, damping: 42, mass: 0.35 });
  const bar = useTransform(scrollYProgress, (p) => p);
  const active = useInView(ref, { amount: 0 });

  useLayoutEffect(() => {
    const measure = () => {
      const next = metrics(ref.current?.clientWidth || window.innerWidth, window.innerHeight);
      setM(next);
      geo.set(next);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [geo]);

  return (
    <section ref={ref} className="relative" style={{ height: m.height }} aria-label="Subjects TutorBoard can draw">
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden pt-20" style={{ '--card-w': `${m.cw}px` }}>
        <Container className="mb-6 flex items-end justify-between gap-6 lg:mb-8">
          <div>
            <Eyebrow index="2.1">What it can draw</Eyebrow>
            <h3 className={`${HEADLINE} mt-4 text-[clamp(1.6rem,3.2vw,2.5rem)] leading-[1.05]`}>
              <SplitText text="Every subject." inView />{' '}
              <span className="text-[var(--text-tertiary)]">
                <SplitText text="One engine." inView delay={0.1} />
              </span>
            </h3>
          </div>
          <div className="hidden w-40 shrink-0 sm:block">
            <div className="mb-2 text-right text-[12px] font-medium text-[var(--text-tertiary)]">Scroll to browse</div>
            <div className="relative h-px bg-[var(--mk-line-strong)]">
              <motion.span className="absolute inset-0 origin-left bg-[var(--mk-accent)]" style={{ scaleX: bar }} />
            </div>
          </div>
        </Container>
        <motion.div className="flex" style={{ x, gap: m.gap, paddingLeft: m.pad, paddingRight: m.pad }}>
          {CARDS.map((c, i) => (
            <Tile key={c.subject} card={c} index={i} active={active} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
