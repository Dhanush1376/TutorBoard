import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import {
  ChevronFirst, ChevronLast, StepBack, StepForward, Play, Pause, RotateCcw, Info, Sparkles, SendHorizontal, Loader2, AlertTriangle, CornerDownRight, History,
} from 'lucide-react';
import { describeStep, changedNames, timelineMarks, valueLabel, indexStep, resolve, MODE_LABEL } from '../traceModel';
import { variableHistory, nextHint } from '../analysis';
import { explainStep } from '../runTrace';
import DataView from './DataView';
import CallTree from './CallTree';
import MemoryView from './MemoryView';
import EventLoopView from './EventLoopView';
import { findShapes } from '../shapes';

/**
 * Plays a trace back one step at a time. Always in view: what this step did,
 * what happens next, and the controls. In tabs: a picture of the data, the
 * variables (each with its history), the calls so far, memory and references,
 * JavaScript's event loop, the output, and a tutor who explains the step from
 * the recorded facts.
 */

const SPEEDS = [
  { label: '0.5×', ms: 1400 },
  { label: '1×', ms: 750 },
  { label: '2×', ms: 350 },
  { label: '4×', ms: 160 },
];

const LEVELS = [
  ['simple', 'Simple'],
  ['standard', 'Normal'],
  ['deep', 'Deep'],
];
const LEVEL_KEY = 'tb-explain-level';
const readLevel = () => {
  try {
    const v = localStorage.getItem(LEVEL_KEY);
    return LEVELS.some(([id]) => id === v) ? v : 'standard';
  } catch {
    return 'standard';
  }
};

const frameLabel = (f) => (f.name === 'global' || f.name === '<module>' ? 'Global' : `${f.name}()`);

function Ctl({ label, onClick, disabled, children, primary }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`grid shrink-0 cursor-pointer place-items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--mk-accent)] disabled:cursor-default disabled:opacity-35 ${
        primary
          ? 'h-9 w-9 bg-[var(--text-primary)] text-[var(--bg-primary)] hover:opacity-90'
          : 'h-8 w-8 text-[var(--text-secondary)] hover:bg-[var(--st-fill-strong)] hover:text-[var(--text-primary)]'
      }`}
    >
      {children}
    </button>
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
  const onKeyDown = (e) => {
    const big = Math.max(1, Math.round(n / 10));
    const go = { ArrowRight: index + 1, ArrowUp: index + 1, ArrowLeft: index - 1, ArrowDown: index - 1, PageUp: index + big, PageDown: index - big, Home: 0, End: n - 1 }[e.key];
    if (go === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    onSeek(go);
  };
  return (
    <div
      ref={ref}
      role="slider"
      aria-label="Steps"
      aria-valuemin={1}
      aria-valuemax={n}
      aria-valuenow={index + 1}
      aria-valuetext={`Step ${index + 1} of ${n}, line ${trace.steps[index]?.line}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
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
      className="relative h-7 cursor-pointer touch-none select-none rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mk-accent)]"
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

/* ── Variables, call stack, and one variable's history ──────────────────── */

function VariableHistory({ trace, frameId, name, index, onSeek }) {
  const history = useMemo(() => variableHistory(trace, frameId, name), [trace, frameId, name]);
  return (
    <div className="col-span-2 mb-1 mt-0.5 rounded-[8px] border border-[var(--st-line)] bg-[var(--bg-primary)] px-2 py-1.5">
      <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
        <History size={11} /> {name} over time · {history.length} value{history.length === 1 ? '' : 's'}
      </div>
      <ol className="flex flex-col">
        {history.map((h) => (
          <li key={h.step}>
            <button
              type="button"
              onClick={() => onSeek(h.step)}
              aria-label={`Step ${h.step + 1}: ${valueLabel(h.value, trace.language)}, line ${trace.steps[h.step].line}`}
              aria-current={h.step === index ? 'step' : undefined}
              className={`flex w-full items-baseline gap-2 rounded-[6px] px-1 text-left font-mono text-[11.5px] hover:bg-[var(--st-fill-strong)] ${h.step === index ? 'text-[var(--mk-accent)]' : h.step > index ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-primary)]'}`}
            >
              <span className="w-14 shrink-0 text-[var(--text-tertiary)]">step {h.step + 1}</span>
              <span className="min-w-0 break-words">{valueLabel(h.value, trace.language)}</span>
              <span className="ml-auto shrink-0 text-[10px] text-[var(--text-tertiary)]">line {trace.steps[h.step].line}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Frames({ trace, index, onSeek }) {
  const step = trace.steps[index];
  const changed = useMemo(() => changedNames(trace, index), [trace, index]);
  const [open, setOpen] = useState(null); // `${frameId}:${name}`
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
      <p className="font-mono text-[10.5px] text-[var(--text-tertiary)]">Click a variable to see every value it held.</p>
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
                    const key = `${f.id}:${l.name}`;
                    const isNew = changed.has(key);
                    const shown = l.value?.t === 'ref' ? resolve(l.value, byId) : l.value;
                    const twin = l.value?.t === 'ref' ? firstHolder.get(l.value.id) : null;
                    return (
                      <React.Fragment key={l.name}>
                        <button
                          type="button"
                          onClick={() => setOpen((o) => (o === key ? null : key))}
                          aria-expanded={open === key}
                          className="cursor-pointer rounded-[4px] text-left text-[var(--text-secondary)] underline decoration-dotted decoration-[var(--text-tertiary)] underline-offset-[3px] hover:text-[var(--text-primary)]"
                        >
                          {l.name}
                        </button>
                        <span className={`break-words rounded-[4px] px-1 transition-colors ${isNew ? 'bg-[var(--mk-accent-soft)] text-[var(--text-primary)]' : 'text-[var(--text-primary)]'}`}>
                          {valueLabel(shown, trace.language)}
                          {twin && twin !== l.name && <span className="ml-1.5 text-[10.5px] text-[var(--text-tertiary)]">same object as {twin}</span>}
                        </span>
                        {open === key && <VariableHistory trace={trace} frameId={f.id} name={l.name} index={index} onSeek={onSeek} />}
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
    <pre ref={ref} className="thin-scrollbar max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-[1.6] text-[var(--text-primary)]">
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
  const [level, setLevel] = useState(readLevel);
  const here = thread.filter((t) => t.step === index);

  const chooseLevel = (v) => {
    setLevel(v);
    try {
      localStorage.setItem(LEVEL_KEY, v);
    } catch {
      /* storage blocked: kept for this walkthrough only */
    }
  };

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
      level,
      history: here.slice(-3).map((t) => ({ q: t.q || 'Explain this step.', a: t.a })),
      step: {
        index,
        total: trace.steps.length,
        line: step.line,
        event: step.event,
        stack: step.frames.map(frameLabel),
        variables: top.locals.slice(0, 60).map((l) => `${l.name} = ${valueLabel(l.value, trace.language)}`.slice(0, 400)),
        changes: [...details, nextHint(trace, index)?.text].filter(Boolean).slice(0, 10).map((d) => d.slice(0, 400)),
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
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Depth</span>
        <div role="radiogroup" aria-label="How deep the explanation goes" className="flex h-7 items-center rounded-full border border-[var(--st-line)] bg-[var(--st-fill-strong)] p-0.5">
          {LEVELS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={level === id}
              onClick={() => chooseLevel(id)}
              className={`h-6 cursor-pointer rounded-full px-2.5 text-[11.5px] transition-colors ${level === id ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.2)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
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
          aria-label="Ask about this step"
          maxLength={1000}
          className="min-w-0 flex-1 bg-transparent text-[12.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
        />
        <button type="submit" aria-label="Ask" disabled={busy || !question.trim()} className="grid h-7 w-7 cursor-pointer place-items-center rounded-full text-[var(--text-secondary)] hover:bg-[var(--st-fill-strong)] disabled:opacity-35">
          {busy && here.length ? <Loader2 size={13} className="animate-spin" /> : <SendHorizontal size={14} />}
        </button>
      </form>
      <p className="text-[11px] leading-[1.45] text-[var(--text-tertiary)]">The tutor is given this step's recorded values and is told not to invent any.</p>
    </div>
  );
}

/* ── Player ─────────────────────────────────────────────────────────────── */

export default function TracePlayer({ trace, index, onIndex, visualizationId, followUps }) {
  const n = trace.steps.length;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showNotes, setShowNotes] = useState(false);
  const go = useCallback((i) => onIndex(Math.max(0, Math.min(n - 1, i))), [n, onIndex]);

  const hasLoop = useMemo(() => trace.steps.some((s) => s.loop), [trace]);
  const hasPictures = useMemo(() => trace.steps.some((s, i) => findShapes(s, trace.steps[i - 1]).length > 0), [trace]);
  const tabs = useMemo(
    () => [
      ['data', 'Data'],
      ['vars', 'Variables'],
      ['calls', 'Calls'],
      ['memory', 'Memory'],
      ...(hasLoop ? [['loop', 'Event loop']] : []),
      ['out', 'Output'],
      ['ask', 'Ask'],
    ],
    [hasLoop],
  );
  const [chosenTab, setTab] = useState(() => (hasLoop ? 'loop' : hasPictures ? 'data' : 'vars'));
  const tab = tabs.some(([id]) => id === chosenTab) ? chosenTab : 'vars';
  const tabRefs = useRef({});

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
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.closest?.('.monaco-editor') || e.target?.getAttribute?.('role') === 'slider') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
      else if (e.key === 'Home') { e.preventDefault(); go(0); }
      else if (e.key === 'End') { e.preventDefault(); go(n - 1); }
      else if (e.key === ' ' && e.target?.tagName !== 'BUTTON') { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index, n]);

  const { title, details } = useMemo(() => (n ? describeStep(trace, index) : { title: '', details: [] }), [trace, index, n]);
  const hint = useMemo(() => (n ? nextHint(trace, index) : null), [trace, index, n]);
  const isLast = index === n - 1;
  const step = trace.steps[index];

  const errorBox = trace.error && (isLast || !n) && (
    <div role="alert" className={`flex gap-2 rounded-[12px] border px-3 py-2.5 text-[12.5px] leading-[1.5] ${trace.error.kind === 'limit' ? 'border-[var(--st-line-strong)] text-[var(--text-secondary)]' : 'border-red-500/30 bg-red-500/[0.06] text-red-600 dark:text-red-400'}`}>
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
          <button type="button" onClick={() => setShowNotes((v) => !v)} aria-label="About this walkthrough" aria-expanded={showNotes} className="grid h-7 w-7 cursor-pointer place-items-center rounded-full text-[var(--text-tertiary)] hover:bg-[var(--st-fill-strong)] hover:text-[var(--text-primary)]">
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
      <div className="tb-walkthrough flex h-full flex-col">
        {header}
        <div className="flex flex-col gap-3 p-4">
          {errorBox}
          {trace.stdout && (
            <div>
              <h3 className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--text-tertiary)]">Output</h3>
              <pre className="whitespace-pre-wrap font-mono text-[12px] text-[var(--text-primary)]">{trace.stdout}</pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  const onTabKey = (e) => {
    const ids = tabs.map(([id]) => id);
    const at = ids.indexOf(tab);
    const nextId = { ArrowRight: ids[(at + 1) % ids.length], ArrowLeft: ids[(at - 1 + ids.length) % ids.length], Home: ids[0], End: ids[ids.length - 1] }[e.key];
    if (!nextId) return;
    e.preventDefault();
    e.stopPropagation();
    setTab(nextId);
    tabRefs.current[nextId]?.focus();
  };

  const panel = {
    data: findShapes(step, trace.steps[index - 1]).length ? (
      <DataView trace={trace} index={index} />
    ) : (
      <p className="font-mono text-[11.5px] text-[var(--text-tertiary)]">No arrays, lists, trees or maps to draw at this step — see Variables or Memory.</p>
    ),
    vars: <Frames trace={trace} index={index} onSeek={go} />,
    calls: <CallTree trace={trace} index={index} onSeek={go} />,
    memory: <MemoryView trace={trace} index={index} />,
    loop: <EventLoopView trace={trace} index={index} />,
    out: <Output trace={trace} index={index} />,
    ask: <Tutor key={visualizationId || trace.source} trace={trace} index={index} visualizationId={visualizationId} initialFollowUps={followUps} />,
  }[tab];

  return (
    <MotionConfig reducedMotion="user">
      <div className="tb-walkthrough flex h-full min-h-0 flex-col">
        {header}
        {/* What this step did, and what comes next: always in view. */}
        <section aria-live="polite" aria-label={`Step ${index + 1}`} className="shrink-0 border-b border-[var(--st-line)] px-4 pb-3 pt-2.5">
          <motion.div key={index} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }}>
            <div className="flex items-baseline gap-2">
              <div className={`min-w-0 text-[15px] font-medium tracking-[-0.01em] ${step.event === 'exception' ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>{title}</div>
              <span className="ml-auto shrink-0 font-mono text-[11px] text-[var(--text-tertiary)]">line {step.line}</span>
            </div>
            {details.length > 0 && (
              <ul className="mt-1.5 flex flex-col gap-0.5 font-mono text-[12px] leading-[1.55] text-[var(--text-secondary)]">
                {details.map((d) => <li key={d} className="break-words">{d}</li>)}
              </ul>
            )}
            {hint && (
              <div className={`mt-1.5 flex items-start gap-1.5 text-[12.5px] leading-[1.5] ${hint.branch === 'in' ? 'text-emerald-700 dark:text-emerald-400' : hint.branch === 'out' ? 'text-amber-700 dark:text-amber-400' : 'text-[var(--text-tertiary)]'}`}>
                <CornerDownRight size={13} className="mt-[3px] shrink-0" aria-hidden="true" />
                <span>{hint.text}</span>
              </div>
            )}
          </motion.div>
          {errorBox && <div className="mt-3">{errorBox}</div>}
        </section>

        <div role="tablist" aria-label="Walkthrough views" onKeyDown={onTabKey} className="thin-scrollbar flex shrink-0 items-center gap-0.5 overflow-x-auto border-b border-[var(--st-line)] px-3 py-1.5">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              ref={(el) => (tabRefs.current[id] = el)}
              type="button"
              role="tab"
              id={`tb-tab-${id}`}
              aria-selected={tab === id}
              aria-controls="tb-tabpanel"
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              className={`h-7 shrink-0 cursor-pointer rounded-full px-2.5 text-[12px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mk-accent)] ${tab === id ? 'bg-[var(--st-fill-strong)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div id="tb-tabpanel" role="tabpanel" aria-labelledby={`tb-tab-${tab}`} className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
          {panel}
        </div>

        <div className="shrink-0 border-t border-[var(--st-line)] px-4 pb-3 pt-2">
          <Timeline trace={trace} index={index} onSeek={go} />
          <div className="mt-1 flex items-center gap-1">
            <Ctl label="First step (reset)" onClick={() => { setPlaying(false); go(0); }} disabled={index === 0}><ChevronFirst size={16} /></Ctl>
            <Ctl label="Previous step (←)" onClick={() => go(index - 1)} disabled={index === 0}><StepBack size={15} /></Ctl>
            <Ctl label={isLast ? 'Replay from the start' : playing ? 'Pause (space)' : 'Play (space)'} onClick={() => (isLast ? (go(0), setPlaying(true)) : setPlaying((p) => !p))} primary>
              {isLast ? <RotateCcw size={14} /> : playing ? <Pause size={14} fill="currentColor" /> : <Play size={13} fill="currentColor" className="translate-x-[1px]" />}
            </Ctl>
            <Ctl label="Next step (→)" onClick={() => go(index + 1)} disabled={isLast}><StepForward size={15} /></Ctl>
            <Ctl label="Last step" onClick={() => go(n - 1)} disabled={isLast}><ChevronLast size={16} /></Ctl>
            <button
              type="button"
              onClick={() => setSpeed((s) => (s + 1) % SPEEDS.length)}
              title="Playback speed"
              aria-label={`Playback speed ${SPEEDS[speed].label}`}
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
      </div>
    </MotionConfig>
  );
}
