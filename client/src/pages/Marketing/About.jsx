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
  const draw = {
    initial: { pathLength: 0, opacity: 0 },
    whileInView: { pathLength: 1, opacity: 1 },
    viewport: { once: true, amount: 0.8 },
    transition: { duration: 1.2, ease: EASE },
  };
  const s = { fill: 'none', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round', style: { stroke: 'var(--text-primary)' } };
  return (
    <svg viewBox="0 0 48 48" className="h-12 w-12">
      {kind === 'eye' && (
        <>
          <motion.path d="M4 24 C 12 12, 36 12, 44 24 C 36 36, 12 36, 4 24 Z" {...s} {...draw} />
          <motion.circle
            cx="24"
            cy="24"
            r="5"
            style={{ fill: 'var(--mk-accent)' }}
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.8 }}
          />
        </>
      )}
      {kind === 'rewind' && (
        <>
          <motion.path d="M38 24 A 14 14 0 1 1 30 11.4" {...s} {...draw} />
          <motion.path d="M30 5 L31 12 L24 13" {...s} {...draw} transition={{ ...draw.transition, delay: 0.9, duration: 0.4 }} />
          <circle cx="24" cy="24" r="2.5" style={{ fill: 'var(--mk-accent)' }} />
        </>
      )}
      {kind === 'calm' && (
        <>
          <motion.path d="M4 30 C 12 22, 18 22, 24 30 S 36 38, 44 30" {...s} {...draw} />
          <motion.path d="M4 20 C 12 12, 18 12, 24 20 S 36 28, 44 20" {...s} {...draw} style={{ stroke: 'var(--mk-line-strong)' }} transition={{ ...draw.transition, delay: 0.2 }} />
        </>
      )}
      {kind === 'ask' && (
        <>
          <motion.path d="M17 17 C 17 9, 31 9, 31 17 C 31 23, 24 23, 24 30" {...s} {...draw} />
          <motion.circle
            cx="24"
            cy="38"
            r="2.6"
            style={{ fill: 'var(--mk-accent)' }}
            initial={{ scale: 0 }}
            whileInView={{ scale: 1 }}
            viewport={{ once: true }}
            transition={{ type: 'spring', stiffness: 300, damping: 14, delay: 1 }}
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
    <li ref={ref} onMouseEnter={() => onActive(index)} className="border-t border-[var(--mk-line)] py-7 last:border-b lg:py-9">
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
            <div className="mt-10 hidden items-center gap-6 lg:flex">
              <div key={active} className="grid h-24 w-24 place-items-center rounded-full border border-[var(--mk-line-strong)] [&_svg]:h-14 [&_svg]:w-14">
                <Glyph kind={p.glyph} />
              </div>
              <div className="text-[12px] font-medium text-[var(--text-tertiary)]">
                <span className="text-[var(--text-primary)]">{String(active + 1).padStart(2, '0')}</span> / {String(PRINCIPLES.length).padStart(2, '0')}
                <div className="mt-1 normal-case tracking-normal">{p.title}</div>
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
