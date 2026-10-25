import React, { useMemo } from 'react';
import { buildCallTree, stackIds } from '../analysis';
import { valueLabel } from '../traceModel';

/**
 * Every call made so far, nested under the call that made it — recursion reads as
 * a tree: arguments in, value out, which calls are still waiting on the stack and
 * which one is running. Calls that haven't happened yet at this step are not
 * shown. Click a call to go to the step where it started.
 */

const PROGRAM_NAMES = new Set(['global', '<module>']);

function CallRow({ node, index, live, running, lang, onSeek }) {
  if (node.callStep > index) return null;
  const onStack = live.has(node.id);
  // off the stack now but seen again later: a JavaScript function paused at an await
  const paused = !onStack && node.endStep > index;
  const done = !onStack && !paused;
  const isRunning = node.id === running;
  const label = PROGRAM_NAMES.has(node.name) ? 'program' : `${node.name}(${node.args.map((a) => valueLabel(a.value, lang)).join(', ')})`;
  const returned = done && node.ret !== undefined && !PROGRAM_NAMES.has(node.name);
  const state = isRunning ? 'running' : onStack ? 'waiting' : paused ? 'paused' : node.threw ? 'error' : 'done';
  const shown = node.children.filter((c) => c.callStep <= index);
  return (
    <li>
      <button
        type="button"
        onClick={() => onSeek(node.callStep)}
        title={`Go to step ${node.callStep + 1}, where this call starts`}
        className={`group flex w-full min-w-0 items-center gap-2 rounded-[8px] px-2 py-1 text-left font-mono text-[12px] transition-colors hover:bg-[var(--st-fill-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--mk-accent)] ${
          isRunning ? 'bg-[var(--mk-accent-soft)] text-[var(--text-primary)]' : live.has(node.id) ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
        }`}
      >
        <span className="min-w-0 truncate">{label}</span>
        {returned && <span className="shrink-0 text-emerald-600 dark:text-emerald-400">→ {valueLabel(node.ret, lang)}</span>}
        {state === 'error' && <span className="shrink-0 text-red-500">✕ {node.threw}</span>}
        {state === 'running' && <span className="ml-auto shrink-0 rounded-full bg-[var(--mk-accent)] px-1.5 text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[var(--bg-primary)]">running</span>}
        {state === 'waiting' && <span className="ml-auto shrink-0 text-[10px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">waiting</span>}
        {state === 'paused' && <span className="ml-auto shrink-0 text-[10px] uppercase tracking-[0.08em] text-amber-600 dark:text-amber-400">paused · await</span>}
      </button>
      {shown.length > 0 && (
        <ul className="ml-3 border-l border-[var(--st-line-strong)] pl-2">
          {shown.map((c) => (
            <CallRow key={c.id} node={c} index={index} live={live} running={running} lang={lang} onSeek={onSeek} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function CallTree({ trace, index, onSeek }) {
  const { root, nodes, truncated } = useMemo(() => buildCallTree(trace), [trace]);
  const ids = stackIds(trace.steps[index]);
  const live = new Set(ids);
  const running = ids[ids.length - 1];
  if (!root) return <p className="font-mono text-[11.5px] text-[var(--text-tertiary)]">No calls recorded.</p>;
  const calls = [...nodes.values()].filter((n) => n.parentId !== null && n.callStep <= index).length;
  const deepest = Math.max(0, ...[...nodes.values()].filter((n) => n.callStep <= index).map((n) => n.depth));
  return (
    <div>
      <p className="mb-2 font-mono text-[11px] text-[var(--text-tertiary)]">
        {calls === 0 ? 'No function calls yet.' : `${calls} call${calls === 1 ? '' : 's'} so far · deepest ${deepest} level${deepest === 1 ? '' : 's'}`}
        {truncated ? ' · only the first 400 calls are drawn' : ''}
      </p>
      <ul aria-label="Calls so far" className="thin-scrollbar max-h-[340px] overflow-auto">
        <CallRow node={root} index={index} live={live} running={running} lang={trace.language} onSeek={onSeek} />
      </ul>
    </div>
  );
}
