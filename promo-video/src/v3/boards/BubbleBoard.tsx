import React from 'react';
import { useCurrentFrame } from 'remotion';
import { easeInOut, easeOut, prog } from '../../lib/anim';
import { fonts } from '../../theme';
import { UI } from '../ui/LessonUI';

/** Measured from the running app: cells at x = 857 + k·115.2, y = 205.2, 97.2 px square. */
export const CELL = { x0: 857, y: 205.2, size: 97.2, pitch: 115.2 };
export const cellCenter = (slot: number) => ({ x: CELL.x0 + slot * CELL.pitch + CELL.size / 2, y: CELL.y + CELL.size / 2 });

export type SortOp = { i: number; swap: boolean; at: number; dur: number };

type Props = {
  values: number[];
  /** compare / swap choreography in frames local to the current Sequence */
  ops: SortOp[];
  /** slot that the doubt answer highlights (orange flash + persistent ring) */
  doubt?: { slot: number; at: number; text: string; calloutAt: number; out?: number };
  /** frame the final "sorted" sweep starts */
  sortedAt?: number;
  /** extra global opacity for the array (e.g. reveal) */
  appear?: number;
  /** frame override (scenes mounted with a lead) */
  frame?: number;
};

const Cell: React.FC<{ x: number; y: number; v: number; lift: number; cmp: number; flash?: { c: string; a: number }; ring?: { c: string; a: number }; sorted: number }> = ({
  x, y, v, lift, cmp, flash, ring, sorted,
}) => {
  const s = CELL.size;
  const border = ring && ring.a > 0.01
    ? `rgba(249,115,22,${0.25 + 0.75 * ring.a})`
    : sorted > 0.01
      ? `rgba(34,197,94,${0.18 + 0.7 * sorted})`
      : cmp > 0.01 ? `rgba(245,158,11,${0.16 + 0.84 * cmp})` : 'rgba(255,255,255,0.13)';
  return (
    <div
      style={{
        position: 'absolute', left: x, top: y - lift, width: s, height: s, borderRadius: 20, boxSizing: 'border-box',
        border: `1.5px solid ${border}`,
        background: 'linear-gradient(180deg, #282725 0%, #1C1B19 55%, #151412 100%)',
        boxShadow: [
          '0 10px 24px rgba(0,0,0,0.45)',
          'inset 0 1px 0 rgba(255,255,255,0.06)',
          cmp > 0.01 ? `0 0 ${28 * cmp}px rgba(245,158,11,${0.3 * cmp})` : '',
          ring && ring.a > 0.01 ? `0 0 ${40 * ring.a}px rgba(249,115,22,${0.45 * ring.a})` : '',
          sorted > 0.01 ? `0 0 ${24 * sorted}px rgba(34,197,94,${0.25 * sorted})` : '',
        ].filter(Boolean).join(', '),
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}
    >
      {flash && flash.a > 0.01 && <div style={{ position: 'absolute', inset: 0, background: flash.c, opacity: flash.a }} />}
      {cmp > 0.01 && <div style={{ position: 'absolute', inset: 0, background: 'rgba(245,158,11,0.18)', opacity: cmp }} />}
      {sorted > 0.01 && <div style={{ position: 'absolute', inset: 0, background: 'rgba(34,197,94,0.15)', opacity: sorted }} />}
      <span style={{ position: 'relative', fontFamily: fonts.mono, fontSize: 31, color: cmp > 0.5 ? '#fef3c7' : sorted > 0.5 ? '#bbf7d0' : '#F2F0EA', fontWeight: 400 }}>{v}</span>
    </div>
  );
};

/** Bubble Sort as the TutorBoard canvas plays it: compare (flash + comparator), arc-swap, settle. */
export const BubbleBoard: React.FC<Props> = ({ values, ops, doubt, sortedAt, appear = 1, frame: frameProp }) => {
  const current = useCurrentFrame();
  const frame = frameProp ?? current;
  // slot → id, evolved through finished ops
  const slots = values.map((_, k) => k);
  let live: { op: SortOp; t: number } | null = null;
  for (const op of ops) {
    if (frame >= op.at + op.dur) {
      if (op.swap) [slots[op.i], slots[op.i + 1]] = [slots[op.i + 1], slots[op.i]];
    } else if (frame >= op.at) {
      live = { op, t: (frame - op.at) / op.dur };
      break;
    } else break;
  }
  const pos = new Map<number, { x: number; lift: number; cmp: number }>();
  slots.forEach((id, slot) => pos.set(id, { x: CELL.x0 + slot * CELL.pitch, lift: 0, cmp: 0 }));
  let comparator: { text: string; a: number } | null = null;
  if (live) {
    const { op, t } = live;
    const a = slots[op.i];
    const b = slots[op.i + 1];
    const cmp = Math.min(prog(t, 0, 0.12), 1 - prog(t, 0.86, 0.14));
    const va = values[a];
    const vb = values[b];
    comparator = { text: `${va} ${va > vb ? '>' : '<'} ${vb}`, a: cmp };
    const pa = pos.get(a)!;
    const pb = pos.get(b)!;
    pa.cmp = cmp;
    pb.cmp = cmp;
    if (op.swap) {
      const s = prog(t, 0.34, 0.46, easeInOut);
      const arc = Math.sin(s * Math.PI);
      pa.x = CELL.x0 + (op.i + s) * CELL.pitch;
      pb.x = CELL.x0 + (op.i + 1 - s) * CELL.pitch;
      pa.lift = arc * 70; // larger value goes over the top
      pb.lift = -arc * 70;
    }
  }

  const sortedT = (slot: number) => (sortedAt === undefined ? 0 : prog(frame, sortedAt + slot * 4, 10) * (1 - prog(frame, sortedAt + 34 + slot * 4, 30) * 0.55));
  const sortFlash = (slot: number) => (sortedAt === undefined ? 0 : Math.max(0, 1 - Math.abs(frame - (sortedAt + slot * 4 + 4)) / 9) * 0.22);

  const ringA = doubt ? Math.min(prog(frame, doubt.at, 8), 1 - prog(frame, doubt.out ?? 1e9, 12)) : 0;
  const flashA = doubt ? Math.max(0, 1 - Math.abs(frame - (doubt.at + 6)) / 12) * 0.28 : 0;
  const calloutIn = doubt ? prog(frame, doubt.calloutAt, 16, easeOut) * (1 - prog(frame, doubt.out ?? 1e9, 12)) : 0;

  return (
    <div style={{ position: 'absolute', inset: 0, opacity: appear }}>
      {comparator && (
        <div
          style={{
            position: 'absolute', left: CELL.x0, width: CELL.pitch * 4 + CELL.size, top: 128, textAlign: 'center',
            fontFamily: fonts.sans, fontSize: 22, fontWeight: 700, color: '#FFFFFF', opacity: comparator.a,
            transform: `translateY(${(1 - comparator.a) * 6}px)`,
          }}
        >
          {comparator.text}
        </div>
      )}
      {values.map((_, slot) => (
        <div key={`i${slot}`} style={{ position: 'absolute', left: CELL.x0 + slot * CELL.pitch, width: CELL.size, top: 310, textAlign: 'center', fontFamily: fonts.sans, fontSize: 17, color: '#8F8F8F' }}>
          {slot}
        </div>
      ))}
      {[...pos.entries()].sort((p, q) => p[1].lift - q[1].lift).map(([id, p]) => {
        const slot = slots.indexOf(id);
        const isDoubt = doubt && slot === doubt.slot && !live;
        return (
          <Cell
            key={id}
            x={p.x}
            y={CELL.y}
            v={values[id]}
            lift={p.lift}
            cmp={p.cmp}
            sorted={sortedT(slot)}
            flash={isDoubt ? { c: UI.orange, a: flashA } : sortedAt !== undefined ? { c: '#22c55e', a: sortFlash(slot) } : undefined}
            ring={isDoubt ? { c: UI.orange, a: ringA } : undefined}
          />
        );
      })}
      {doubt && calloutIn > 0.01 && (() => {
        const c = cellCenter(doubt.slot);
        const boxW = 419;
        const left = Math.min(c.x - boxW / 2, 1461 - boxW);
        return (
          <>
            <svg style={{ position: 'absolute', left: c.x - 2, top: 382 }} width={4} height={60}>
              <line x1={2} y1={0} x2={2} y2={58 * calloutIn} stroke="#6366F1" strokeWidth={2} strokeDasharray="6 5" />
            </svg>
            <div
              style={{
                position: 'absolute', left, top: 442, width: boxW, height: 54, borderRadius: 10, boxSizing: 'border-box',
                border: '2px solid #6E6BF2', background: '#191733', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: fonts.sans, fontSize: 18, fontWeight: 700, color: '#F4F4F4',
                opacity: calloutIn, transform: `translateY(${(1 - calloutIn) * 12}px) scale(${0.96 + 0.04 * calloutIn})`,
                boxShadow: `0 0 ${30 * calloutIn}px rgba(99,102,241,0.25)`,
              }}
            >
              {doubt.text}
            </div>
          </>
        );
      })()}
    </div>
  );
};

/** Values in slot order after all ops whose end ≤ frame. */
export const orderAfter = (values: number[], ops: SortOp[], frame: number) => {
  const slots = values.map((_, k) => k);
  for (const op of ops) if (frame >= op.at + op.dur && op.swap) [slots[op.i], slots[op.i + 1]] = [slots[op.i + 1], slots[op.i]];
  return slots.map((id) => values[id]);
};
