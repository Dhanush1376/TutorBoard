import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { resolve, valueLabel, sameValue } from '../traceModel';
import { findShapes, field, LEFT, RIGHT, asNumber, nodeLabel } from '../shapes';

/**
 * Pictures of the data the running function holds, drawn from the trace:
 * arrays as cells (and bars when they're numbers) with the index variables
 * that point into them, grids, linked lists, binary trees and maps. Every value
 * shown comes from the step itself; nothing is inferred.
 */

/* ── Pieces ─────────────────────────────────────────────────────────────── */

function Caption({ name, owner, children }) {
  return (
    <div className="mb-2 flex items-baseline gap-2 font-mono text-[11px]">
      <span className="font-semibold text-[var(--text-primary)]">{name}</span>
      {owner && <span className="text-[var(--text-tertiary)]">in {owner}()</span>}
      <span className="text-[var(--text-tertiary)]">{children}</span>
    </div>
  );
}

function ArrayShape({ shape, lang }) {
  const { value, prev, pointers } = shape;
  const items = value.items;
  const nums = items.map(asNumber);
  const allNum = nums.every((n) => n !== null) && items.length >= 2 && items.length <= 40;
  const max = allNum ? Math.max(1, ...nums.map((n) => Math.abs(n))) : 1;
  const changed = (i) => prev && prev.items[i] && !sameValue(prev.items[i], items[i]);
  const pointedBy = (i) => pointers.filter((p) => asNumber(p.value) === i).map((p) => p.name);
  const cell = items.length > 16 ? 26 : 34;
  return (
    <div>
      <Caption name={shape.name} owner={shape.owner}>
        {value.kind} · {value.len} item{value.len === 1 ? '' : 's'}
      </Caption>
      <div className="thin-scrollbar overflow-x-auto pb-1">
        <div className="inline-flex flex-col">
          {allNum && (
            <div className="flex items-end gap-[3px]" style={{ height: 56 }}>
              {nums.map((n, i) => (
                <motion.div
                  key={i}
                  layout
                  animate={{ height: Math.max(3, (Math.abs(n) / max) * 52) }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  className={`rounded-t-[3px] ${pointedBy(i).length ? 'bg-[var(--mk-accent)]' : changed(i) ? 'bg-[var(--mk-accent)]/60' : 'bg-[var(--text-tertiary)]/35'}`}
                  style={{ width: cell }}
                />
              ))}
            </div>
          )}
          <div className="mt-1 flex gap-[3px]">
            {items.map((x, i) => (
              <motion.div
                key={i}
                animate={changed(i) ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={{ duration: 0.35 }}
                className={`grid h-8 place-items-center truncate rounded-[7px] border px-0.5 font-mono text-[11.5px] ${
                  pointedBy(i).length
                    ? 'border-[var(--mk-accent)] bg-[var(--mk-accent-soft)] text-[var(--text-primary)]'
                    : changed(i)
                      ? 'border-[var(--mk-accent)]/50 text-[var(--text-primary)]'
                      : 'border-[var(--st-line-strong)] bg-[var(--st-fill)] text-[var(--text-secondary)]'
                }`}
                style={{ width: cell }}
                title={valueLabel(x, lang)}
              >
                {valueLabel(x, lang)}
              </motion.div>
            ))}
            {value.len > items.length && <div className="grid h-8 place-items-center px-1 font-mono text-[11px] text-[var(--text-tertiary)]">+{value.len - items.length}</div>}
          </div>
          <div className="flex gap-[3px]">
            {items.map((_, i) => (
              <div key={i} className="flex flex-col items-center" style={{ width: cell }}>
                <span className="font-mono text-[9.5px] text-[var(--text-tertiary)]">{i}</span>
                {pointedBy(i).map((p) => (
                  <span key={p} className="font-mono text-[10px] font-semibold leading-tight text-[var(--mk-accent)]">↑{p}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GridShape({ shape, lang }) {
  const r = asNumber(shape.row?.value);
  const c = asNumber(shape.col?.value);
  return (
    <div>
      <Caption name={shape.name} owner={shape.owner}>
        {shape.rows.length} × {Math.max(...shape.rows.map((x) => x.items.length))}
        {shape.row ? ` · row ${shape.row.name}` : ''}
        {shape.col ? ` · column ${shape.col.name}` : ''}
      </Caption>
      <div className="thin-scrollbar overflow-x-auto">
        <table className="border-separate border-spacing-[3px] font-mono text-[11px]">
          <tbody>
            {shape.rows.map((row, i) => (
              <tr key={i}>
                {row.items.map((x, j) => {
                  const here = i === r && (c === null || j === c);
                  const changed = shape.prevRows?.[i]?.items?.[j] && !sameValue(shape.prevRows[i].items[j], x);
                  return (
                    <td
                      key={j}
                      className={`h-7 min-w-7 rounded-[6px] border px-1 text-center ${
                        here
                          ? 'border-[var(--mk-accent)] bg-[var(--mk-accent-soft)] text-[var(--text-primary)]'
                          : changed
                            ? 'border-[var(--mk-accent)]/50 text-[var(--text-primary)]'
                            : 'border-[var(--st-line)] bg-[var(--st-fill)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {valueLabel(x, lang)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChainShape({ shape, lang }) {
  return (
    <div>
      <Caption name={shape.name} owner={shape.owner}>
        linked list · {shape.chain.length}
        {shape.more ? '+' : ''} node{shape.chain.length === 1 ? '' : 's'}
        {shape.cycle ? ' · loops back' : ''}
      </Caption>
      <div className="thin-scrollbar flex items-start gap-1 overflow-x-auto pb-1">
        {shape.chain.map((node, i) => (
          <React.Fragment key={node.id ?? i}>
            <div className="flex shrink-0 flex-col items-center">
              <div className="rounded-[9px] border border-[var(--st-line-strong)] bg-[var(--st-fill)] px-2.5 py-1.5 font-mono text-[12px] text-[var(--text-primary)]">
                {nodeLabel(node, lang)}
              </div>
              {(shape.marks.get(i) || []).map((m) => (
                <span key={m} className="font-mono text-[10px] font-semibold text-[var(--mk-accent)]">↑{m}</span>
              ))}
            </div>
            <span className="mt-1.5 shrink-0 font-mono text-[12px] text-[var(--text-tertiary)]">→</span>
          </React.Fragment>
        ))}
        <span className="mt-1.5 shrink-0 font-mono text-[11px] text-[var(--text-tertiary)]">{shape.cycle ? '↺' : shape.more ? '…' : lang === 'python' ? 'None' : lang === 'java' || lang === 'javascript' ? 'null' : 'NULL'}</span>
      </div>
    </div>
  );
}

function TreeShape({ shape, lang }) {
  // Lay the tree out by depth (up to 4 levels): each level is a row of slots.
  const levels = [];
  const walk = (node, depth, slot) => {
    if (depth > 3) return;
    levels[depth] = levels[depth] || {};
    levels[depth][slot] = node;
    const l = resolve(field(node, LEFT)?.value, shape.byId);
    const r = resolve(field(node, RIGHT)?.value, shape.byId);
    if (l?.t === 'obj') walk(l, depth + 1, slot * 2);
    if (r?.t === 'obj') walk(r, depth + 1, slot * 2 + 1);
  };
  walk(shape.root, 0, 0);
  return (
    <div>
      <Caption name={shape.name} owner={shape.owner}>binary tree</Caption>
      <div className="flex flex-col gap-2">
        {levels.map((row, depth) => {
          const width = 2 ** depth;
          return (
            <div key={depth} className="grid gap-1" style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}>
              {Array.from({ length: width }, (_, s) => (
                <div key={s} className="flex justify-center">
                  {row[s] ? (
                    <span className="grid h-7 min-w-7 place-items-center rounded-full border border-[var(--st-line-strong)] bg-[var(--st-fill)] px-1.5 font-mono text-[11px] text-[var(--text-primary)]">
                      {nodeLabel(row[s], lang)}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MapShape({ shape, lang }) {
  const { value } = shape;
  return (
    <div>
      <Caption name={shape.name} owner={shape.owner}>
        {value.kind} · {value.len} entr{value.len === 1 ? 'y' : 'ies'}
      </Caption>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-[10px] border border-[var(--st-line)] bg-[var(--st-fill)] px-3 py-2 font-mono text-[11.5px]">
        {value.entries.map(([k, v], i) => (
          <React.Fragment key={i}>
            <span className="text-[var(--text-secondary)]">{valueLabel(k, lang)}</span>
            <span className="truncate text-[var(--text-primary)]">{valueLabel(v, lang)}</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export default function DataView({ trace, index }) {
  const shapes = useMemo(() => findShapes(trace.steps[index], trace.steps[index - 1]), [trace, index]);
  if (!shapes.length) return null;
  return (
    <div className="flex flex-col gap-4">
      {shapes.map((s) => {
        const P = { array: ArrayShape, grid: GridShape, chain: ChainShape, tree: TreeShape, map: MapShape }[s.kind];
        return <P key={s.key} shape={s} lang={trace.language} />;
      })}
    </div>
  );
}

