import React from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { SunMoon, Keyboard, UserCheck, BookmarkCheck } from 'lucide-react';
import { EASE, Container, SectionHead, SectionIntro, Reveal, useActive, useSpy } from './kit';
import { NarrationMock, InterruptMock, FilmstripMock, RoutingMock } from './FeatureMocks';
import Gallery from './Gallery';

const TILES = [
  {
    Mock: NarrationMock,
    title: 'Narrated, in sync',
    body: 'Every step is explained as it happens, and the canvas reacts to the words you hear.',
    span: 'lg:col-span-7',
  },
  {
    Mock: InterruptMock,
    title: 'Interrupt any time',
    body: 'Pause mid-lesson to ask what you are wondering. The answer is pinned to that exact moment.',
    span: 'lg:col-span-5',
  },
  {
    Mock: FilmstripMock,
    title: 'Rewind any moment',
    body: 'Each step is saved as you go. Jump back to any frame and the canvas returns exactly as it was.',
    span: 'lg:col-span-5',
  },
  {
    Mock: RoutingMock,
    title: 'Your keys, with fallback',
    body: 'Bring your own API key. If a provider is busy, the next one in line picks up the lesson.',
    span: 'lg:col-span-7',
  },
];

const DETAILS = [
  { icon: SunMoon, title: 'Light and dark', body: 'Designed for both, down to every line on the canvas.' },
  { icon: Keyboard, title: 'Keyboard first', body: 'Move through a lesson without reaching for the mouse.' },
  { icon: UserCheck, title: 'Guest mode', body: 'Try it without an account. Ten messages, on us.' },
  { icon: BookmarkCheck, title: 'Sessions kept', body: 'Recent canvases are saved, so you can pick up where you left off.' },
];

/** A capability card that leans toward the cursor, as if it were a sheet you could pick up. */
function Tile({ tile, index }) {
  const [ref, active] = useActive(0.3);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rotateX = useSpring(rx, { stiffness: 180, damping: 18 });
  const rotateY = useSpring(ry, { stiffness: 180, damping: 18 });
  const { Mock } = tile;

  const track = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    e.currentTarget.style.setProperty('--mx', `${px * r.width}px`);
    e.currentTarget.style.setProperty('--my', `${py * r.height}px`);
    if (e.pointerType === 'mouse') {
      ry.set((px - 0.5) * 7);
      rx.set(-(py - 0.5) * 7);
    }
  };
  const reset = () => {
    rx.set(0);
    ry.set(0);
  };

  return (
    <motion.div
      className={tile.span}
      initial={{ opacity: 0, y: 40, rotateX: 16 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 1, ease: EASE, delay: (index % 2) * 0.08 }}
      style={{ transformPerspective: 1100, transformOrigin: '50% 100%' }}
    >
      <motion.article
        ref={ref}
        onPointerMove={track}
        onPointerLeave={reset}
        className="group relative flex h-full flex-col overflow-hidden rounded-[22px] border border-[var(--mk-line)] bg-[var(--mk-surface)] transition-[border-color] duration-500 hover:border-[var(--mk-line-strong)]"
        style={{ rotateX, rotateY, transformPerspective: 1100 }}
      >
        <div className="mk-spotlight pointer-events-none absolute inset-0 z-20 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <div className="@container relative h-[280px] overflow-hidden border-b border-[var(--mk-line)] bg-[var(--mk-sunken)] sm:h-[310px]">
          <div className="mk-dots absolute inset-0 opacity-60" />
          <Mock active={active} />
        </div>
        <div className="relative flex flex-1 flex-col p-6 sm:p-7">
          <div className="font-mono text-[10.5px] tracking-[0.12em] text-[var(--text-tertiary)]">2.{index + 2}</div>
          <h3 className="mt-2.5 text-[18px] font-[450] tracking-[-0.02em] text-[var(--text-primary)]">{tile.title}</h3>
          <p className="mt-2 max-w-[46ch] text-[14.5px] leading-[1.6] text-[var(--text-secondary)]">{tile.body}</p>
        </div>
      </motion.article>
    </motion.div>
  );
}

export default function FeaturesSection() {
  const ref = useSpy('features');
  return (
    <section id="features" ref={ref} className="relative">
      <SectionIntro
        index="02"
        label="Features"
        title="A canvas that teaches."
        muted="Not a chat that talks."
        lede="Understanding comes faster when you watch it unfold, and stop it to question why."
      />

      <Gallery />

      <Container className="pt-24 lg:pt-36">
        <SectionHead index="2.2" label="Built in" title="Made for" muted="real understanding." />
        <div className="mt-12 grid gap-4 lg:mt-16 lg:grid-cols-12 lg:gap-5">
          {TILES.map((t, i) => (
            <Tile key={t.title} tile={t} index={i} />
          ))}
        </div>
      </Container>

      <Container className="py-20 lg:py-32">
        <SectionHead index="2.6" label="The details" title="Small things," muted="done carefully." />
        <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[18px] border border-[var(--mk-line)] bg-[var(--mk-line)] sm:grid-cols-2 lg:grid-cols-4">
          {DETAILS.map((d, i) => {
            const Icon = d.icon;
            return (
              <Reveal key={d.title} delay={i * 0.06} className="bg-[var(--bg-primary)] p-4 sm:p-7">
                <div className="flex items-center justify-between">
                  <div className="font-mono text-[10.5px] text-[var(--text-tertiary)]">{String(i + 1).padStart(2, '0')}</div>
                  <Icon className="h-4 w-4 text-[var(--mk-accent)] opacity-85" />
                </div>
                <h4 className="mt-3 text-[14px] sm:mt-6 sm:text-[16px] font-[450] tracking-[-0.015em] text-[var(--text-primary)]">{d.title}</h4>
                <p className="hidden sm:block mt-1.5 text-[14px] leading-[1.6] text-[var(--text-secondary)]">{d.body}</p>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
