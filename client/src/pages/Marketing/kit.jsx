import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  motion,
  AnimatePresence,
  useAnimationFrame,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  useVelocity,
} from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import VisaiLogo from '../../components/layout/VisaiLogo';

/* ── Motion language ─────────────────────────────────────────────── */

export const EASE = [0.22, 1, 0.36, 1];
export const EASE_IN_OUT = [0.65, 0, 0.35, 1];
export const SPRING = { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 };
export const SOFT = { type: 'spring', stiffness: 170, damping: 26, mass: 1 };

/* ── Layout ───────────────────────────────────────────────────────── */

/** The marketing layout scrolls inside its own element, not the window. */
export const ScrollContainerContext = React.createContext(null);
export const useScrollContainer = () => React.useContext(ScrollContainerContext);

export function Container({ as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag className={`mx-auto w-full max-w-[1160px] px-5 sm:px-8 lg:px-10 ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

/** "01 — How it works", the same index-and-rule rhythm as the navigation. */
export function Eyebrow({ index, children, className = '' }) {
  return (
    <div className={`flex items-center gap-2.5 text-[12px] font-medium text-[var(--text-tertiary)] ${className}`}>
      {index && <span className="text-[var(--text-secondary)]">{index}</span>}
      {index && <span className="h-px w-5 bg-[var(--mk-line-strong)]" />}
      <span>{children}</span>
    </div>
  );
}

/** Words rise out of a mask, one after another. */
export function SplitText({ text, delay = 0, stagger = 0.04, inView = false }) {
  const reduce = useReducedMotion();
  // Watch the whole line, not each word: a word starts outside its clipping
  // mask, so observing the word itself never reports it as visible.
  const ref = useRef(null);
  const seen = useInView(ref, { once: true, amount: 0.3 });
  const show = !inView || seen;
  const words = text.split(' ');
  return (
    <span ref={ref}>
      {words.map((word, i) => (
        <React.Fragment key={`${word}-${i}`}>
          <span className="-mb-[0.12em] inline-block overflow-hidden pb-[0.12em] align-top">
            <motion.span
              className="inline-block will-change-transform"
              initial={reduce ? false : { y: '108%' }}
              animate={show ? { y: '0%' } : undefined}
              transition={{ duration: 1, ease: EASE, delay: delay + i * stagger }}
            >
              {word}
            </motion.span>
          </span>
          {i < words.length - 1 && ' '}
        </React.Fragment>
      ))}
    </span>
  );
}

export function Reveal({ as = 'div', children, delay = 0, y = 14, amount = 0.25, className = '', ...rest }) {
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y, filter: 'blur(6px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.9, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </Comp>
  );
}

const headlineClass =
  'font-[450] tracking-[-0.045em] text-[var(--text-primary)] [text-wrap:balance]';

export const HEADLINE = headlineClass;

/* ── One-page navigation ──────────────────────────────────────────── */

/** Which section is under the middle of the screen, and how to get to one. */
export const SectionContext = React.createContext({ active: null, setActive: () => {}, scrollToSection: () => {} });
export const useSections = () => React.useContext(SectionContext);

/** Reports `id` as the current section while `ref` spans the middle of the screen. */
export function useSpy(id, externalRef) {
  const ownRef = useRef(null);
  const ref = externalRef || ownRef;
  const { setActive } = useSections();
  const inView = useInView(ref, { margin: '-48% 0px -51% 0px' });
  useEffect(() => {
    if (inView) setActive(id);
  }, [inView, id, setActive]);
  return ref;
}

export function useMediaQuery(query) {
  const [match, setMatch] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

/**
 * Piecewise-linear mapping for scroll-linked styles. Used as a function transform on
 * purpose: Framer's range form hands opacity/filter to a native ScrollTimeline bound to
 * the document, which never scrolls here (the layout scrolls its own container).
 */
export function mapRange(input, output) {
  return (v) => {
    if (v <= input[0]) return output[0];
    for (let i = 1; i < input.length; i += 1) {
      if (v <= input[i]) {
        const t = (v - input[i - 1]) / (input[i] - input[i - 1] || 1);
        return output[i - 1] + (output[i] - output[i - 1]) * t;
      }
    }
    return output[output.length - 1];
  };
}

/* Hero choreography, as fractions of the hero's scroll: the headline is gone by
   HERO_TEXT_OUT, then the particles walk through every subject. */
export const HERO_SUBJECT_COUNT = 9;
export const HERO_TEXT_OUT = 0.04;
const MORPH_START = 0.05;
const MORPH_END = 0.985;

/** 
 * Hero scroll (0..1) → morph position (0..count-1).
 * Each subject holds and completes a full 180° rotation during the hold window (0..0.72),
 * and only transitions to the next subject at the end of the segment (0.72..1.0).
 */
export function morphAt(p, count = HERO_SUBJECT_COUNT) {
  const raw = Math.min(Math.max((p - MORPH_START) / (MORPH_END - MORPH_START), 0), 1) * (count - 1);
  if (raw >= count - 1) return count - 1;
  const seg = Math.min(Math.floor(raw), count - 2);
  const frac = raw - seg;
  // Fluid continuous transition across the segment for organic, dynamic particle flow
  const morphFrac = Math.min(Math.max((frac - 0.16) / 0.68, 0), 1);
  return seg + morphFrac * morphFrac * (3 - 2 * morphFrac);
}

/** Hero scroll at which subject `k` is fully formed. */
export function heroProgressFor(k, count = HERO_SUBJECT_COUNT) {
  const norm = k / (count - 1);
  return MORPH_START + norm * (MORPH_END - MORPH_START);
}

/** Section opener: heading on the left, a giant outlined numeral drifting sideways behind it. */
export function SectionIntro({ index, label, title, muted, lede }) {
  const ref = useRef(null);
  const container = useScrollContainer();
  const { scrollYProgress } = useScroll({ container: container || undefined, target: ref, offset: ['start end', 'end start'] });
  const x = useTransform(scrollYProgress, (v) => `${mapRange([0, 1], [22, -22])(v)}%`);
  const rotate = useTransform(scrollYProgress, mapRange([0, 1], [-4, 4]));
  return (
    <div ref={ref} className="relative overflow-hidden">
      <Container className="relative pb-14 pt-28 lg:pb-20 lg:pt-40">
        <motion.div
          aria-hidden="true"
          style={{ x, rotate }}
          className="pointer-events-none absolute right-2 -top-2 select-none text-[clamp(12rem,32vw,26rem)] font-[450] leading-none tracking-[-0.07em] text-transparent [-webkit-text-stroke:1px_var(--mk-line-strong)] lg:right-6 lg:-top-4"
        >
          {index}
        </motion.div>
        <SectionHead index={index} label={label} title={title} muted={muted} lede={lede} className="relative" />
      </Container>
    </div>
  );
}

const wrap = (min, max, v) => {
  const r = max - min;
  return ((((v - min) % r) + r) % r) + min;
};

/**
 * A band of huge words that drifts sideways and speeds up with the scroll,
 * reversing when the reader scrolls back up.
 */
export function VelocityBand({ items, speed = 2.4, className = '' }) {
  const container = useScrollContainer();
  const { scrollY } = useScroll({ container: container || undefined });
  const velocity = useVelocity(scrollY);
  const smooth = useSpring(velocity, { damping: 50, stiffness: 400 });
  const factor = useTransform(smooth, [-1500, 0, 1500], [-5, 0, 5], { clamp: false });
  const baseX = useMotionValue(0);
  const x = useTransform(baseX, (v) => `${wrap(-50, 0, v)}%`);
  const dir = useRef(1);
  const [ref, active] = useActive(0);
  const reduce = useReducedMotion();

  useAnimationFrame((_, delta) => {
    if (!active || reduce) return;
    const f = factor.get();
    if (f < -0.01) dir.current = -1;
    else if (f > 0.01) dir.current = 1;
    const move = dir.current * speed * (delta / 1000) * (1 + Math.abs(f));
    baseX.set(baseX.get() - move);
  });

  const row = [...items, ...items, ...items, ...items];
  return (
    <div ref={ref} className={`relative overflow-hidden border-y border-[var(--mk-line)] py-6 lg:py-9 ${className}`} aria-label={items.join(', ')}>
      <motion.div style={{ x }} className="flex w-max" aria-hidden="true">
        {row.map((w, i) => (
          <span key={i} className="flex items-center gap-[0.35em] pr-[0.35em] text-[clamp(3rem,9vw,7.5rem)] font-[450] leading-[1] tracking-[-0.055em]">
            <span className={i % 2 ? 'text-transparent [-webkit-text-stroke:1px_var(--text-tertiary)]' : 'text-[var(--text-primary)]'}>{w}</span>
            <span className="inline-block h-[0.14em] w-[0.14em] rotate-45 rounded-[0.03em] bg-[var(--mk-accent)]" />
          </span>
        ))}
      </motion.div>
    </div>
  );
}

export function SectionHead({ index, label, title, muted, lede, className = '' }) {
  return (
    <div className={className}>
      <Reveal>
        <Eyebrow index={index}>{label}</Eyebrow>
      </Reveal>
      <h2 className={`${headlineClass} mt-6 max-w-[20ch] text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.02]`}>
        <SplitText text={title} inView />{' '}
        {muted && (
          <span className="text-[var(--text-tertiary)]">
            <SplitText text={muted} inView delay={0.12} />
          </span>
        )}
      </h2>
      {lede && (
        <Reveal delay={0.15}>
          <div className="mt-6 max-w-[50ch] border-l-2 border-[var(--mk-accent)] pl-3 text-[14px] leading-[1.6] text-[var(--text-secondary)]">
            {lede}
          </div>
        </Reveal>
      )}
    </div>
  );
}

/* ── Timeline hooks for the product mocks ─────────────────────────── */

/** True while the element is on screen and the tab is visible. */
export function useActive(amount = 0.35) {
  const ref = useRef(null);
  const inView = useInView(ref, { amount });
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || !document.hidden);
  useEffect(() => {
    const onChange = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return [ref, inView && visible];
}

/**
 * Steps through `durations` (ms per phase) in a loop while `active`.
 * With reduced motion it parks on `restPhase`, a representative still frame.
 */
export function useSequence(durations, active, restPhase = durations.length - 1) {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(0);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (!active || reduce) return undefined;
    const id = setTimeout(() => {
      const next = (phase + 1) % durations.length;
      if (next === 0) setCycle((c) => c + 1);
      setPhase(next);
    }, durations[phase]);
    return () => clearTimeout(id);
    // durations is a static table per mock
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, active, reduce]);
  return reduce ? { phase: restPhase, cycle: 0, reduce: true } : { phase, cycle, reduce: false };
}

/** Human-paced typing. Empty until `typing`, complete once `done`. */
export function useTypewriter(text, typing, done, speed = 42) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!typing) {
      if (!done) setCount(0);
      return undefined;
    }
    if (count >= text.length) return undefined;
    const ch = text[count];
    const jitter = 0.55 + ((count * 37) % 11) / 11;
    const pause = ch === ' ' ? 1.25 : ',.?'.includes(ch) ? 2.4 : 1;
    const id = setTimeout(() => setCount((c) => c + 1), speed * jitter * pause);
    return () => clearTimeout(id);
  }, [typing, done, count, text, speed]);
  if (done) return text;
  return text.slice(0, count);
}

/* ── Mock primitives ──────────────────────────────────────────────── */

export function MockFrame({ label = 'tutorboard', meta, children, className = '', bodyClassName = '' }) {
  return (
    <div
      className={`mk-shadow relative overflow-hidden rounded-[18px] border border-[var(--mk-line-strong)] bg-[var(--mk-surface)] ${className}`}
    >
      <div className="relative flex h-9 items-center border-b border-[var(--mk-line)] px-3.5">
        <div className="flex gap-[5px]">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-[7px] w-[7px] rounded-full bg-[var(--mk-line-strong)]" />
          ))}
        </div>
        <div className="pointer-events-none absolute inset-x-16 truncate text-center font-mono text-[10px] tracking-[0.06em] text-[var(--text-tertiary)]">
          {label}
        </div>
        <div className="ml-auto font-mono text-[10px] text-[var(--text-tertiary)]">{meta}</div>
      </div>
      <div className={`@container relative ${bodyClassName}`}>{children}</div>
    </div>
  );
}

/** A small "live" status indicator. */
export function LiveDot({ on = true, label }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-1.5 w-1.5">
        {on && (
          <motion.span
            className="absolute inset-0 rounded-full bg-[var(--mk-accent)]"
            animate={{ scale: [1, 2.6], opacity: [0.5, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
        <span className={`relative h-1.5 w-1.5 rounded-full ${on ? 'bg-[var(--mk-accent)]' : 'bg-[var(--mk-line-strong)]'}`} />
      </span>
      {label}
    </span>
  );
}

/** A value that rolls vertically when it changes. */
export function Rolling({ value, className = '' }) {
  return (
    <span className={`relative inline-flex overflow-hidden align-bottom tabular-nums ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          className="inline-block"
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ duration: 0.45, ease: EASE }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function Chip({ children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-[var(--mk-line)] bg-[var(--mk-surface)] px-2.5 py-[3px] text-[11px] font-medium text-[var(--text-secondary)] ${className}`}
    >
      {children}
    </span>
  );
}

/** Untransformed box of `el` relative to `container` (which must be positioned). */
export function offsetIn(el, container) {
  let x = 0;
  let y = 0;
  let node = el;
  while (node && node !== container) {
    x += node.offsetLeft;
    y += node.offsetTop;
    node = node.offsetParent;
  }
  return node === container ? { x, y, w: el.offsetWidth, h: el.offsetHeight } : null;
}

/** Re-renders the caller whenever `ref`'s element is resized. */
export function useResizeTick(ref) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setTick((n) => n + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return tick;
}

const CURSOR_MOVE = { duration: 0.8, ease: [0.5, 0, 0.15, 1] };

/**
 * Scripted pointer that travels to real elements inside `container`.
 * Aim it with `target` (+ `anchor`, fractions of the target box), a pixel
 * `point`, or `at` (fractions of the container).
 */
export function Cursor({ container, target, anchor, point, at, pressed = false, visible = true, transition = CURSOR_MOVE }) {
  const [pos, setPos] = useState(null);
  useResizeTick(container);
  useLayoutEffect(() => {
    const c = container.current;
    if (!c) return;
    let next = null;
    if (point) next = point;
    else if (target?.current) {
      const r = offsetIn(target.current, c);
      const a = anchor || { x: 0.5, y: 0.5 };
      if (r) next = { x: r.x + r.w * a.x, y: r.y + r.h * a.y };
    } else if (at) next = { x: c.offsetWidth * at.x, y: c.offsetHeight * at.y };
    if (next && (!pos || Math.abs(next.x - pos.x) > 0.5 || Math.abs(next.y - pos.y) > 0.5)) setPos(next);
  });
  if (!pos) return null;
  return (
    <motion.div
      className="pointer-events-none absolute left-0 top-0 z-40"
      initial={false}
      animate={{ x: pos.x, y: pos.y, opacity: visible ? 1 : 0 }}
      transition={{ x: transition, y: transition, opacity: { duration: 0.35 } }}
    >
      <AnimatePresence>
        {pressed && (
          <motion.span
            key="ring"
            className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full border border-[var(--text-primary)]"
            initial={{ scale: 0.3, opacity: 0.6 }}
            animate={{ scale: 1.5, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: EASE }}
          />
        )}
      </AnimatePresence>
      <motion.svg
        width="17"
        height="17"
        viewBox="0 0 17 17"
        className="-ml-[3px] -mt-[2px] block drop-shadow-[0_1px_1.5px_rgba(0,0,0,0.28)]"
        animate={{ scale: pressed ? 0.84 : 1 }}
        transition={{ duration: 0.14 }}
        style={{ transformOrigin: '3px 2px' }}
      >
        <path
          d="M3 2 L3 14.2 L6.2 11.3 L8.4 15.9 L10.4 15 L8.3 10.5 L12.6 10.4 Z"
          fill="var(--text-primary)"
          stroke="var(--bg-primary)"
          strokeWidth="1.15"
          strokeLinejoin="round"
        />
      </motion.svg>
    </motion.div>
  );
}

/* ── Calls to action ──────────────────────────────────────────────── */

export function useStartLearning() {
  const navigate = useNavigate();
  const { isAuthenticated, loginGuest } = useAuth();
  return () => {
    if (!isAuthenticated) loginGuest();
    navigate('/session');
  };
}

/** Arrow that slides out and back in on hover. */
export function SlideArrow({ size = 14 }) {
  return (
    <span className="relative inline-flex h-[1em] w-[1em] items-center overflow-hidden">
      <ArrowRight
        size={size}
        strokeWidth={1.8}
        className="absolute transition-transform duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-[130%]"
      />
      <ArrowRight
        size={size}
        strokeWidth={1.8}
        className="absolute -translate-x-[130%] transition-transform duration-500 [transition-timing-function:cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0"
      />
    </span>
  );
}

export function PrimaryButton({ children, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        backgroundColor: 'var(--text-primary)',
        color: 'var(--bg-primary)',
      }}
      className={`group inline-flex h-11 cursor-pointer items-center gap-2.5 rounded-full pl-5 pr-4 text-[13.5px] font-medium tracking-[-0.01em] transition-[transform,opacity] duration-300 hover:opacity-90 active:scale-[0.97] ${className}`}
    >
      <span>{children}</span>
      <SlideArrow />
    </button>
  );
}

export function GhostLink({ to, children, className = '' }) {
  return (
    <Link
      to={to}
      className={`group inline-flex h-11 items-center gap-2 rounded-full border border-[var(--mk-line-strong)] px-5 text-[13.5px] tracking-[-0.01em] text-[var(--text-primary)] transition-colors duration-300 hover:bg-[var(--mk-ink-soft)] ${className}`}
    >
      {children}
    </Link>
  );
}

export function ClosingCTA({ title, muted, secondary }) {
  const start = useStartLearning();
  return (
    <Container className="pb-24 pt-8 lg:pb-36">
      <div className="grid gap-10 border-t border-[var(--mk-line)] pt-16 lg:grid-cols-12 lg:items-end lg:pt-24">
        <h2 className={`${headlineClass} text-[clamp(2.2rem,5.2vw,4.1rem)] leading-[1] lg:col-span-8`}>
          <SplitText text={title} inView />{' '}
          <span className="text-[var(--text-tertiary)]">
            <SplitText text={muted} inView delay={0.15} />
          </span>
        </h2>
        <Reveal delay={0.2} className="flex flex-wrap items-center gap-3 lg:col-span-4 lg:justify-end">
          <PrimaryButton onClick={start}>Start learning free</PrimaryButton>
          {secondary?.to && <GhostLink to={secondary.to}>{secondary.label}</GhostLink>}
          {secondary?.onClick && (
            <button
              type="button"
              onClick={secondary.onClick}
              className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-[var(--mk-line-strong)] px-5 text-[13.5px] tracking-[-0.01em] text-[var(--text-primary)] transition-colors duration-300 hover:bg-[var(--mk-ink-soft)]"
            >
              {secondary.label}
            </button>
          )}
        </Reveal>
      </div>
    </Container>
  );
}
