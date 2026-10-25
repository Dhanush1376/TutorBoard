import React, { useMemo, useState } from 'react';
import { memoryView, objectNumbers } from '../analysis';

/**
 * Variables on one side, the objects they hold on the other: two variables
 * holding the same list point at the same box, which is how references and
 * aliasing look. `#n` is a label for an object in this walkthrough, not a
 * memory address. C/C++ pointers the step could follow point at their object;
 * the others show the address they hold.
 */

const NOTE = {
  c: 'Pointers are followed when the trace could read their memory; otherwise you see the address they hold.',
  cpp: 'Pointers and references are followed when the trace could read their memory; otherwise you see the address.',
  java: 'Objects and arrays live on the heap; variables hold references to them. #n labels an object — it is not an address.',
  python: 'Every Python value is an object; variables are names that refer to them. #n labels an object — it is not an address.',
  javascript: 'Objects and arrays are shared by reference; numbers and strings are copied. #n labels an object — it is not an address.',
};

export default function MemoryView({ trace, index }) {
  const m = useMemo(() => memoryView(trace.steps[index], trace.language), [trace, index]);
  const numbers = useMemo(() => objectNumbers(trace), [trace]);
  const label = (id) => `#${numbers.get(id) ?? id}`;
  const [hover, setHover] = useState(null);
  const hasAny = m.frames.some((f) => f.vars.length) || m.objects.length;
  if (!hasAny) return <p className="font-mono text-[11.5px] text-[var(--text-tertiary)]">No variables yet.</p>;
  const chip = (id) => (
    <span
      className={`inline-flex items-center rounded-full px-1.5 font-mono text-[11px] ${hover === id ? 'bg-[var(--mk-accent)] text-[var(--bg-primary)]' : 'bg-[var(--mk-accent-soft)] text-[var(--mk-accent)]'}`}
    >
      → {label(id)}
    </span>
  );
  return (
    <div className="@container">
      <div className="grid gap-3 @[30rem]:grid-cols-2">
        <div>
          <h4 className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Variables</h4>
          <div className="flex flex-col gap-2">
            {m.frames.map((f, i) => (
              <div key={f.id} className={`rounded-[10px] border px-2.5 py-1.5 ${i === 0 ? 'border-[var(--st-line-strong)]' : 'border-[var(--st-line)]'}`}>
                <div className="mb-0.5 font-mono text-[11px] text-[var(--text-tertiary)]">{f.name === 'global' || f.name === '<module>' ? 'program' : `${f.name}()`}</div>
                {f.vars.length === 0 && <div className="font-mono text-[11px] text-[var(--text-tertiary)]">—</div>}
                {f.vars.map((v) => (
                  <div
                    key={v.name}
                    className="flex items-center gap-2 font-mono text-[12px] leading-[1.6]"
                    onMouseEnter={() => v.target != null && setHover(v.target)}
                    onMouseLeave={() => setHover(null)}
                  >
                    <span className="text-[var(--text-secondary)]">{v.name}</span>
                    {v.target != null ? chip(v.target) : <span className="min-w-0 truncate text-[var(--text-primary)]">{v.label}</span>}
                    {v.pointer && v.target == null && <span className="text-[10px] text-[var(--text-tertiary)]">address</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div>
          <h4 className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">Objects</h4>
          {m.objects.length === 0 ? (
            <p className="font-mono text-[11px] text-[var(--text-tertiary)]">Only plain values so far — nothing shared.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {m.objects.map((o) => (
                <div
                  key={o.id}
                  className={`rounded-[10px] border px-2.5 py-1.5 transition-colors ${hover === o.id ? 'border-[var(--mk-accent)] bg-[var(--mk-accent-soft)]' : 'border-[var(--st-line)] bg-[var(--st-fill)]'}`}
                >
                  <div className="flex items-baseline gap-2 font-mono text-[11px]">
                    <span className="font-semibold text-[var(--mk-accent)]">{label(o.id)}</span>
                    <span className="text-[var(--text-tertiary)]">{o.kind}</span>
                    {o.heldBy.length > 1 && <span className="ml-auto text-[10px] uppercase tracking-[0.08em] text-amber-600 dark:text-amber-400">shared</span>}
                  </div>
                  <div className="break-words font-mono text-[12px] text-[var(--text-primary)]">{o.label}</div>
                  <div className="font-mono text-[10.5px] text-[var(--text-tertiary)]">held by {o.heldBy.join(', ') || '—'}</div>
                </div>
              ))}
            </div>
          )}
          {m.addresses.length > 0 && (
            <div className="mt-2 font-mono text-[11px] text-[var(--text-tertiary)]">
              {m.addresses.map((a) => (
                <div key={a.name}>{a.name} holds address {a.address}</div>
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="mt-2.5 text-[11.5px] leading-[1.5] text-[var(--text-tertiary)]">{NOTE[trace.language]}</p>
    </div>
  );
}
