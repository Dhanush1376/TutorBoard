import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronFirst, ChevronLast, StepBack, StepForward, Play, Pause, Info, Sparkles, SendHorizontal, Loader2, AlertTriangle,
} from 'lucide-react';
import { describeStep, changedNames, timelineMarks, valueLabel, indexStep, resolve, MODE_LABEL } from '../traceModel';
import { explainStep } from '../runTrace';
import DataView from './DataView';
import { findShapes } from '../shapes';

/**
 * Plays a trace back one step at a time: controls and a timeline, what happened
 * in plain words, a picture of the data, the variables in every frame, the
 * output so far, and a tutor who can explain the step.
 */

const SPEEDS = [
  { label: '0.5×', ms: 1400 },
  { label: '1×', ms: 750 },
  { label: '2×', ms: 350 },
];

const frameLabel = (f) => (f.name === 'global' ? 'Global' : `${f.name}()`);

function Ctl({ label, onClick, disabled, children, primary }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`grid shrink-0 cursor-pointer place-items-center rounded-full transition-colors disabled:cursor-default disabled:opacity-35 ${
        primary
          ? 'h-9 w-9 bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90'
          : 'h-8 w-8 text-[var(--text-secondary)] hover:bg-[var(--st-fill-strong)] hover:text-[var(--text-primary)]'
      }`}
    >
      {children}
    </button>
  );
}

function Section({ title, right, children }) {
  return (
    <section className="border-b border-[var(--st-line)] px-4 py-3.5 last:border-b-0">
      <div className="mb-2.5 flex items-center gap-2">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{title}</h3>
        <div className="ml-auto">{right}</div>
      </div>
      {children}
    </section>
  );
}

/* ── Timeline ───────────────────────────────────────────────────────────── */

function Timeline({ trace, index, onSeek }) {
  const marks = useMemo(() => timelineMarks(trace), [trace]);
  const n = trace.steps.length;
  const ref = useRef(null);
  const seekAt = (clientX) => {
    const r = ref.current.getBoundingClientRect();
    onSeek(Math.round(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * (n - 1)));
  };
  const dragging = useRef(false);
  return (
    <div
      ref={ref}
      role="slider"
      aria-label="Steps"
      aria-valuemin={1}
      aria-valuemax={n}
      aria-valuenow={index + 1}
      tabIndex={0}
      onPointerDown={(e) => {
        dragging.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* synthetic event */
        }
        seekAt(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && seekAt(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      className="relative h-7 cursor-pointer touch-none select-none"
    >
      <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[var(--st-fill-strong)]" />
      <div className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[var(--mk-accent)]" style={{ width: n > 1 ? `${(index / (n - 1)) * 100}%` : '100%' }} />
      {n <= 400 &&
        marks.map((m, i) =>
          m && m !== 'return' ? (
            <span
              key={i}
              className={`pointer-events-none absolute top-[5px] h-[5px] w-[2px] -translate-x-1/2 rounded-full ${m === 'error' ? 'bg-red-500' : m === 'out' ? 'bg-emerald-500/70' : 'bg-[var(--text-tertiary)]/50'}`}
              style={{ left: n > 1 ? `${(i / (n - 1)) * 100}%` : '50%' }}
            />
          ) : null,
        )}
      <span
        className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--bg-primary)] bg-[var(--mk-accent)] shadow-[0_1px_4px_rgba(0,0,0,0.35)]"
        style={{ left: n > 1 ? `${(index / (n - 1)) * 100}%` : '50%' }}
      />
    </div>
  );
}

/* ── Variables and call stack ───────────────────────────────────────────── */

function Frames({ trace, index }) {
  const step = trace.steps[index];
  const changed = useMemo(() => changedNames(trace, index), [trace, index]);
  const frames = step.frames.slice().reverse();
  // An object reachable from two variables is written out once in the trace; show it in full
  // everywhere, and say which variable holds the same object.
  const { byId, firstHolder } = useMemo(() => {
    const ids = indexStep(step);
    const holder = new Map();
    for (const f of step.frames) for (const l of f.locals) if (l.value?.id != null && !holder.has(l.value.id)) holder.set(l.value.id, l.name);
    return { byId: ids, firstHolder: holder };
  }, [step]);
  return (
    <div className="flex flex-col gap-2">
      {frames.map((f, i) => {
        const locals = f.locals.filter((l) => l.value?.t !== 'fn' && !(l.value?.t === 'other' && /^(class|module) /.test(l.value.v)));
        return (
          <div key={f.id} className={`rounded-[12px] border ${i === 0 ? 'border-[var(--st-line-strong)] bg-[var(--st-fill)]' : 'border-[var(--st-line)]'}`}>
            <div className="flex items-center gap-2 px-3 pt-2 font-mono text-[11.5px]">
              <span className={i === 0 ? 'font-semibold text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}>{frameLabel(f)}</span>
              <span className="text-[var(--text-tertiary)]">line {f.line}</span>
              {i === 0 && <span className="ml-auto rounded-full bg-[var(--mk-accent-soft)] px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[var(--mk-accent)]">running</span>}
            </div>
            <div className="px-3 pb-2 pt-1">
              {locals.length === 0 ? (
                <div className="font-mono text-[11px] text-[var(--text-tertiary)]">no variables yet</div>
              ) : (
                <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-0.5 font-mono text-[12px] leading-[1.55]">
                  {locals.map((l) => {
                    const isNew = changed.has(`${f.id}:${l.name}`);
                    const shown = l.value?.t === 'ref' ? resolve(l.value, byId) : l.value;
                    const twin = l.value?.t === 'ref' ? firstHolder.get(l.value.id) : null;
                    return (
                      <React.Fragment key={l.name}>
                        <span className="text-[var(--text-secondary)]">{l.name}</span>
                        <span className={`break-words rounded-[4px] px-1 transition-colors ${isNew ? 'bg-[var(--mk-accent-soft)] text-[var(--text-primary)]' : 'text-[var(--text-primary)]'}`}>
                          {valueLabel(shown, trace.language)}
                          {twin && twin !== l.name && <span className="ml-1.5 text-[10.5px] text-[var(--text-tertiary)]">same object as {twin}</span>}
                        </span>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Output ─────────────────────────────────────────────────────────────── */

function Output({ trace, index }) {
  const step = trace.steps[index];
  const prevOut = index > 0 ? trace.steps[index - 1].out : 0;
  const atEnd = index === trace.steps.length - 1;
  // At the last step show everything printed (output after the last step included).
  const upto = atEnd ? trace.stdout.length : step.out;
  const old = trace.stdout.slice(0, Math.min(prevOut, upto));
  const fresh = trace.stdout.slice(Math.min(prevOut, upto), upto);
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [upto]);
  if (!upto) return <div className="font-mono text-[11.5px] text-[var(--text-tertiary)]">Nothing printed yet.</div>;
  return (
    <pre ref={ref} className="thin-scrollbar max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-[1.6] text-[var(--text-primary)]">
      {old}
      <span className="rounded-[3px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">{fresh}</span>
    </pre>
  );
}

/* ── The tutor ──────────────────────────────────────────────────────────── */

function Tutor({ trace, index, visualizationId, initialFollowUps }) {
  const [thread, setThread] = useState(() => (initialFollowUps || []).map((f) => ({ step: f.step, q: f.question, a: f.answer })));
  const [busy, setBusy] = useState(false);
  const [question, setQuestion] = useState('');
  const [problem, setProblem] = useState(null);
  const here = thread.filter((t) => t.step === index);

  const ask = async (q) => {
    if (busy) return;
    const step = trace.steps[index];
    const top = step.frames[step.frames.length - 1];
    const { details } = describeStep(trace, index);
    setBusy(true);
    setProblem(null);
    const res = await explainStep({
      language: trace.language,
      source: trace.source,
      visualizationId: visualizationId || undefined,
      question: q || undefined,
      history: here.slice(-3).map((t) => ({ q: t.q || 'Explain this step.', a: t.a })),
      step: {
        index,
        total: trace.steps.length,
        line: step.line,
        event: step.event,
        stack: step.frames.map(frameLabel),
        variables: top.locals.slice(0, 60).map((l) => `${l.name} = ${valueLabel(l.value, trace.language)}`.slice(0, 400)),
        changes: details.slice(0, 10).map((d) => d.slice(0, 400)),
        output: trace.stdout.slice(Math.max(0, step.out - 2000), step.out),
        error: index === trace.steps.length - 1 && trace.error ? trace.error.message.slice(0, 2000) : undefined,
        simulated: trace.mode === 'simulated',
      },
    });
    setBusy(false);
    if (res.error) setProblem(res.error);
    else setThread((t) => [...t, { step: index, q, a: res.answer }]);
    setQuestion('');
  };

  return (
    <div className="flex flex-col gap-2.5">
      {here.map((t, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-1.5">
          {t.q && <div className="self-end rounded-[12px] rounded-br-[4px] bg-[var(--st-fill-strong)] px-3 py-1.5 text-[12.5px] text-[var(--text-primary)]">{t.q}</div>}
          <div className="whitespace-pre-wrap text-[13px] leading-[1.6] text-[var(--text-primary)]">{t.a.replace(/`([^`]+)`/g, '$1')}</div>
        </motion.div>
      ))}
      {problem && <div className="text-[12px] text-red-500">{problem}</div>}
      {!here.length && (
        <button
          type="button"
          onClick={() => ask('')}
          disabled={busy}
          className="inline-flex h-8 w-fit cursor-pointer items-center gap-1.5 rounded-full border border-[var(--st-line-strong)] px-3 text-[12.5px] text-[var(--text-primary)] transition-colors hover:bg-[var(--st-fill)] disabled:opacity-60"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} className="text-[var(--mk-accent)]" />}
          Explain this step
        </button>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) ask(question.trim());
        }}
        className="flex h-9 items-center gap-1 rounded-full border border-[var(--st-line-strong)] bg-[var(--bg-primary)] pl-3.5 pr-1 focus-within:border-[var(--text-tertiary)]"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Ask about this step…"
          maxLength={1000}
          className="min-w-0 flex-1 bg-transparent text-[12.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
        />
        <button type="submit" aria-label="Ask" disabled={busy || !question.trim()} className="grid h-7 w-7 cursor-pointer place-items-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--st-fill-strong)] disabled:opacity-35">
          {busy && here.length ? <Loader2 size={13} className="animate-spin" /> : <SendHorizontal size={14} />}
        </button>
      </form>
    </div>
  );
}

/* ── Player ─────────────────────────────────────────────────────────────── */

export default function TracePlayer({ trace, index, onIndex, visualizationId, followUps, compact }) {
  const n = trace.steps.length;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showNotes, setShowNotes] = useState(false);
  const [tab, setTab] = useState('step');
  const go = useCallback((i) => onIndex(Math.max(0, Math.min(n - 1, i))), [n, onIndex]);

  useEffect(() => {
    if (!playing || index >= n - 1) return undefined;
    const t = setTimeout(() => {
      go(index + 1);
      if (index + 1 >= n - 1) setPlaying(false); // reached the end
    }, SPEEDS[speed].ms);
    return () => clearTimeout(t);
  }, [playing, index, n, speed, go]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.closest?.('.monaco-editor')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
      else if (e.key === 'Home') { e.preventDefault(); go(0); }
      else if (e.key === 'End') { e.preventDefault(); go(n - 1); }
      else if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index, n]);

  const { title, details } = useMemo(() => (n ? describeStep(trace, index) : { title: '', details: [] }), [trace, index, n]);
  const hasData = useMemo(() => n > 0 && findShapes(trace.steps[index], trace.steps[index - 1]).length > 0, [trace, index, n]);
  const isLast = index === n - 1;
  const step = trace.steps[index];

  const errorBox = trace.error && (isLast || !n) && (
    <div className={`flex gap-2 rounded-[12px] border px-3 py-2.5 text-[12.5px] leading-[1.5] ${trace.error.kind === 'limit' ? 'border-[var(--st-line-strong)] text-[var(--text-secondary)]' : 'border-red-500/30 bg-red-500/[0.06] text-red-600 dark:text-red-400'}`}>
      <AlertTriangle size={14} className="mt-[2px] shrink-0" />
      <div className="min-w-0">
        <div className="whitespace-pre-wrap break-words font-mono text-[12px]">{trace.error.message}</div>
        {trace.error.line ? <div className="mt-0.5 text-[11.5px] opacity-80">Line {trace.error.line}</div> : null}
      </div>
    </div>
  );

  const header = (
    <div className="flex items-center gap-2 px-4 pt-3">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${trace.mode === 'simulated' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${trace.mode === 'simulated' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
        {MODE_LABEL[trace.mode]}
      </span>
      {trace.notes?.length > 0 && (
        <div className="relative ml-auto">
          <button type="button" onClick={() => setShowNotes((v) => !v)} aria-label="About this walkthrough" className="grid h-7 w-7 cursor-pointer place-items-center rounded-full text-[var(--text-tertiary)] hover:bg-[var(--st-fill-strong)] hover:text-[var(--text-primary)]">
            <Info size={14} />
          </button>
          <AnimatePresence>
            {showNotes && (
              <motion.ul
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute right-0 top-8 z-20 w-64 list-disc rounded-[14px] border border-[var(--st-line-strong)] bg-[var(--bg-primary)] py-2.5 pl-7 pr-3 text-[12px] leading-[1.5] text-[var(--text-secondary)] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.45)]"
              >
                {trace.notes.map((t) => <li key={t}>{t}</li>)}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );

  if (!n) {
    return (
      <div className="flex h-full flex-col">
        {header}
        <div className="flex flex-col gap-3 p-4">
          {errorBox}
          {trace.stdout && (
            <Section title="Output">
              <pre className="whitespace-pre-wrap font-mono text-[12px] text-[var(--text-primary)]">{trace.stdout}</pre>
            </Section>
          )}
        </div>
      </div>
    );
  }

  const controls = (
    <div className="shrink-0 border-t border-[var(--st-line)] px-4 pb-3 pt-2">
      <Timeline trace={trace} index={index} onSeek={go} />
      <div className="mt-1 flex items-center gap-1">
        <Ctl label="First step" onClick={() => go(0)} disabled={index === 0}><ChevronFirst size={16} /></Ctl>
        <Ctl label="Previous step (←)" onClick={() => go(index - 1)} disabled={index === 0}><StepBack size={15} /></Ctl>
        <Ctl label={playing ? 'Pause (space)' : 'Play (space)'} onClick={() => (isLast ? (go(0), setPlaying(true)) : setPlaying((p) => !p))} primary>
          {playing ? <Pause size={14} fill="currentColor" /> : <Play size={13} fill="currentColor" className="translate-x-[1px]" />}
        </Ctl>
        <Ctl label="Next step (→)" onClick={() => go(index + 1)} disabled={isLast}><StepForward size={15} /></Ctl>
        <Ctl label="Last step" onClick={() => go(n - 1)} disabled={isLast}><ChevronLast size={16} /></Ctl>
        <button
          type="button"
          onClick={() => setSpeed((s) => (s + 1) % SPEEDS.length)}
          title="Playback speed"
          className="ml-1 h-7 cursor-pointer rounded-full px-2 font-mono text-[11px] text-[var(--text-secondary)] hover:bg-[var(--st-fill-strong)] hover:text-[var(--text-primary)]"
        >
          {SPEEDS[speed].label}
        </button>
        <span className="ml-auto whitespace-nowrap font-mono text-[11px] text-[var(--text-tertiary)]">
          {index + 1} / {n}
          {trace.truncated ? '+' : ''}
        </span>
      </div>
    </div>
  );

  const narration = (
    <div>
      {/* Keyed so each step fades in; no exit animation to wait on. */}
      <motion.div key={index} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }}>
          <div className={`text-[15px] font-medium tracking-[-0.01em] ${step.event === 'exception' ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>{title}</div>
          {step.event !== 'return' || step.frames.length > 1 ? (
            <div className="mt-0.5 font-mono text-[11px] text-[var(--text-tertiary)]">line {step.line}</div>
          ) : null}
          {details.length > 0 && (
            <ul className="mt-2 flex flex-col gap-0.5 font-mono text-[12px] leading-[1.55] text-[var(--text-secondary)]">
              {details.map((d) => <li key={d} className="break-words">{d}</li>)}
            </ul>
          )}
      </motion.div>
      {errorBox && <div className="mt-3">{errorBox}</div>}
    </div>
  );

  const stepPanel = (
    <>
      <Section title={`Step ${index + 1}`}>{narration}</Section>
      {hasData && (
        <Section title="Data">
          <DataView trace={trace} index={index} />
        </Section>
      )}
      <Section title="Ask the tutor">
        <Tutor key={visualizationId || trace.source} trace={trace} index={index} visualizationId={visualizationId} initialFollowUps={followUps} />
      </Section>
    </>
  );
  const varsPanel = (
    <Section title="Variables · call stack">
      <Frames trace={trace} index={index} />
    </Section>
  );
  const outPanel = (
    <Section title="Output">
      <Output trace={trace} index={index} />
    </Section>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      {compact && (
        <div role="tablist" className="mx-4 mt-2.5 flex h-8 shrink-0 items-center rounded-full border border-[var(--st-line)] bg-[var(--st-fill-strong)] p-0.5">
          {[['step', 'Step'], ['vars', 'Variables'], ['out', 'Output']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`h-7 flex-1 cursor-pointer rounded-full text-[12px] transition-colors ${tab === id ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.2)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
        {compact ? (tab === 'step' ? stepPanel : tab === 'vars' ? varsPanel : outPanel) : (
          <>
            {stepPanel}
            {varsPanel}
            {outPanel}
          </>
        )}
      </div>
      {controls}
    </div>
  );
}
