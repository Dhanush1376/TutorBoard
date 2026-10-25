import React from 'react';

/**
 * JavaScript's event loop at this step, as the run recorded it
 * (adapters/jsRecorder.js → runInstrumented): what is running, the call stack,
 * the queues, and the async functions paused at an await. Nothing here is
 * inferred; promise callbacks are shown from when they are registered to when
 * they run, because JavaScript doesn't reveal the moment one is queued.
 */

const PHASE = {
  script: { label: 'The main script', hint: 'Runs first, top to bottom. Nothing queued can run until it finishes.' },
  micro: { label: 'A microtask', hint: 'Microtasks (promise callbacks, await, queueMicrotask) all run before the next timer.' },
  macro: { label: 'A task from the timer queue', hint: 'The event loop takes one task, runs it to the end, then empties the microtasks again.' },
  idle: { label: 'Nothing — the stack is empty', hint: 'The event loop picks the next microtask, or the next timer when there are none.' },
};

function Queue({ title, items, empty, render }) {
  return (
    <div className="rounded-[10px] border border-[var(--st-line)] px-2.5 py-1.5">
      <div className="mb-1 flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
        <span>{title}</span>
        <span>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className="font-mono text-[11px] text-[var(--text-tertiary)]">{empty}</div>
      ) : (
        <ol className="flex flex-col gap-0.5 font-mono text-[11.5px] text-[var(--text-primary)]">
          {items.map((x, i) => (
            <li key={i} className="flex items-baseline gap-2">
              <span className="text-[var(--text-tertiary)]">{i + 1}.</span>
              <span className="min-w-0 break-words">{render ? render(x) : x}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default function EventLoopView({ trace, index }) {
  const step = trace.steps[index];
  const loop = step?.loop;
  if (!loop) return <p className="font-mono text-[11.5px] text-[var(--text-tertiary)]">No event-loop activity was recorded at this step.</p>;
  const phase = PHASE[loop.phase] || PHASE.idle;
  const stack = step.frames.slice().reverse();
  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-[10px] border border-[var(--st-line-strong)] bg-[var(--st-fill)] px-2.5 py-2">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-[var(--text-primary)]">Running: {phase.label}</span>
          <span className="ml-auto font-mono text-[11px] text-[var(--text-tertiary)]">clock {loop.now} ms</span>
        </div>
        {loop.task && loop.phase !== 'script' && <div className="font-mono text-[11.5px] text-[var(--mk-accent)]">{loop.task}</div>}
        <div className="mt-0.5 text-[11.5px] leading-[1.45] text-[var(--text-tertiary)]">{phase.hint}</div>
      </div>
      <Queue title="Call stack (top first)" items={stack} empty="empty" render={(f) => (f.name === 'global' ? 'program' : `${f.name}()`)} />
      <Queue title="Microtask queue" items={loop.micro} empty="empty" />
      <Queue title="Promise callbacks waiting" items={loop.waiting} empty="none registered" />
      <Queue title="Timer queue (macrotasks)" items={loop.timers} empty="empty" render={(t) => `${t.label} · at ${t.due} ms`} />
      <Queue title="Paused at await" items={loop.awaiting} empty="none" render={(a) => `${a.name}() · line ${a.line}`} />
      <p className="text-[11px] leading-[1.5] text-[var(--text-tertiary)]">
        Recorded from the real run. Timers run in the order the event loop runs them on a simulated clock (a delay doesn't make you wait).
        Promise callbacks appear when they're registered and leave when they run — JavaScript doesn't reveal the moment one is queued.
      </p>
    </div>
  );
}
