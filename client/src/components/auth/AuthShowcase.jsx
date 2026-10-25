import React, { Suspense, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ErrorBoundary } from 'react-error-boundary';
import { Play, Volume2, VolumeX, X } from 'lucide-react';
import { AUTH_SUBJECTS } from './authSequence';

/*
 * The right-hand panel of the sign-in page: the landing page's galaxy opens and
 * the particles become twelve subjects in turn, on a loop (AuthMorph). The
 * caption in the bottom-left corner names each one as it forms; the promo film
 * is one click away in the other corner.
 */

const AuthMorph = React.lazy(() => import('./AuthMorph'));

const SUBJECTS = AUTH_SUBJECTS.map((s) => s.name);
const EASE = [0.22, 1, 0.36, 1];

function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const mo = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);
  return dark;
}

export default function AuthShowcase() {
  const reduce = useReducedMotion();
  const dark = useIsDark();
  // -1 while the galaxy is showing, otherwise the subject the particles have become.
  const [subject, setSubject] = useState(-1);
  const [film, setFilm] = useState(false);
  const [muted, setMuted] = useState(true);
  const video = useRef(null);

  // With reduced motion the particles rest as the galaxy and only the words change.
  useEffect(() => {
    if (!reduce) return undefined;
    const id = setInterval(() => setSubject((s) => (s + 1) % SUBJECTS.length), 3000);
    return () => clearInterval(id);
  }, [reduce]);

  useEffect(() => {
    if (film && video.current) video.current.play().catch(() => {});
  }, [film, dark]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[var(--bg-primary)]">
      <div className="mk-dots hidden dark:block absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_70%)]" />
      {!film && (
        <div className="absolute inset-0">
          <ErrorBoundary fallback={null}>
            <Suspense fallback={null}>
              <AuthMorph active={!film} reduce={!!reduce} onSubject={reduce ? undefined : setSubject} />
            </Suspense>
          </ErrorBoundary>
        </div>
      )}

      <AnimatePresence>
        {film && (
          <motion.div
            key="film"
            className="absolute inset-0 z-10 bg-[var(--bg-primary)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            <video
              ref={video}
              key={dark ? 'dark' : 'light'}
              src={dark ? '/tutorboard-promo.mp4' : '/tutorboard-promo-light.mp4'}
              autoPlay
              loop
              muted={muted}
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute right-6 top-6 flex gap-2">
              <button
                type="button"
                onClick={() => setMuted((m) => !m)}
                aria-label={muted ? 'Unmute film' : 'Mute film'}
                className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-[var(--mk-line-strong)] bg-[rgba(var(--bg-primary-rgb),0.6)] text-[var(--text-primary)] backdrop-blur-md"
              >
                {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
              <button
                type="button"
                onClick={() => setFilm(false)}
                aria-label="Close film"
                className="grid h-10 w-10 cursor-pointer place-items-center rounded-full border border-[var(--mk-line-strong)] bg-[rgba(var(--bg-primary-rgb),0.6)] text-[var(--text-primary)] backdrop-blur-md"
              >
                <X size={15} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!film && (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_0%_100%,rgba(var(--bg-primary-rgb),0.92),transparent_72%)]" />
      )}

      {!film && (
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-6 px-10 pb-10 xl:px-12 xl:pb-12">
          {/* Caption: bottom-left, naming each subject as the particles form it. */}
          <div className="min-w-0">
            <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums text-[var(--text-tertiary)]">
              <span>{subject < 0 ? 'One canvas' : `${String(subject + 1).padStart(2, '0')} / ${SUBJECTS.length}`}</span>
              <span className="flex gap-[3px]" aria-hidden="true">
                {SUBJECTS.map((name, i) => (
                  <span
                    key={name}
                    className={`h-[3px] rounded-full transition-all duration-500 ${i === subject ? 'w-5 bg-[var(--mk-accent)]' : i < subject ? 'w-[6px] bg-[var(--text-tertiary)]/70' : 'w-[6px] bg-[var(--text-tertiary)]/25'}`}
                  />
                ))}
              </span>
            </div>
            <div className="mt-3 text-[clamp(2rem,3.4vw,3.2rem)] font-[450] leading-[1.02] tracking-[-0.045em] text-[var(--text-primary)]">
              Every subject,
              <span className="relative mt-1 block h-[1.1em] overflow-hidden text-[var(--text-tertiary)]" aria-live="polite">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={subject}
                    className="block whitespace-nowrap"
                    initial={{ y: '100%', opacity: 0, filter: 'blur(6px)' }}
                    animate={{ y: '0%', opacity: 1, filter: 'blur(0px)' }}
                    exit={{ y: '-100%', opacity: 0, filter: 'blur(6px)' }}
                    transition={{ duration: 0.6, ease: EASE }}
                  >
                    {subject < 0 ? 'one canvas.' : `${SUBJECTS[subject].toLowerCase()} included.`}
                  </motion.span>
                </AnimatePresence>
              </span>
            </div>
            {/* Explanatory concept line: immediately tells the viewer what the visual is */}
            <div className="mt-2.5 h-[1.4em] overflow-hidden text-[13px] text-[var(--text-secondary)]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={subject}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 0.9, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.4 }}
                  className="truncate font-sans font-normal text-[var(--text-secondary)]"
                >
                  {subject < 0
                    ? 'Interactive visual learning on a live canvas.'
                    : AUTH_SUBJECTS[subject]?.concept || ''}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setFilm(true)}
            className="group inline-flex shrink-0 cursor-pointer items-center gap-2.5 rounded-full border border-[var(--mk-line-strong)] bg-[rgba(var(--bg-primary-rgb),0.6)] py-2 pl-2 pr-4 text-[13px] text-[var(--text-primary)] backdrop-blur-md transition-colors hover:bg-[var(--mk-ink-soft)]"
          >
            <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--text-primary)] text-[var(--bg-primary)] transition-transform group-hover:scale-105">
              <Play size={12} className="ml-0.5" fill="currentColor" />
            </span>
            Watch the 60-second film
          </button>
        </div>
      )}
    </div>
  );
}
