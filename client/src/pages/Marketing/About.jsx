import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import { EASE, Container, SectionIntro, SectionHead, Reveal, Eyebrow, SlideArrow, mapRange, useScrollContainer, useSpy, useStartLearning } from './kit';

const MANIFESTO =
  'Humans learn by seeing and interacting, not reading walls of text. TutorBoard turns complex ideas into live interactive lessons you can watch, pause, and question.';

const PRINCIPLES = [
  {
    title: 'Show, then tell.',
    body: 'A picture comes first and words second. Narration explains what you are already looking at.',
    glyph: 'eye',
  },
  {
    title: 'Every step reversible.',
    body: 'Learning is not linear. Any moment can be revisited, questioned and replayed.',
    glyph: 'rewind',
  },
  {
    title: 'Calm by default.',
    body: 'No confetti, no noise. Motion is used only when it carries meaning.',
    glyph: 'calm',
  },
  {
    title: 'Curiosity first.',
    body: 'Questions are welcome at any point in a lesson, not saved for the end.',
    glyph: 'ask',
  },
];

function Word({ children, progress, range }) {
  const opacity = useTransform(progress, mapRange(range, [0.28, 1]));
  return (
    <motion.span style={{ opacity }} className="transition-none">
      {children}{' '}
    </motion.span>
  );
}

function Manifesto() {
  const ref = useRef(null);
  const container = useScrollContainer();
  const { scrollYProgress } = useScroll({ container: container || undefined, target: ref, offset: ['start 0.85', 'end 0.5'] });
  const words = MANIFESTO.split(' ');
  return (
    <Container className="py-20 lg:py-32">
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <Reveal>
            <Eyebrow index="4.1">Why we exist</Eyebrow>
          </Reveal>
        </div>
        <p ref={ref} className="text-[clamp(1.55rem,3.1vw,2.6rem)] font-[450] leading-[1.22] tracking-[-0.035em] text-[var(--text-primary)] lg:col-span-9">
          {words.map((w, i) => (
            <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
              {w}
            </Word>
          ))}
        </p>
      </div>
    </Container>
  );
}

function Glyph({ kind }) {
  const draw = (delay = 0, duration = 0.5) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: { duration, ease: EASE, delay },
  });

  const pop = (delay = 0) => ({
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    transition: { type: 'spring', stiffness: 360, damping: 18, delay },
  });

  const s = { fill: 'none', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', style: { stroke: 'var(--text-primary)' } };
  const faint = { fill: 'none', strokeWidth: 1.2, strokeLinecap: 'round', strokeLinejoin: 'round', style: { stroke: 'var(--mk-line-strong)' } };

  return (
    <svg viewBox="0 0 48 48" className="h-12 w-12" aria-hidden="true">
      {/* 01: Show, then tell — Clear ocular eye with focus iris and amber pupil */}
      {kind === 'eye' && (
        <>
          <motion.path d="M 5 24 C 12 12.5, 36 12.5, 43 24" {...s} {...draw(0, 0.5)} />
          <motion.path d="M 5 24 C 12 35.5, 36 35.5, 43 24" {...s} {...draw(0.08, 0.5)} />
          <motion.circle cx="24" cy="24" r="7.5" {...s} {...draw(0.2, 0.45)} />
          <motion.circle
            cx="24"
            cy="24"
            r="3.2"
            style={{ fill: 'var(--mk-accent)' }}
            {...pop(0.35)}
          />
          <circle cx="26.2" cy="21.8" r="1" style={{ fill: '#ffffff' }} />
        </>
      )}

      {/* 02: Every step reversible — Bold counter-clockwise rewind arc, central << chevrons and single checkpoint */}
      {kind === 'rewind' && (
        <>
          {/* Main counter-clockwise sweep arc */}
          <motion.path
            d="M 34 34 A 14 14 0 1 0 12 18"
            {...s}
            {...draw(0, 0.55)}
          />
          {/* Clean crisp reverse arrowhead */}
          <motion.path
            d="M 12 10.5 L 11 18.5 L 19 17.5"
            {...s}
            {...draw(0.4, 0.25)}
          />
          {/* Central replay double-chevron */}
          <motion.path
            d="M 21 19.5 L 16.5 24 L 21 28.5 M 28 19.5 L 23.5 24 L 28 28.5"
            {...s}
            {...draw(0.25, 0.4)}
          />
          {/* Single active timeline checkpoint */}
          <motion.circle
            cx="34"
            cy="34"
            r="2.6"
            style={{ fill: 'var(--mk-accent)' }}
            {...pop(0.45)}
          />
        </>
      )}

      {/* 03: Calm by default — Pure horizontal horizon and soothing harmonic wave */}
      {kind === 'calm' && (
        <>
          <motion.line x1="6" y1="24" x2="42" y2="24" {...faint} strokeDasharray="2 3" {...draw(0, 0.45)} />
          <motion.path
            d="M 6 24 C 11 14, 16 34, 21 18 C 26 28, 30 22, 34 24 L 42 24"
            {...s}
            {...draw(0.12, 0.6)}
          />
          <motion.circle
            cx="34"
            cy="24"
            r="2.8"
            style={{ fill: 'var(--mk-accent)' }}
            {...pop(0.45)}
          />
        </>
      )}

      {/* 04: Curiosity first — Elegant inquiry curve with amber insight node */}
      {kind === 'ask' && (
        <>
          <motion.path
            d="M 16 17 C 16 9.5, 32 9.5, 32 17 C 32 23, 24 23, 24 29"
            {...s}
            strokeWidth={2}
            {...draw(0, 0.55)}
          />
          <motion.circle
            cx="24"
            cy="36"
            r="3"
            style={{ fill: 'var(--mk-accent)' }}
            {...pop(0.35)}
          />
          <motion.circle
            cx="24"
            cy="36"
            r="6"
            {...faint}
            strokeDasharray="2 3"
            {...draw(0.2, 0.35)}
          />
        </>
      )}
    </svg>
  );
}

/** One principle: set large; it lights up and opens when it reaches the middle of the screen. */
function PrincipleRow({ p, index, active, onActive }) {
  const ref = useRef(null);
  const inView = useInView(ref, { margin: '-45% 0px -50% 0px' });
  useEffect(() => {
    if (inView) onActive(index);
  }, [inView, index, onActive]);
  return (
    <li
      ref={ref}
      onMouseEnter={() => onActive(index)}
      onClick={() => onActive(index)}
      className="cursor-pointer border-t border-[var(--mk-line)] py-7 last:border-b lg:py-9"
    >
      <div className="flex items-baseline gap-5 sm:gap-8">
        <span
          className={`w-6 shrink-0 font-mono text-[11px] transition-colors duration-500 ${
            active ? 'text-[var(--mk-accent)]' : 'text-[var(--text-tertiary)]'
          }`}
        >
          {String(index + 1).padStart(2, '0')}
        </span>
        <h3
          className={`text-[clamp(1.9rem,4.4vw,3.8rem)] font-[450] leading-[1.02] tracking-[-0.045em] transition-[color,opacity] duration-500 ${
            active ? 'text-[var(--text-primary)] opacity-100' : 'text-[var(--text-tertiary)] opacity-45'
          }`}
        >
          {p.title}
        </h3>
      </div>
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] ${
          active ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <p className="overflow-hidden pl-11 text-[16px] leading-[1.65] text-[var(--text-secondary)] sm:pl-14 sm:text-[17px]">
          <span className="block max-w-[50ch] pt-4">{p.body}</span>
        </p>
      </div>
    </li>
  );
}

function Principles() {
  const [active, setActive] = useState(0);
  const p = PRINCIPLES[active];
  return (
    <Container className="py-20 lg:py-32">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-36">
            <SectionHead index="4.2" label="What we believe" title="Four principles," muted="applied everywhere." />
            <div className="mt-8 flex items-center gap-5 sm:gap-6 lg:mt-10">
              <div
                key={active}
                className="grid h-24 w-24 shrink-0 place-items-center rounded-full border border-[var(--mk-line-strong)] bg-transparent [&_svg]:h-12 [&_svg]:w-12"
              >
                <Glyph kind={p.glyph} />
              </div>
              <div className="text-[12px] font-medium text-[var(--text-tertiary)]">
                <span className="font-mono text-[14px] font-semibold text-[var(--text-primary)]">{String(active + 1).padStart(2, '0')}</span>{' '}
                <span className="font-mono text-[13px] text-[var(--text-tertiary)]">/ {String(PRINCIPLES.length).padStart(2, '0')}</span>
                <div className="mt-1 text-[13px] font-normal normal-case tracking-normal text-[var(--text-secondary)]">{p.title}</div>
              </div>
            </div>
          </div>
        </div>
        <ol className="lg:col-span-8">
          {PRINCIPLES.map((x, i) => (
            <PrincipleRow key={x.title} p={x} index={i} active={active === i} onActive={setActive} />
          ))}
        </ol>
      </div>
    </Container>
  );
}

const SUBJECTS = ['Physics', 'Biology', 'History', 'Economics', 'Maths', 'Chemistry', 'Geography', 'Code'];

function FactCard({ k, delay = 0, className = '', children }) {
  return (
    <motion.li
      className={`group relative flex min-h-[200px] flex-col overflow-hidden rounded-[20px] border border-[var(--mk-line)] bg-[var(--mk-surface)] p-6 transition-colors duration-300 hover:border-[var(--mk-line-strong)] ${className}`}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      <div className="text-[12px] font-medium text-[var(--text-tertiary)]">{k}</div>
      {children}
    </motion.li>
  );
}

const big = 'text-[clamp(1.7rem,2.6vw,2.2rem)] font-[450] leading-[1.05] tracking-[-0.04em] text-[var(--text-primary)]';
const small = 'mt-2 text-[14px] leading-[1.55] text-[var(--text-secondary)]';

function Colophon() {
  const start = useStartLearning();
  return (
    <Container className="py-12 lg:py-20">
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <Reveal>
            <Eyebrow index="4.3">In brief</Eyebrow>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="mt-6 max-w-[24ch] text-[22px] font-[450] leading-[1.2] tracking-[-0.03em] text-[var(--text-primary)]">
              The short version, <span className="text-[var(--text-tertiary)]">for the curious.</span>
            </p>
          </Reveal>
        </div>

        <ol className="grid gap-3 sm:grid-cols-2 lg:col-span-9 lg:grid-cols-3">
          {/* Engine: the four systems as a small rail */}
          <FactCard k="Engine" className="sm:col-span-2">
            <div className={`mt-auto pt-8 ${big}`}>Four systems, one lesson.</div>
            <div className="mt-6 grid grid-cols-4 gap-2">
              {['Intent', 'Planner', 'Renderer', 'Narrator'].map((n, i) => (
                <div key={n} className="min-w-0">
                  <div className="relative h-px bg-[var(--mk-line-strong)]">
                    <motion.span
                      className="absolute inset-0 origin-left bg-[var(--text-primary)]"
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true, amount: 0.6 }}
                      transition={{ duration: 0.6, ease: EASE, delay: 0.3 + i * 0.25 }}
                    />
                    <span className={`absolute -top-[3px] left-0 h-[7px] w-[7px] rounded-full ${i === 3 ? 'bg-[var(--mk-accent)]' : 'bg-[var(--text-primary)]'}`} />
                  </div>
                  <div className="mt-3 truncate text-[13px] text-[var(--text-secondary)]">{n}</div>
                </div>
              ))}
            </div>
          </FactCard>

          <FactCard k="Experience" delay={0.06}>
            <div className="mt-auto pt-8">
              <div className="font-mono text-[clamp(2.4rem,3.8vw,3.2rem)] leading-none tracking-[-0.04em] text-[var(--text-primary)]">
                60<span className="text-[0.55em] font-sans font-normal text-[var(--mk-accent)] ml-1">FPS</span>
              </div>
              <p className={small}>Real-time interactive canvas. Pan, scrub, and question live.</p>
            </div>
          </FactCard>

          <FactCard k="Subjects" delay={0.1}>
            <div className={`mt-auto pt-8 ${big}`}>Any you can ask about.</div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {SUBJECTS.map((s, i) => (
                <motion.span
                  key={s}
                  className="rounded-full border border-[var(--mk-line-strong)] px-2.5 py-1 text-[12px] text-[var(--text-secondary)]"
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, ease: EASE, delay: 0.2 + i * 0.05 }}
                >
                  {s}
                </motion.span>
              ))}
            </div>
          </FactCard>

          <FactCard k="Intelligence" delay={0.14}>
            <div className="mt-auto pt-8">
              <div className={`font-[450] tracking-[-0.03em] ${big}`}>Multi-model AI</div>
              <p className={small}>Dynamic visual synthesis with synchronized voice narration.</p>
            </div>
          </FactCard>

          <FactCard k="Try it" delay={0.18} className="bg-[var(--text-primary)]! border-transparent! hover:border-transparent!">
            <div className="mt-auto pt-8 text-[clamp(1.7rem,2.6vw,2.2rem)] font-[450] leading-[1.05] tracking-[-0.04em] text-[var(--bg-primary)]">
              No account needed.
            </div>
            <button
              type="button"
              onClick={start}
              className="group mt-5 inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-full bg-[var(--bg-primary)] px-4 text-[13.5px] font-medium text-[var(--text-primary)] transition-opacity hover:opacity-90"
            >
              Start as a guest
              <SlideArrow />
            </button>
          </FactCard>
        </ol>
      </div>
    </Container>
  );
}

export default function AboutSection() {
  const ref = useSpy('about');
  return (
    <section id="about" ref={ref} className="relative">
      <SectionIntro
        index="04"
        label="About"
        title="Great tutors"
        muted="reach for the whiteboard."
        lede="AI explains in walls of text. We built the interactive tutor that draws live."
      />
      <Manifesto />
      <Principles />
      <Colophon />
    </section>
  );
}
